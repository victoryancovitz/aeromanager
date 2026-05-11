import { seedAirportCache } from './tracker';
import { supabase } from './supabase';

// ── Auth helpers ──────────────────────────────────────────────
export async function getUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch(e) {
    return null;
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

// ── Aircraft ──────────────────────────────────────────────────
export async function getAircraft() {
  // 1. Aeronaves próprias
  const { data: owned, error } = await supabase
    .from('aircraft')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;

  // 2. Aeronaves compartilhadas via co-propriedade
  const user = await getUser();
  let shared = [];
  if (user) {
    const { data: coOwned } = await supabase
      .from('aircraft_co_owners')
      .select('aircraft_id, share_pct, role')
      .eq('user_id', user.id);
    if (coOwned && coOwned.length > 0) {
      const ownedIds = new Set((owned || []).map(a => a.id));
      const sharedIds = coOwned.map(c => c.aircraft_id).filter(id => !ownedIds.has(id));
      if (sharedIds.length > 0) {
        const { data: sharedAc } = await supabase
          .from('aircraft')
          .select('*')
          .in('id', sharedIds);
        // Marcar como compartilhada para exibição
        shared = (sharedAc || []).map(a => ({
          ...a,
          _shared: true,
          _shareRole: coOwned.find(c => c.aircraft_id === a.id)?.role || 'co_owner',
          _sharePct: coOwned.find(c => c.aircraft_id === a.id)?.share_pct || 0,
        }));
      }
    }
  }


  // Popular cache de aeroportos para o GPS tracker (em background)
  supabase.from('airports_db').select('icao,lat,lng,name,iata,city').eq('country','BR').not('lat','is',null)
    .then(({data})=>{
      if(data&&data.length>0) seedAirportCache(data.map(a=>({icao:a.icao,lat:parseFloat(a.lat),lon:parseFloat(a.lng),name:a.name||a.icao})));
    }).catch(()=>{});
  return [...(owned || []), ...shared].map(fromDB_aircraft);
}
export async function saveAircraft(ac) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = toDB_aircraft(ac, user.id);
  if (ac.id) {
    const { data, error } = await supabase.from('aircraft').update(row).eq('id', ac.id).select().single();
    if (error) throw error;
    return fromDB_aircraft(data);
  } else {
    const { data, error } = await supabase.from('aircraft').insert(row).select().single();
    if (error) throw error;
    return fromDB_aircraft(data);
  }
}

export async function deleteAircraft(id) {
  const { error } = await supabase.from('aircraft').delete().eq('id', id);
  if (error) throw error;
}

// ── Flights ───────────────────────────────────────────────────
export async function getFlights() {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDB_flight);
}

export async function saveFlight(f) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');

  // Auto-record fuel price
  if (f.destinationIcao && f.fuelAddedLiters > 0 && f.fuelPricePerLiter > 0) {
    await recordFuelPrice({
      icao: f.destinationIcao,
      pricePerLiter: parseFloat(f.fuelPricePerLiter),
      liters: parseFloat(f.fuelAddedLiters),
      fuelType: f.fuelType || 'avgas_100ll',
      vendor: f.fuelVendor || '',
      date: f.date,
    });
  }

  const row = toDB_flight(f, user.id);
  let saved;
  if (f.id) {
    const { data, error } = await supabase.from('flights').update(row).eq('id', f.id).select().single();
    if (error) throw error;
    saved = fromDB_flight(data);
  } else {
    const { data, error } = await supabase.from('flights').insert(row).select().single();
    if (error) throw error;
    saved = fromDB_flight(data);
  }

  // Update aircraft hours
  await updateAircraftHours(f.aircraftId);
  return saved;
}

export async function deleteFlight(id) {
  const { error } = await supabase.from('flights').delete().eq('id', id);
  if (error) throw error;
}

async function updateAircraftHours(aircraftId) {
  if (!aircraftId) return;
  const { data: flights } = await supabase
    .from('flights')
    .select('flight_time_minutes, cycles')
    .eq('aircraft_id', aircraftId);
  if (!flights) return;
  const totalMins  = flights.reduce((s, f) => s + (f.flight_time_minutes || 0), 0);
  const totalCycles = flights.reduce((s, f) => s + (f.cycles || 1), 0);
  await supabase.from('aircraft').update({
    total_flight_hours: parseFloat((totalMins / 60).toFixed(1)),
    total_cycles: totalCycles,
  }).eq('id', aircraftId);
}

// ── Costs ─────────────────────────────────────────────────────
export async function getCosts() {
  const { data, error } = await supabase
    .from('costs')
    .select('*')
    .order('reference_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDB_cost);
}

export async function saveCost(c) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = toDB_cost(c, user.id);
  if (c.id) {
    const { data, error } = await supabase.from('costs').update(row).eq('id', c.id).select().single();
    if (error) throw error;
    return fromDB_cost(data);
  } else {
    const { data, error } = await supabase.from('costs').insert(row).select().single();
    if (error) throw error;
    return fromDB_cost(data);
  }
}

export async function deleteCost(id) {
  const { error } = await supabase.from('costs').delete().eq('id', id);
  if (error) throw error;
}

// ── Bulk operations ───────────────────────────────────────────

export async function bulkUpdateCosts(ids, patch) {
  // patch: { category, costType, recurrence, billingPeriod, etc. }
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const dbPatch = {};
  if (patch.category    !== undefined) dbPatch.category       = patch.category;
  if (patch.categoryId  !== undefined) dbPatch.category_id    = patch.categoryId;
  if (patch.costType    !== undefined) dbPatch.cost_type       = patch.costType;
  if (patch.recurrence  !== undefined) dbPatch.recurrence      = patch.recurrence;
  if (patch.billingPeriod !== undefined) dbPatch.billing_period = patch.billingPeriod;
  if (patch.aircraftId  !== undefined) dbPatch.aircraft_id     = patch.aircraftId;
  if (patch.vendor      !== undefined) dbPatch.vendor          = patch.vendor;
  const { error } = await supabase.from('costs').update(dbPatch).in('id', ids).eq('user_id', user.id);
  if (error) throw error;
}

export async function bulkDeleteCosts(ids) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const { error } = await supabase.from('costs').delete().in('id', ids).eq('user_id', user.id);
  if (error) throw error;
}

export async function bulkUpdateComponents(ids, patch) {
  // patch: { tso, tsn, dueHours, shop, notes, etc. }
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const dbPatch = {};
  if (patch.tso      !== undefined) dbPatch.tso       = patch.tso;
  if (patch.tsn      !== undefined) dbPatch.tsn       = patch.tsn;
  if (patch.dueHours !== undefined) dbPatch.due_hours = patch.dueHours;
  if (patch.dueDate  !== undefined) dbPatch.due_date  = patch.dueDate || null;
  if (patch.shop     !== undefined) dbPatch.shop       = patch.shop;
  if (patch.notes    !== undefined) dbPatch.notes      = patch.notes;
  if (patch.category !== undefined) dbPatch.category   = patch.category;
  dbPatch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('components').update(dbPatch).in('id', ids).eq('user_id', user.id);
  if (error) throw error;
}

export async function saveEngineEventWithCost(eventData, createCost = true) {
  // Save engine event and optionally auto-create linked cost
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');

  const eventRow = {
    user_id:        user.id,
    aircraft_id:    eventData.aircraft_id,
    engine_position: eventData.engine_position || 1,
    event_type:     eventData.event_type,
    event_date:     eventData.event_date,
    airframe_hours_at_event: eventData.airframe_hours_at_event || null,
    engine_tsn:     eventData.engine_tsn || null,
    engine_tso:     eventData.engine_tso || null,
    engine_csn:     eventData.engine_csn ? parseInt(eventData.engine_csn) : null,
    amount_brl:     eventData.amount_brl || null,
    currency:       eventData.currency || 'BRL',
    counterparty:   eventData.counterparty || null,
    program_name:   eventData.program_name || null,
    program_coverage: eventData.program_coverage || null,
    program_rate_per_hour: eventData.program_rate_per_hour || null,
    rental_start:   eventData.rental_start || null,
    rental_end:     eventData.rental_end || null,
    rental_rate_type: eventData.rental_rate_type || null,
    rental_rate:    eventData.rental_rate || null,
    work_order:     eventData.work_order || null,
    shop_name:      eventData.shop_name || null,
    doc_ref:        eventData.doc_ref || null,
    notes:          eventData.notes || null,
  };

  let savedEvent;
  if (eventData.id) {
    const { data, error } = await supabase.from('engine_events').update(eventRow).eq('id', eventData.id).select().single();
    if (error) throw error;
    savedEvent = data;
  } else {
    const { data, error } = await supabase.from('engine_events').insert(eventRow).select().single();
    if (error) throw error;
    savedEvent = data;
  }

  // Auto-create linked cost when there's a financial value
  const COST_CATEGORIES = {
    buy:           { category: 'mx', description: 'Compra de motor' },
    sell:          { category: 'other', description: 'Venda de motor' },
    rent_in:       { category: 'fixed', description: 'Aluguel de motor (recebido)' },
    rent_out:      { category: 'fixed', description: 'Aluguel de motor (cedido)' },
    program_enroll:{ category: 'fixed', description: `Programa ${eventData.program_name || 'motor'}` },
    overhaul:      { category: 'mx', description: 'Revisão geral (OH) motor' },
    repair:        { category: 'mx', description: 'Reparo de motor' },
    borescope:     { category: 'mx', description: 'Inspeção boroscópica' },
  };

  if (createCost && eventData.amount_brl && COST_CATEGORIES[eventData.event_type]) {
    const cat = COST_CATEGORIES[eventData.event_type];
    const posLabel = eventData.engine_position === 0 ? 'APU' : `Motor #${eventData.engine_position}`;
    const costRow = {
      user_id:        user.id,
      aircraft_id:    eventData.aircraft_id,
      category:       cat.category,
      cost_type:      'variable',
      amount_brl:     parseFloat(eventData.amount_brl),
      description:    `${cat.description} — ${posLabel}${eventData.counterparty ? ` (${eventData.counterparty})` : ''}`,
      reference_date: eventData.event_date,
      vendor:         eventData.shop_name || eventData.counterparty || null,
      engine_event_id: savedEvent.id,
      recurrence:     'once',
    };
    await supabase.from('costs').insert(costRow);
  }

  return savedEvent;
}

export async function getCostCategories() {
  const user = await getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('cost_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order');
  return data || [];
}

export async function saveCostCategory(cat) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = {
    user_id:    user.id,
    name:       cat.name,
    group_type: cat.groupType || 'operational',
    color:      cat.color || null,
    icon:       cat.icon || null,
    sort_order: cat.sortOrder || 0,
  };
  if (cat.id) {
    await supabase.from('cost_categories').update(row).eq('id', cat.id);
  } else {
    await supabase.from('cost_categories').insert(row);
  }
}

export async function deleteCostCategory(id) {
  await supabase.from('cost_categories').delete().eq('id', id);
}

// ── Maintenance ───────────────────────────────────────────────
export async function getMaintenance() {
  const { data, error } = await supabase
    .from('maintenance')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromDB_maint);
}

export async function saveMaintenance(m) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = toDB_maint(m, user.id);
  if (m.id) {
    const { data, error } = await supabase.from('maintenance').update(row).eq('id', m.id).select().single();
    if (error) throw error;
    return fromDB_maint(data);
  } else {
    const { data, error } = await supabase.from('maintenance').insert(row).select().single();
    if (error) throw error;
    return fromDB_maint(data);
  }
}

export async function deleteMaintenance(id) {
  const { error } = await supabase.from('maintenance').delete().eq('id', id);
  if (error) throw error;
}

// ── Missions ──────────────────────────────────────────────────
export async function getMissions() {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .order('date_start', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDB_mission);
}

export async function saveMission(m) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = toDB_mission(m, user.id);
  if (m.id) {
    const { data, error } = await supabase.from('missions').update(row).eq('id', m.id).select().single();
    if (error) throw error;
    return fromDB_mission(data);
  } else {
    const { data, error } = await supabase.from('missions').insert(row).select().single();
    if (error) throw error;
    return fromDB_mission(data);
  }
}

export async function deleteMission(id) {
  const { error } = await supabase.from('missions').delete().eq('id', id);
  if (error) throw error;
}

// ── Fuel Prices ───────────────────────────────────────────────
export async function getFuelPrices() {
  const { data, error } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function recordFuelPrice(entry) {
  const user = await getUser();
  if (!user) return;
  await supabase.from('fuel_prices').insert({
    user_id:         user.id,
    icao:            entry.icao,
    price_per_liter: entry.pricePerLiter,
    liters:          entry.liters || 0,
    fuel_type:       entry.fuelType || 'avgas_100ll',
    vendor:          entry.vendor || null,
    date:            entry.date,
    flight_id:       entry.flightId || null,
    notes:           entry.notes || null,
  });
}

export async function getLastFuelPrice(icao, fuelType = 'avgas_100ll') {
  const { data } = await supabase
    .from('fuel_prices')
    .select('price_per_liter')
    .eq('icao', icao)
    .eq('fuel_type', fuelType)
    .order('date', { ascending: false })
    .limit(1)
    .single();
  return data?.price_per_liter || null;
}

// ── Settings ──────────────────────────────────────────────────
export async function getSettings() {
  const { data } = await supabase.from('user_settings').select('*').single();
  if (!data) return { apiKey: '', fuelUnit: 'liters', currency: 'BRL', anacCredentials: {}, integrations: {} };
  return {
    apiKey:           data.api_key || '',
    fuelUnit:         data.fuel_unit || 'liters',
    currency:         data.currency || 'BRL',
    anacCredentials:  data.anac_credentials || {},
    integrations:     data.integrations || {},
  };
}

export async function saveSettings(s) {
  const user = await getUser();
  if (!user) return;
  await supabase.from('user_settings').upsert({
    user_id:          user.id,
    api_key:          s.apiKey,
    fuel_unit:        s.fuelUnit,
    currency:         s.currency,
    anac_credentials: s.anacCredentials || {},
    integrations:     s.integrations || {},
  }, { onConflict: 'user_id' });
}

// ── Analytics ─────────────────────────────────────────────────
export async function getStats(aircraftId, dateFrom, dateTo) {
  let cq = supabase.from('costs').select('amount_brl');
  let fq = supabase.from('flights').select('flight_time_minutes, distance_nm');
  if (aircraftId) { cq = cq.eq('aircraft_id', aircraftId); fq = fq.eq('aircraft_id', aircraftId); }
  if (dateFrom)   { cq = cq.gte('reference_date', dateFrom); fq = fq.gte('date', dateFrom); }
  if (dateTo)     { cq = cq.lte('reference_date', dateTo); fq = fq.lte('date', dateTo); }
  const [{ data: costs }, { data: flights }] = await Promise.all([cq, fq]);
  const totalCost  = (costs  || []).reduce((s, c) => s + parseFloat(c.amount_brl || 0), 0);
  const totalMins  = (flights|| []).reduce((s, f) => s + (f.flight_time_minutes || 0), 0);
  const totalNm    = (flights|| []).reduce((s, f) => s + parseFloat(f.distance_nm || 0), 0);
  const totalHours = totalMins / 60;
  return {
    totalCost, totalHours, totalNm, flightCount: (flights || []).length,
    costPerHour: totalHours > 0 ? totalCost / totalHours : 0,
    costPerNm:   totalNm   > 0 ? totalCost / totalNm   : 0,
  };
}

// ── Migration from localStorage ───────────────────────────────
export async function migrateFromLocalStorage() {
  const user = await getUser();
  if (!user) throw new Error('Faça login antes de migrar');

  const results = { aircraft: 0, flights: 0, costs: 0, maintenance: 0, missions: 0, fuelPrices: 0 };

  function load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }

  const aircraft = load('am3_aircraft');
  const idMap = {}; // old id → new id
  for (const ac of aircraft) {
    const oldId = ac.id;
    const row = toDB_aircraft(ac, user.id);
    delete row.id;
    const { data } = await supabase.from('aircraft').insert(row).select().single();
    if (data) { idMap[oldId] = data.id; results.aircraft++; }
  }

  const flights = load('am3_flights');
  const flightIdMap = {};
  for (const f of flights) {
    const oldId = f.id;
    const row = toDB_flight({ ...f, aircraftId: idMap[f.aircraftId] || f.aircraftId }, user.id);
    delete row.id;
    const { data } = await supabase.from('flights').insert(row).select().single();
    if (data) { flightIdMap[oldId] = data.id; results.flights++; }
  }

  for (const c of load('am3_costs')) {
    const row = toDB_cost({ ...c, aircraftId: idMap[c.aircraftId], flightId: flightIdMap[c.flightId] }, user.id);
    delete row.id;
    await supabase.from('costs').insert(row);
    results.costs++;
  }

  for (const m of load('am3_maint')) {
    const row = toDB_maint({ ...m, aircraftId: idMap[m.aircraftId] }, user.id);
    delete row.id;
    await supabase.from('maintenance').insert(row);
    results.maintenance++;
  }

  for (const m of load('am3_missions')) {
    const row = toDB_mission({ ...m, aircraftId: idMap[m.aircraftId] }, user.id);
    delete row.id;
    await supabase.from('missions').insert(row);
    results.missions++;
  }

  for (const p of load('am3_fuel_prices')) {
    await supabase.from('fuel_prices').insert({
      user_id: user.id, icao: p.icao,
      price_per_liter: p.pricePerLiter || p.price_per_liter,
      liters: p.liters || 0, fuel_type: p.fuelType || 'avgas_100ll',
      vendor: p.vendor, date: p.date,
    });
    results.fuelPrices++;
  }

  return results;
}

// ── Import helpers (CSV) ──────────────────────────────────────
export async function importForeFlight(csvText, aircraftId) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const lines = csvText.trim().split('\n');
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;
    const row = {}; header.forEach((h, idx) => row[h] = cols[idx] || '');
    const date = row['Date'] || row['date'] || '';
    const totalTime = parseFloat(row['TotalTime'] || row['Total Time'] || 0);
    if (!date || !totalTime) continue;
    await supabase.from('flights').insert({
      user_id: user.id, aircraft_id: aircraftId,
      date: date.includes('/') ? date.split('/').reverse().join('-') : date,
      departure_icao:   (row['From'] || '').toUpperCase().slice(0,4) || 'XXXX',
      destination_icao: (row['To']   || '').toUpperCase().slice(0,4) || 'XXXX',
      flight_time_minutes: Math.round(totalTime * 60),
      flight_time_day:  Math.round(parseFloat(row['Day'] || totalTime) * 60),
      flight_time_night: Math.round(parseFloat(row['Night'] || 0) * 60),
      flight_time_ifr:  Math.round(parseFloat(row['ActualInstrument'] || 0) * 60),
      flight_conditions: parseFloat(row['ActualInstrument'] || 0) > 0 ? 'ifr' : 'vfr',
      purpose: 'leisure', cycles: 1, source: 'foreflight',
      logbook_notes: `ForeFlight: ${row['Remarks'] || ''}`.trim(),
    });
    count++;
  }
  await updateAircraftHours(aircraftId);
  return count;
}

export async function importPlaneItCSV(csvText, aircraftId) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const lines = csvText.trim().split('\n');
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.replace(/"/g, '').trim());
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;
    const row = {}; header.forEach((h, idx) => row[h] = cols[idx] || '');
    const date = row['Data'] || row['DATE'] || '';
    const hv = parseFloat(row['Horas Voadas'] || row['HV'] || 0);
    if (!date || !hv) continue;
    await supabase.from('flights').insert({
      user_id: user.id, aircraft_id: aircraftId, date,
      departure_icao:   (row['Origem'] || row['FROM'] || '').toUpperCase().slice(0,4) || 'XXXX',
      destination_icao: (row['Destino'] || row['TO'] || '').toUpperCase().slice(0,4) || 'XXXX',
      flight_time_minutes: Math.round(hv * 60),
      fuel_added_liters: parseFloat(row['Combustivel'] || row['Fuel'] || 0),
      flight_conditions: 'vfr', purpose: 'leisure', cycles: 1, source: 'planeit',
      logbook_notes: `PlaneIT: ${row['Obs'] || ''}`.trim(),
    });
    count++;
  }
  await updateAircraftHours(aircraftId);
  return count;
}

// ── DB field mappers ──────────────────────────────────────────
function toDB_aircraft(a, userId) {
  return {
    id:                   a.id || undefined,
    user_id:              userId,
    registration:         a.registration,
    type:                 a.type || 'single_engine',
    manufacturer:         a.manufacturer,
    model:                a.model,
    year:                 a.year ? parseInt(a.year) : null,
    engine_model:         a.engineModel,
    engine_tbo_hours:     a.engineTboHours ? parseFloat(a.engineTboHours) : null,
    num_engines:          a.numEngines != null ? parseInt(a.numEngines) : null,
    prop_model:           a.propModel,
    prop_tbo_hours:       a.propTboHours ? parseFloat(a.propTboHours) : null,
    base_airframe_hours:  parseFloat(a.baseAirframeHours) || 0,
    total_flight_hours:   parseFloat(a.totalFlightHours) || 0,
    total_engine_hours:   parseFloat(a.totalEngineHours) || 0,
    total_cycles:         parseInt(a.totalCycles) || 0,
    fuel_type:            a.fuelType || 'avgas_100ll',
    fuel_capacity_liters: a.fuelCapacityLiters ? parseFloat(a.fuelCapacityLiters) : null,
    home_base:            a.homeBase,
    monthly_fixed:        parseFloat(a.monthlyFixed) || 0,
    performance_profiles: a.performanceProfiles || [],
    climb_profiles:       a.climbProfiles || [],
    fuel_bias_manual:     a.fuelBiasManual != null ? parseFloat(a.fuelBiasManual) : null,
    anac_config:          a.anacConfig || { status: 'nao_configurado' },
    is_active:            a.isActive !== false,
  };
}

function fromDB_aircraft(r) {
  return {
    id:                  r.id,
    registration:        r.registration,
    type:                r.type,
    manufacturer:        r.manufacturer,
    model:               r.model,
    year:                r.year,
    engineModel:         r.engine_model,
    engineTboHours:      r.engine_tbo_hours,
    numEngines:          r.num_engines || 1,
    propModel:           r.prop_model,
    propTboHours:        r.prop_tbo_hours,
    baseAirframeHours:   r.base_airframe_hours,
    totalFlightHours:    r.total_flight_hours,
    totalEngineHours:    r.total_engine_hours,
    totalCycles:         r.total_cycles,
    fuelType:            r.fuel_type,
    fuelCapacityLiters:  r.fuel_capacity_liters,
    homeBase:            r.home_base,
    monthlyFixed:        r.monthly_fixed,
    performanceProfiles: r.performance_profiles || [],
    climbProfiles:       r.climb_profiles || [],
    fuelBiasManual:      r.fuel_bias_manual,
    anacConfig:          r.anac_config || { status: 'nao_configurado' },
    isActive:            r.is_active,
    updatedAt:           r.updated_at,
  };
}

function toDB_flight(f, userId) {
  return {
    id:                   f.id || undefined,
    user_id:              userId,
    aircraft_id:          f.aircraftId || null,
    date:                 f.date,
    departure_icao:       f.departureIcao,
    destination_icao:     f.destinationIcao,
    takeoff_utc:          f.takeoffUtc,
    landing_utc:          f.landingUtc,
    flight_time_minutes:  parseInt(f.flightTimeMinutes) || 0,
    flight_time_day:      parseInt(f.flightTimeDay) || 0,
    flight_time_night:    parseInt(f.flightTimeNight) || 0,
    flight_time_ifr:      parseInt(f.flightTimeIfr) || 0,
    distance_nm:          parseFloat(f.distanceNm) || 0,
    cruise_altitude_ft:   parseInt(f.cruiseAltitudeFt) || 0,
    max_altitude_ft:      parseInt(f.maxAltitudeFt) || 0,
    fuel_added_liters:    parseFloat(f.fuelAddedLiters) || 0,
    fuel_price_per_liter: parseFloat(f.fuelPricePerLiter) || 0,
    fuel_vendor:          f.fuelVendor || null,
    flight_conditions:    f.flightConditions || 'vfr',
    purpose:              f.purpose || 'leisure',
    cycles:               parseInt(f.cycles) || 1,
    hobbs_start: f.hobbsStart || null,
    hobbs_end:   f.hobbsEnd   || null,
    phase_climb_min:      parseInt(f.phaseClimbMin) || 0,
    phase_cruise_min:     parseInt(f.phaseCruiseMin) || 0,
    phase_descent_min:    parseInt(f.phaseDescentMin) || 0,
    mission_id:           f.missionId || null,
    source:               f.source || 'manual',
    gps_track_points:     parseInt(f.gpsTrackPoints) || 0,
    logbook_notes:        f.logbookNotes || null,
    block_out_time:       f.blockOutTime || null,
    block_in_time:        f.blockInTime || null,
    block_time_minutes:   f.blockTimeMinutes != null ? parseInt(f.blockTimeMinutes) : null,
    destination_fbo:      f.destinationFbo || null,
    crew_notes:           f.crewNotes || null,
  };
}

function fromDB_flight(r) {
  return {
    id:                 r.id,
    aircraftId:         r.aircraft_id,
    date:               r.date,
    departureIcao:      r.departure_icao,
    destinationIcao:    r.destination_icao,
    takeoffUtc:         r.takeoff_utc,
    landingUtc:         r.landing_utc,
    flightTimeMinutes:  r.flight_time_minutes,
    flightTimeDay:      r.flight_time_day,
    flightTimeNight:    r.flight_time_night,
    flightTimeIfr:      r.flight_time_ifr,
    distanceNm:         r.distance_nm,
    cruiseAltitudeFt:   r.cruise_altitude_ft,
    maxAltitudeFt:      r.max_altitude_ft,
    fuelAddedLiters:    r.fuel_added_liters,
    fuelPricePerLiter:  r.fuel_price_per_liter,
    fuelVendor:         r.fuel_vendor,
    flightConditions:   r.flight_conditions,
    purpose:            r.purpose,
    cycles:             r.cycles,
    phaseClimbMin:      r.phase_climb_min,
    phaseCruiseMin:     r.phase_cruise_min,
    phaseDescentMin:    r.phase_descent_min,
    source:             r.source,
    gpsTrackPoints:     r.gps_track_points,
    logbookNotes:       r.logbook_notes,
    missionId:          r.mission_id || null,
    blockOutTime:       r.block_out_time,
    blockInTime:        r.block_in_time,
    blockTimeMinutes:   r.block_time_minutes,
    destinationFbo:     r.destination_fbo,
    crewNotes:          r.crew_notes,
    updatedAt:          r.updated_at,
  };
}

function toDB_cost(c, userId) {
  return {
    id:               c.id || undefined,
    user_id:          userId,
    aircraft_id:      c.aircraftId || null,
    flight_id:        c.flightId || null,
    category:         c.category,
    category_id:      c.categoryId || null,
    cost_type:        c.costType || 'variable',
    amount_brl:       parseFloat(c.amountBrl) || 0,
    description:      c.description || null,
    reference_date:   c.referenceDate || null,
    vendor:           c.vendor || null,
    receipt_url:      c.receiptUrl || null,
    recurrence:       c.recurrence || 'once',
    recurrence_day:   c.recurrenceDay ? parseInt(c.recurrenceDay) : null,
    recurrence_end:   c.recurrenceEnd || null,
    billing_period:   c.billingPeriod || null,
    airport_id:       c.airportId || null,
    engine_event_id:  c.engineEventId || null,
    invoice_number:   c.invoiceNumber || null,
    mission_id:       c.missionId || null,
    exclude_from_stats: !!c.excludeFromStats,
    is_template:      !!c.isTemplate,
    template_id:      c.templateId || null,
    account_id:       c.accountId || null,
    currency:         c.currency || 'BRL',
    amount_usd:       c.amountUsd !== '' && c.amountUsd != null ? parseFloat(c.amountUsd) : null,
    exchange_rate:    c.exchangeRate !== '' && c.exchangeRate != null ? parseFloat(c.exchangeRate) : null,
    paid_by:          c.paidBy || null,
    reimbursable:     !!c.reimbursable,
    reimbursed_at:    c.reimbursedAt || null,
  };
}

function fromDB_cost(r) {
  return {
    id:             r.id,
    aircraftId:     r.aircraft_id,
    flightId:       r.flight_id,
    category:       r.category,
    categoryId:     r.category_id,
    costType:       r.cost_type,
    amountBrl:      r.amount_brl,
    description:    r.description,
    referenceDate:  r.reference_date,
    vendor:         r.vendor,
    receiptUrl:     r.receipt_url,
    recurrence:     r.recurrence || 'once',
    recurrenceDay:  r.recurrence_day,
    recurrenceEnd:  r.recurrence_end,
    billingPeriod:  r.billing_period,
    airportId:      r.airport_id,
    engineEventId:  r.engine_event_id,
    invoiceNumber:  r.invoice_number,
    missionId:          r.mission_id || null,
    excludeFromStats:   r.exclude_from_stats || false,
    isTemplate:         r.is_template,
    templateId:     r.template_id,
    updatedAt:      r.updated_at,
    accountId:      r.account_id || null,
    currency:       r.currency || 'BRL',
    amountUsd:      r.amount_usd,
    exchangeRate:   r.exchange_rate,
    paidBy:         r.paid_by || null,
    reimbursable:   !!r.reimbursable,
    reimbursedAt:   r.reimbursed_at || null,
  };
}

// ── Receipts (comprovantes) ──────────────────────────────────────────────────
// Upload um arquivo para o bucket 'receipts' (privado). Retorna o path interno.
export async function uploadReceipt(file) {
  if (!file) throw new Error('Sem arquivo');
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

// Gera URL assinada temporária para visualização (60 min)
export async function getReceiptSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
  if (error) throw error;
  return data?.signedUrl || null;
}

// Remove comprovante do storage
export async function removeReceipt(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('receipts').remove([path]);
  if (error) throw error;
}

export async function listFinancialAccounts() {
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('financial_accounts').select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false }).order('name');
  if (error) throw error;
  return data || [];
}

function toDB_maint(m, userId) {
  return {
    id:                 m.id || undefined,
    user_id:            userId,
    aircraft_id:        m.aircraftId || null,
    item_type:          m.itemType || 'inspection',
    name:               m.name,
    interval_hours:     m.intervalHours ? parseFloat(m.intervalHours) : null,
    interval_days:      m.intervalDays ? parseInt(m.intervalDays) : null,
    last_done_hours:    m.lastDoneHours ? parseFloat(m.lastDoneHours) : null,
    last_done_date:     m.lastDoneDate || null,
    next_due_hours:     m.nextDueHours ? parseFloat(m.nextDueHours) : null,
    next_due_date:      m.nextDueDate || null,
    status:             m.status || 'current',
    estimated_cost_brl: parseFloat(m.estimatedCostBrl) || 0,
    notes:              m.notes || null,
    deferred_until_date:  m.deferredUntilDate || null,
    deferred_until_hours: m.deferredUntilHours ? parseFloat(m.deferredUntilHours) : null,
    deferral_ref:         m.deferralRef || null,
  };
}

function fromDB_maint(r) {
  return {
    id:               r.id,
    aircraftId:       r.aircraft_id,
    itemType:         r.item_type,
    name:             r.name,
    intervalHours:    r.interval_hours,
    intervalDays:     r.interval_days,
    lastDoneHours:    r.last_done_hours,
    lastDoneDate:     r.last_done_date,
    nextDueHours:     r.next_due_hours,
    nextDueDate:      r.next_due_date,
    status:           r.status,
    estimatedCostBrl: r.estimated_cost_brl,
    notes:            r.notes,
    deferredUntilDate:  r.deferred_until_date || '',
    deferredUntilHours: r.deferred_until_hours || '',
    deferralRef:        r.deferral_ref || '',
  };
}

function toDB_mission(m, userId) {
  return {
    id:            m.id || undefined,
    user_id:       userId,
    aircraft_id:   m.aircraftId || null,
    flight_id:     m.flightId || null,
    name:          m.name,
    type:          m.type || 'round_trip',
    status:        m.status || 'planned',
    purpose:       m.purpose || 'leisure',
    date_start:    m.dateStart || null,
    date_end:      m.dateEnd || null,
    legs:          m.legs || [],
    passengers:    m.passengers || [],
    notes:         m.notes || null,
    cancelled_at:  m.cancelledAt || null,
    cancel_reason: m.cancelReason || null,
  };
}

function fromDB_mission(r) {
  return {
    id:           r.id,
    aircraftId:   r.aircraft_id,
    flightId:     r.flight_id || null,
    name:         r.name,
    type:         r.type,
    status:       r.status,
    purpose:      r.purpose,
    dateStart:    r.date_start,
    dateEnd:      r.date_end,
    legs:         r.legs || [],
    passengers:   r.passengers || [],
    notes:        r.notes,
    cancelledAt:  r.cancelled_at || null,
    cancelReason: r.cancel_reason || null,
    updatedAt:    r.updated_at,
  };
}

// Compute fuel bias from real flights vs POH
export async function computeFuelBias(aircraftId) {
  const { data: ac } = await supabase.from('aircraft').select('performance_profiles, fuel_bias_manual').eq('id', aircraftId).single();
  if (!ac?.performance_profiles?.length) return null;
  const { data: flights } = await supabase.from('flights').select('fuel_added_liters, flight_time_minutes').eq('aircraft_id', aircraftId).gt('fuel_added_liters', 0).gt('flight_time_minutes', 0);
  if (!flights || flights.length < 3) return null;
  const realAvg = flights.reduce((s, f) => s + (parseFloat(f.fuel_added_liters) / (f.flight_time_minutes / 60)), 0) / flights.length;
  const pohAvg  = ac.performance_profiles.reduce((s, p) => s + p.fuelLph, 0) / ac.performance_profiles.length;
  return pohAvg > 0 ? parseFloat(((realAvg - pohAvg) / pohAvg * 100).toFixed(1)) : null;
}

// ── Crew Members ──────────────────────────────────────────────
export async function getCrewMembers() {
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('crew_members').select('*').eq('user_id', user.id).order('full_name');
  if (error) throw error;
  return data || [];
}
export async function saveCrewMember(m) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = { user_id: user.id, full_name: m.full_name, display_name: m.display_name || null, role: m.role || 'captain', nationality: m.nationality || null, dob: m.dob || null, anac_code: m.anac_code || null, is_self: m.is_self || false, notes: m.notes || null };
  if (m.id) {
    const { data, error } = await supabase.from('crew_members').update(row).eq('id', m.id).select().single();
    if (error) throw error; return data;
  } else {
    const { data, error } = await supabase.from('crew_members').insert(row).select().single();
    if (error) throw error; return data;
  }
}
export async function deleteCrewMember(id) {
  const { error } = await supabase.from('crew_members').delete().eq('id', id);
  if (error) throw error;
}

// ── Crew Documents ────────────────────────────────────────────
export async function getCrewDocuments(crewMemberId) {
  let q = supabase.from('crew_documents').select('*').order('expiry_date', { ascending: true });
  if (crewMemberId) q = q.eq('crew_member_id', crewMemberId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function saveCrewDocument(d) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = { user_id: user.id, crew_member_id: d.crew_member_id, doc_type: d.doc_type, doc_number: d.doc_number || null, issuing_country: d.issuing_country || null, issuing_authority: d.issuing_authority || null, issue_date: d.issue_date || null, expiry_date: d.expiry_date || null, raw_data: d.raw_data || {}, notes: d.notes || null };
  if (d.id) {
    const { data, error } = await supabase.from('crew_documents').update(row).eq('id', d.id).select().single();
    if (error) throw error; return data;
  } else {
    const { data, error } = await supabase.from('crew_documents').insert(row).select().single();
    if (error) throw error; return data;
  }
}
export async function deleteCrewDocument(id) {
  const { error } = await supabase.from('crew_documents').delete().eq('id', id);
  if (error) throw error;
}

// ── Flight Journey ─────────────────────────────────────────────
// Retorna todos os voos com missão vinculada (join completo para a lista de jornadas)
export async function getJourneys() {
  const user = await getUser();
  if (!user) return [];

  const [{ data: missions }, { data: flights }, { data: costs }] = await Promise.all([
    supabase.from('missions').select('*').order('date_start', { ascending: false }),
    supabase.from('flights').select('*').order('date', { ascending: false }),
    supabase.from('costs').select('id, flight_id, mission_id, amount_brl, category').order('reference_date', { ascending: false }),
  ]);

  const flightMap = {};
  (flights || []).forEach(f => { flightMap[f.id] = fromDB_flight(f); });

  const costsByFlight  = {};
  const costsByMission = {};
  (costs || []).forEach(c => {
    if (c.flight_id)  { costsByFlight[c.flight_id]   = (costsByFlight[c.flight_id]   || []).concat(c); }
    if (c.mission_id) { costsByMission[c.mission_id] = (costsByMission[c.mission_id] || []).concat(c); }
  });

  // Missões com voos vinculados
  const missionJourneys = (missions || []).map(m => {
    const mission = fromDB_mission(m);
    const linkedFlight = m.flight_id ? flightMap[m.flight_id] : null;
    const legFlights = (mission.legs || []).map(l => l.flightId ? flightMap[l.flightId] : null).filter(Boolean);

    // Status automático
    let status = mission.status || 'planned';
    if (mission.status === 'cancelled') status = 'cancelled';
    else if (linkedFlight || legFlights.length > 0) status = 'completed';
    else status = 'planned';

    const mCosts = costsByMission[mission.id] || [];
    const totalCost = mCosts.reduce((s, c) => s + parseFloat(c.amount_brl || 0), 0);

    return {
      id:           `mission-${mission.id}`,
      missionId:    mission.id,
      flightId:     linkedFlight?.id || null,
      type:         'mission',
      status,
      name:         mission.name,
      aircraftId:   mission.aircraftId,
      dateStart:    mission.dateStart,
      dateEnd:      mission.dateEnd,
      legs:         mission.legs || [],
      passengers:   mission.passengers || [],
      notes:        mission.notes,
      purpose:      mission.purpose,
      linkedFlight,
      legFlights,
      totalCost,
      cancelledAt:  m.cancelled_at,
      cancelReason: m.cancel_reason,
    };
  });

  // Voos sem missão vinculada (ad-hoc)
  const linkedFlightIds = new Set(
    (missions || []).flatMap(m => {
      const ids = [];
      if (m.flight_id) ids.push(m.flight_id);
      const missionData = fromDB_mission(m);
      (missionData.legs || []).forEach(l => { if (l.flightId) ids.push(l.flightId); });
      return ids;
    })
  );

  const adHocJourneys = (flights || [])
    .filter(f => !linkedFlightIds.has(f.id))
    .map(f => {
      const flight = fromDB_flight(f);
      const fCosts = costsByFlight[f.id] || [];
      const totalCost = fCosts.reduce((s, c) => s + parseFloat(c.amount_brl || 0), 0);
      return {
        id:         `flight-${flight.id}`,
        missionId:  null,
        flightId:   flight.id,
        type:       'adhoc',
        status:     'registered',
        name:       `${flight.departureIcao || '?'} → ${flight.destinationIcao || '?'}`,
        aircraftId: flight.aircraftId,
        dateStart:  flight.date,
        dateEnd:    flight.date,
        legs:       [],
        passengers: [],
        notes:      flight.logbookNotes,
        purpose:    flight.purpose,
        linkedFlight: flight,
        legFlights: [flight],
        totalCost,
      };
    });

  return [...missionJourneys, ...adHocJourneys]
    .sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || ''));
}

// Vincula um voo a uma missão (execução da jornada)
export async function linkFlightToMission(missionId, flightId) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  await Promise.all([
    supabase.from('missions').update({ flight_id: flightId, status: 'completed' }).eq('id', missionId),
    supabase.from('flights').update({ mission_id: missionId }).eq('id', flightId),
  ]);
}

// Cancela uma missão
export async function cancelMission(missionId, reason = '') {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  await supabase.from('missions').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancel_reason: reason || null,
  }).eq('id', missionId);
}

// Salva custo vinculado a missão E voo ao mesmo tempo
export async function saveCostForJourney(cost, missionId, flightId) {
  const enriched = {
    ...cost,
    missionId: missionId || cost.missionId || null,
    flightId:  flightId  || cost.flightId  || null,
  };
  return saveCost(enriched);
}

// Atualiza store toDB_mission e fromDB_mission para incluir novos campos
// ── Flight Journey ─────────────────────────────────────────────

// ── Aircraft Components (motores, hélices) ─────────────────────────────────
export async function getComponents(aircraftId) {
  const { data, error } = await supabase
    .from('aircraft_components')
    .select('*')
    .eq('aircraft_id', aircraftId)
    .order('installed_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, aircraftId: r.aircraft_id, type: r.component_type,
    position: r.position, manufacturer: r.manufacturer, model: r.model,
    serialNumber: r.serial_number, tboHours: r.tbo_hours, tboYears: r.tbo_years,
    installedDate: r.installed_date, installedCellHours: r.installed_cell_hours,
    tsnAtInstall: r.tsn_at_install, tsoAtInstall: r.tso_at_install,
    removedDate: r.removed_date, removedCellHours: r.removed_cell_hours,
    removedReason: r.removed_reason, status: r.status, notes: r.notes,
  }));
}

export async function saveComponent(comp) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = {
    aircraft_id: comp.aircraftId, user_id: user.id,
    component_type: comp.type, position: comp.position || null,
    manufacturer: comp.manufacturer, model: comp.model,
    serial_number: comp.serialNumber || null,
    tbo_hours: comp.tboHours || null, tbo_years: comp.tboYears || null,
    installed_date: comp.installedDate, installed_cell_hours: comp.installedCellHours || null,
    tsn_at_install: comp.tsnAtInstall || null, tso_at_install: comp.tsoAtInstall || null,
    status: comp.status || 'active', notes: comp.notes || null,
  };
  if (comp.id) {
    const { data, error } = await supabase.from('aircraft_components').update(row).eq('id', comp.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('aircraft_components').insert(row).select().single();
    if (error) throw error;
    return data;
  }
}

export async function removeComponent(id, cellHours, reason) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const { error } = await supabase.from('aircraft_components').update({
    status: 'removed',
    removed_date: new Date().toISOString().slice(0,10),
    removed_cell_hours: cellHours || null,
    removed_reason: reason || 'other',
    removed_by_user_id: user.id,
  }).eq('id', id).eq('status', 'active');
  if (error) throw error;
}

// ── Aircraft Components (motores, hélices) ─────────────────────────────────────

// ── FLIGHT CREW (tripulação por voo) ─────────────────────────────────────────
export async function getFlightCrew(flightId) {
  const { data, error } = await supabase
    .from('flight_crew').select('*, crew_member:crew_member_id(full_name, role, anac_code)')
    .eq('flight_id', flightId).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function saveFlightCrewMember(fc) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const flightDays = parseInt(fc.flight_days ?? 1) || 0;
  const groundDays = parseInt(fc.ground_days ?? 0) || 0;
  const costMode = fc.cost_mode === 'total_agreed' ? 'total_agreed' : 'per_day';
  const rateFlight = fc.rate_flight_applied !== '' && fc.rate_flight_applied != null ? parseFloat(fc.rate_flight_applied) : null;
  const rateGround = fc.rate_ground_applied !== '' && fc.rate_ground_applied != null ? parseFloat(fc.rate_ground_applied) : null;
  const perDiem    = fc.per_diem_applied    !== '' && fc.per_diem_applied    != null ? parseFloat(fc.per_diem_applied)    : null;
  const agreed     = fc.total_agreed_amount !== '' && fc.total_agreed_amount != null ? parseFloat(fc.total_agreed_amount) : null;
  const totalCost = computeFlightCrewTotal({
    cost_mode: costMode,
    flight_days: flightDays, ground_days: groundDays,
    rate_flight_applied: rateFlight, rate_ground_applied: rateGround,
    per_diem_applied: perDiem, total_agreed_amount: agreed,
  });
  const row = {
    flight_id: fc.flight_id || fc.flightId,
    crew_member_id: fc.crew_member_id || fc.crewMemberId || null,
    user_id: user.id,
    name_adhoc: fc.name_adhoc || fc.nameAdhoc || null,
    role: fc.role,
    block_out: fc.block_out || null,
    takeoff_time: fc.takeoff_time || null,
    landing_time: fc.landing_time || null,
    block_in: fc.block_in || null,
    cost_mode: costMode,
    flight_days: flightDays,
    ground_days: groundDays,
    rate_flight_applied: rateFlight,
    rate_ground_applied: rateGround,
    per_diem_applied: perDiem,
    currency: fc.currency || 'BRL',
    total_agreed_amount: agreed,
    total_cost: totalCost,
    notes: fc.notes || null,
  };
  if (fc.id) {
    const { data, error } = await supabase.from('flight_crew').update(row).eq('id', fc.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('flight_crew').insert(row).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteFlightCrewMember(id) {
  const { error } = await supabase.from('flight_crew').delete().eq('id', id);
  if (error) throw error;
}

// total_cost = (per_day)  rate_flight*flight_days + rate_ground*ground_days + per_diem*(flight+ground)
//              (agreed)   total_agreed_amount                              + per_diem*(flight+ground)
export function computeFlightCrewTotal(fc) {
  const fd = parseInt(fc.flight_days ?? 0) || 0;
  const gd = parseInt(fc.ground_days ?? 0) || 0;
  const rf = parseFloat(fc.rate_flight_applied || 0) || 0;
  const rg = parseFloat(fc.rate_ground_applied || 0) || 0;
  const pd = parseFloat(fc.per_diem_applied || 0) || 0;
  const ag = parseFloat(fc.total_agreed_amount || 0) || 0;
  const totalDays = fd + gd;
  const base = fc.cost_mode === 'total_agreed' ? ag : (rf * fd + rg * gd);
  return Math.round((base + pd * totalDays) * 100) / 100;
}

// Gera lançamentos em costs para cada tripulante do voo. Retorna número de rows criadas.
export async function generateCrewCostsForFlight({ flightId, aircraftId, flightDate, fxUsdBrl = 5.0 }) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const crewRows = await getFlightCrew(flightId);
  if (!crewRows.length) return 0;
  // Limpa lançamentos antigos auto-gerados deste voo para evitar duplicação
  await supabase.from('costs').delete()
    .eq('flight_id', flightId).eq('user_id', user.id).eq('category', 'crew')
    .ilike('description', 'auto:%');
  const costs = [];
  for (const fc of crewRows) {
    const name = fc.crew_member?.full_name || fc.name_adhoc || 'Tripulante';
    const role = (fc.role || 'crew').toUpperCase();
    const cur = fc.currency || 'BRL';
    const fx = cur === 'USD' ? (parseFloat(fxUsdBrl) || 5.0) : 1.0;
    const fd = parseInt(fc.flight_days || 0) || 0;
    const gd = parseInt(fc.ground_days || 0) || 0;
    const rf = parseFloat(fc.rate_flight_applied || 0) || 0;
    const rg = parseFloat(fc.rate_ground_applied || 0) || 0;
    const pd = parseFloat(fc.per_diem_applied || 0) || 0;
    const ag = parseFloat(fc.total_agreed_amount || 0) || 0;
    if (fc.cost_mode === 'total_agreed' && ag > 0) {
      costs.push({
        user_id: user.id, aircraft_id: aircraftId, flight_id: flightId, category: 'crew',
        cost_type: 'variable',
        amount_brl: Math.round(ag * fx * 100) / 100,
        description: `auto: Valor combinado ${role} ${name} (${cur} ${ag.toLocaleString('en-US',{maximumFractionDigits:2})}${cur==='USD'?` × ${fx.toFixed(2)}`:''})`,
        reference_date: flightDate, vendor: name, recurrence: 'once',
      });
    } else {
      if (rf > 0 && fd > 0) {
        costs.push({
          user_id: user.id, aircraft_id: aircraftId, flight_id: flightId, category: 'crew',
          cost_type: 'variable',
          amount_brl: Math.round(rf * fd * fx * 100) / 100,
          description: `auto: Diária voo ${role} ${name} (${cur} ${rf} × ${fd}d${cur==='USD'?` × ${fx.toFixed(2)}`:''})`,
          reference_date: flightDate, vendor: name, recurrence: 'once',
        });
      }
      if (rg > 0 && gd > 0) {
        costs.push({
          user_id: user.id, aircraft_id: aircraftId, flight_id: flightId, category: 'crew',
          cost_type: 'variable',
          amount_brl: Math.round(rg * gd * fx * 100) / 100,
          description: `auto: Diária solo ${role} ${name} (${cur} ${rg} × ${gd}d${cur==='USD'?` × ${fx.toFixed(2)}`:''})`,
          reference_date: flightDate, vendor: name, recurrence: 'once',
        });
      }
    }
    const totalDays = fd + gd;
    if (pd > 0 && totalDays > 0) {
      costs.push({
        user_id: user.id, aircraft_id: aircraftId, flight_id: flightId, category: 'crew',
        cost_type: 'variable',
        amount_brl: Math.round(pd * totalDays * fx * 100) / 100,
        description: `auto: Per diem ${role} ${name} (${cur} ${pd} × ${totalDays}d${cur==='USD'?` × ${fx.toFixed(2)}`:''})`,
        reference_date: flightDate, vendor: name, recurrence: 'once',
      });
    }
  }
  if (!costs.length) return 0;
  const { error } = await supabase.from('costs').insert(costs);
  if (error) throw error;
  return costs.length;
}

// ── BUDGETS / ORÇAMENTO ──────────────────────────────────────────────────────
const fromBudget = r => ({
  id: r.id, userId: r.user_id, aircraftId: r.aircraft_id,
  name: r.name, fiscalYear: r.fiscal_year, status: r.status,
  currency: r.currency, fxUsdBrl: parseFloat(r.fx_usd_brl)||0,
  fuelUsdGal: parseFloat(r.fuel_usd_gal)||0,
  contingencyPct: parseFloat(r.contingency_pct)||0,
  hoursYearAssumed: parseFloat(r.hours_year_assumed)||0,
  flightsYearAssumed: parseInt(r.flights_year_assumed)||0,
  overnightsYearAssumed: parseInt(r.overnights_year_assumed)||0,
  seasonality: r.seasonality||{}, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const fromLine = r => ({
  id: r.id, budgetId: r.budget_id, category: r.category,
  description: r.description, vendor: r.vendor,
  costType: r.cost_type, unit: r.unit,
  unitAmountBrl: parseFloat(r.unit_amount_brl)||0,
  annualQtyAssumed: parseFloat(r.annual_qty_assumed)||0,
  recurrence: r.recurrence, isActive: r.is_active,
  sortOrder: r.sort_order, notes: r.notes,
});

export async function getBudgets(aircraftId) {
  const user = await getUser();
  if (!user) return [];
  let q = supabase.from('budgets').select('*').eq('user_id', user.id).order('fiscal_year', { ascending: false });
  if (aircraftId) q = q.eq('aircraft_id', aircraftId);
  const { data, error } = await q;
  if (error) throw error;
  return (data||[]).map(fromBudget);
}

export async function getBudget(id) {
  const { data, error } = await supabase.from('budgets').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromBudget(data) : null;
}

export async function saveBudget(b) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = {
    user_id: user.id, aircraft_id: b.aircraftId,
    name: b.name, fiscal_year: b.fiscalYear, status: b.status||'active',
    fx_usd_brl: b.fxUsdBrl, fuel_usd_gal: b.fuelUsdGal,
    contingency_pct: b.contingencyPct,
    hours_year_assumed: b.hoursYearAssumed,
    flights_year_assumed: b.flightsYearAssumed,
    overnights_year_assumed: b.overnightsYearAssumed,
    seasonality: b.seasonality||{}, notes: b.notes||null,
    updated_at: new Date().toISOString(),
  };
  if (b.id) {
    const { data, error } = await supabase.from('budgets').update(row).eq('id', b.id).select().single();
    if (error) throw error;
    return fromBudget(data);
  } else {
    const { data, error } = await supabase.from('budgets').insert(row).select().single();
    if (error) throw error;
    return fromBudget(data);
  }
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function getBudgetLines(budgetId) {
  const { data, error } = await supabase.from('budget_lines').select('*').eq('budget_id', budgetId).order('cost_type').order('sort_order').order('category');
  if (error) throw error;
  return (data||[]).map(fromLine);
}

export async function saveBudgetLine(l) {
  const row = {
    budget_id: l.budgetId, category: l.category,
    description: l.description||null, vendor: l.vendor||null,
    cost_type: l.costType, unit: l.unit,
    unit_amount_brl: l.unitAmountBrl||0,
    annual_qty_assumed: l.annualQtyAssumed||null,
    recurrence: l.recurrence||null,
    is_active: l.isActive!==false,
    sort_order: l.sortOrder||0,
    notes: l.notes||null,
    updated_at: new Date().toISOString(),
  };
  if (l.id) {
    const { data, error } = await supabase.from('budget_lines').update(row).eq('id', l.id).select().single();
    if (error) throw error;
    return fromLine(data);
  } else {
    const { data, error } = await supabase.from('budget_lines').insert(row).select().single();
    if (error) throw error;
    return fromLine(data);
  }
}

export async function deleteBudgetLine(id) {
  const { error } = await supabase.from('budget_lines').delete().eq('id', id);
  if (error) throw error;
}

export async function getBudgetMonthly(budgetId) {
  const { data, error } = await supabase.from('budget_monthly').select('*').eq('budget_id', budgetId);
  if (error) throw error;
  return data || [];
}

// Regenera budget_monthly a partir das linhas (distribui anual /12, mensal ×1, variável anual_qty/12)
export async function regenerateBudgetMonthly(budgetId) {
  const b = await getBudget(budgetId);
  if (!b) throw new Error('Orçamento não encontrado');
  const lines = await getBudgetLines(budgetId);
  const seas = b.seasonality || {};
  // Limpa monthly existente
  await supabase.from('budget_monthly').delete().eq('budget_id', budgetId);
  const rows = [];
  for (const l of lines) {
    if (!l.isActive) continue;
    for (let m = 1; m <= 12; m++) {
      const factor = parseFloat(seas[m]) || 1.0;
      let planned = 0;
      if (l.unit === 'annual') planned = l.unitAmountBrl / 12;
      else if (l.unit === 'monthly') planned = l.unitAmountBrl;
      else planned = l.unitAmountBrl * (l.annualQtyAssumed/12) * factor;
      rows.push({ budget_id: budgetId, line_id: l.id, month: m, planned_brl: Math.round(planned*100)/100 });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('budget_monthly').insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

// Clonar orçamento para outro ano com inflação aplicada
export async function cloneBudget(sourceId, targetYear, inflationPct = 0.04, fxAdjustPct = 0.02) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const src = await getBudget(sourceId);
  if (!src) throw new Error('Orçamento de origem não encontrado');
  const lines = await getBudgetLines(sourceId);
  const replaced = src.name.replace(String(src.fiscalYear), String(targetYear));
  const newName = replaced !== src.name ? replaced : `${src.name} (${targetYear})`;
  const newBudget = await saveBudget({
    aircraftId: src.aircraftId,
    name: newName,
    fiscalYear: targetYear,
    status: 'draft',
    fxUsdBrl: +(src.fxUsdBrl * (1 + fxAdjustPct)).toFixed(2),
    fuelUsdGal: src.fuelUsdGal,
    contingencyPct: src.contingencyPct,
    hoursYearAssumed: src.hoursYearAssumed,
    flightsYearAssumed: src.flightsYearAssumed,
    overnightsYearAssumed: src.overnightsYearAssumed,
    seasonality: src.seasonality,
    notes: `Clonado de "${src.name}" com inflação ${(inflationPct*100).toFixed(1)}% e ajuste cambial ${(fxAdjustPct*100).toFixed(1)}% aplicados.`,
  });
  for (const l of lines) {
    await saveBudgetLine({
      budgetId: newBudget.id,
      category: l.category,
      description: l.description,
      vendor: l.vendor,
      costType: l.costType,
      unit: l.unit,
      unitAmountBrl: +(l.unitAmountBrl * (1 + inflationPct)).toFixed(2),
      annualQtyAssumed: l.annualQtyAssumed,
      recurrence: l.recurrence,
      isActive: l.isActive,
      sortOrder: l.sortOrder,
    });
  }
  await regenerateBudgetMonthly(newBudget.id);
  return newBudget;
}

// ── Company branding (perfil da gestora para relatórios) ─────────────────────
export async function getCompanyProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_settings').select('profile')
    .eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return (data?.profile?.company) || {
    name: '', cnpj: '', address: '', phone: '', email: '',
    website: '', primary_color: '#4a9eff', logo_url: '', footer_text: '',
  };
}

export async function saveCompanyProfile(company) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  // Read existing profile, merge, write back
  const { data: existing } = await supabase
    .from('user_settings').select('id, profile').eq('user_id', user.id).maybeSingle();
  const merged = { ...(existing?.profile||{}), company };
  if (existing?.id) {
    const { error } = await supabase.from('user_settings')
      .update({ profile: merged, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_settings')
      .insert({ user_id: user.id, profile: merged });
    if (error) throw error;
  }
  return company;
}

export async function uploadCompanyLogo(file) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  if (!file) throw new Error('Arquivo inválido');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${user.id}/logo-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('logos').upload(path, file, {
    cacheControl: '3600', upsert: true, contentType: file.type,
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  return data?.publicUrl || null;
}

// Envia email do followup via edge function send-budget-email
export async function sendBudgetEmail({ budgetId, recipientEmail, pdfBase64, pdfFilename }) {
  const { data, error } = await supabase.functions.invoke('send-budget-email', {
    body: { budgetId, recipientEmail, pdfBase64, pdfFilename },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error + (data.detail ? ' — '+JSON.stringify(data.detail) : ''));
  return data;
}

// Dispara o snapshot mensal via RPC (mesma função que o cron usa)
export async function runBudgetSnapshot() {
  const { data, error } = await supabase.rpc('run_budget_snapshot');
  if (error) throw error;
  return data;
}

// Histórico de snapshots congelados
export async function getBudgetSnapshots(budgetId) {
  const { data, error } = await supabase
    .from('budget_snapshots').select('*')
    .eq('budget_id', budgetId)
    .order('snapshot_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Followup: planejado vs realizado por mês e categoria
export async function getBudgetFollowup(budgetId) {
  const b = await getBudget(budgetId);
  if (!b) return null;
  const lines = await getBudgetLines(budgetId);
  const monthly = await getBudgetMonthly(budgetId);
  // Realizado: agregação dos costs reais por mês × categoria, no fiscal_year, para a aeronave do budget
  let actualsByMonthCat = {};
  if (b.aircraftId) {
    const start = `${b.fiscalYear}-01-01`;
    const end = `${b.fiscalYear}-12-31`;
    const { data: actuals, error } = await supabase
      .from('costs')
      .select('category, amount_brl, reference_date')
      .eq('aircraft_id', b.aircraftId)
      .gte('reference_date', start)
      .lte('reference_date', end);
    if (error) throw error;
    for (const c of (actuals||[])) {
      const m = parseInt(c.reference_date?.slice(5,7));
      if (!m) continue;
      const key = `${m}|${c.category}`;
      actualsByMonthCat[key] = (actualsByMonthCat[key]||0) + parseFloat(c.amount_brl||0);
    }
  }
  // Agrupar planejado por mês × categoria
  const linesById = Object.fromEntries(lines.map(l => [l.id, l]));
  const plannedByMonthCat = {};
  for (const bm of monthly) {
    const l = linesById[bm.line_id];
    if (!l) continue;
    const key = `${bm.month}|${l.category}`;
    plannedByMonthCat[key] = (plannedByMonthCat[key]||0) + parseFloat(bm.planned_brl||0);
  }
  // Construir tabela: categorias únicas × 12 meses
  const categories = [...new Set(lines.map(l => l.category))].sort();
  const table = categories.map(cat => {
    const row = { category: cat, months: [], plannedTotal: 0, actualTotal: 0 };
    for (let m = 1; m <= 12; m++) {
      const p = plannedByMonthCat[`${m}|${cat}`] || 0;
      const a = actualsByMonthCat[`${m}|${cat}`] || 0;
      row.months.push({ month: m, planned: p, actual: a, variance: a - p, pct: p > 0 ? ((a/p - 1)*100) : null });
      row.plannedTotal += p;
      row.actualTotal += a;
    }
    row.varianceTotal = row.actualTotal - row.plannedTotal;
    row.pctTotal = row.plannedTotal > 0 ? ((row.actualTotal/row.plannedTotal - 1)*100) : null;
    return row;
  });
  return { budget: b, categories, table };
}

