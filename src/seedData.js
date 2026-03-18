import { supabase } from './supabase';
import { getUser } from './store';

// ─────────────────────────────────────────────────────────────
// SEED DATA v2 — robusto, sem duplicatas, independente por seção
// ─────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

async function upsertAircraft(uid, data) {
  const { data: ex } = await supabase.from('aircraft').select('id').eq('user_id', uid).eq('registration', data.registration).maybeSingle();
  if (ex) return ex;
  const { data: c, error } = await supabase.from('aircraft').insert({ user_id: uid, ...data }).select('id,registration').single();
  if (error) throw new Error(`Aircraft ${data.registration}: ${error.message}`);
  return c;
}

async function insertFlight(uid, data) {
  const { data: ex } = await supabase.from('flights').select('id').eq('user_id', uid).eq('aircraft_id', data.aircraft_id).eq('date', data.date).eq('departure_icao', data.departure_icao).eq('destination_icao', data.destination_icao).maybeSingle();
  if (ex) return ex;
  const { data: c, error } = await supabase.from('flights').insert({ user_id: uid, source: 'manual', ...data }).select('id').single();
  if (error) throw new Error(`Flight ${data.date}: ${error.message}`);
  return c;
}

async function insertCost(uid, data) {
  const { data: c, error } = await supabase.from('costs').insert({ user_id: uid, ...data }).select('id').single();
  if (error) throw new Error(`Cost: ${error.message}`);
  return c;
}

async function insertMX(uid, data) {
  const { data: ex } = await supabase.from('maintenance').select('id').eq('user_id', uid).eq('aircraft_id', data.aircraft_id).eq('name', data.name).maybeSingle();
  if (ex) return ex;
  const { data: c, error } = await supabase.from('maintenance').insert({ user_id: uid, ...data }).select('id').single();
  if (error) throw new Error(`MX ${data.name}: ${error.message}`);
  return c;
}

async function insertMission(uid, data) {
  const { data: ex } = await supabase.from('missions').select('id').eq('user_id', uid).eq('name', data.name).maybeSingle();
  if (ex) return ex;
  const { data: c, error } = await supabase.from('missions').insert({ user_id: uid, ...data }).select('id').single();
  if (error) throw new Error(`Mission: ${error.message}`);
  return c;
}

async function upsertCrew(uid, data) {
  const { data: ex } = await supabase.from('crew_members').select('id').eq('user_id', uid).eq('full_name', data.full_name).maybeSingle();
  if (ex) return ex;
  const { data: c, error } = await supabase.from('crew_members').insert({ user_id: uid, ...data }).select('id').single();
  if (error) throw new Error(`Crew ${data.full_name}: ${error.message}`);
  return c;
}

async function insertDoc(uid, data) {
  const { data: ex } = await supabase.from('crew_documents').select('id').eq('user_id', uid).eq('crew_member_id', data.crew_member_id).eq('doc_type', data.doc_type).maybeSingle();
  if (ex) return ex;
  await supabase.from('crew_documents').insert({ user_id: uid, ...data });
}

async function insertFuel(uid, data) {
  await supabase.from('fuel_prices').insert({ user_id: uid, ...data });
}

// ═════════════════════════════════════════════════════════════
export async function seedDemoData(onProgress) {
  const user = await getUser();
  if (!user) throw new Error('Faça login antes de carregar os dados de exemplo.');
  const uid = user.id;
  const log = (msg) => { console.log(msg); onProgress?.(msg); };
  const res = { aircraft:0, crew:0, flights:0, costs:0, maintenance:0, missions:0, fuel:0, errors:[] };

  // ── 1. AERONAVES ──────────────────────────────────────────
  log('✈ Criando aeronaves...');
  let ac1, ac2, ac3, ac4;

  try { ac1 = await upsertAircraft(uid, { registration:'PS-YNC', type:'experimental', manufacturer:'Extra Aircraft', model:'300/SC', year:2008, engine_model:'Lycoming AEIO-580-B1A', engine_tbo_hours:1800, prop_model:'MT-Propeller MTV-9-B-C', prop_tbo_hours:1200, base_airframe_hours:892, total_flight_hours:312, total_engine_hours:312, total_cycles:580, fuel_type:'avgas_100ll', fuel_capacity_liters:224, home_base:'SDUN', monthly_fixed:2800, performance_profiles:[{altFt:2000,power:91,ktas:196,fuelLph:55},{altFt:4000,power:75,ktas:185,fuelLph:48.5},{altFt:6000,power:65,ktas:175,fuelLph:43.2}], is_active:true }); res.aircraft++; } catch(e) { res.errors.push(e.message); }
  try { ac2 = await upsertAircraft(uid, { registration:'PR-VCO', type:'multi_engine', manufacturer:'Piper', model:'Seneca V', year:2005, engine_model:'Continental TSIO-360-RB (x2)', engine_tbo_hours:1800, prop_model:'Hartzell HC-E3YR', prop_tbo_hours:2000, base_airframe_hours:3240, total_flight_hours:680, total_engine_hours:680, total_cycles:890, fuel_type:'avgas_100ll', fuel_capacity_liters:340, home_base:'SBJD', monthly_fixed:6500, performance_profiles:[{altFt:4000,power:75,ktas:168,fuelLph:68},{altFt:8000,power:75,ktas:180,fuelLph:65}], is_active:true }); res.aircraft++; } catch(e) { res.errors.push(e.message); }
  try { ac3 = await upsertAircraft(uid, { registration:'PT-OXE', type:'single_engine', manufacturer:'Pilatus', model:'PC-12/47E', year:2018, engine_model:'Pratt & Whitney PT6A-67P', engine_tbo_hours:3600, prop_model:'Hartzell HC-E5A-3D', prop_tbo_hours:3600, base_airframe_hours:1820, total_flight_hours:420, total_engine_hours:420, total_cycles:510, fuel_type:'jet_a1', fuel_capacity_liters:1454, home_base:'SBKP', monthly_fixed:28000, performance_profiles:[{altFt:15000,power:100,ktas:280,fuelLph:195},{altFt:25000,power:100,ktas:310,fuelLph:180}], is_active:true }); res.aircraft++; } catch(e) { res.errors.push(e.message); }
  try { ac4 = await upsertAircraft(uid, { registration:'PS-GVX', type:'multi_engine', manufacturer:'Gulfstream', model:'G550', year:2014, engine_model:'Rolls-Royce BR710C4-11 (x2)', engine_tbo_hours:6000, base_airframe_hours:4200, total_flight_hours:890, total_engine_hours:890, total_cycles:420, fuel_type:'jet_a1', fuel_capacity_liters:18870, home_base:'SBGR', monthly_fixed:185000, performance_profiles:[{altFt:35000,power:100,ktas:488,fuelLph:1280},{altFt:41000,power:100,ktas:459,fuelLph:1050}], is_active:true }); res.aircraft++; } catch(e) { res.errors.push(e.message); }
  log(`✓ ${res.aircraft} aeronave(s)`);

  // ── 2. TRIPULAÇÃO ─────────────────────────────────────────
  log('👨‍✈️ Criando tripulação...');
  let p1, p2, p3, mgr, p4, p5, mec;

  try { p1 = await upsertCrew(uid, { full_name:'YANCOVITZ, Victor Borioli', display_name:'Victor', role:'captain', nationality:'Brazil', dob:'1989-12-25', anac_code:'128972', is_self:true, notes:'Piloto proprietário' }); res.crew++;
    if (p1) { await insertDoc(uid, { crew_member_id:p1.id, doc_type:'passport', doc_number:'FX883299', issuing_country:'Brazil', issue_date:'2019-01-11', expiry_date:'2029-01-10', raw_data:{} }); await insertDoc(uid, { crew_member_id:p1.id, doc_type:'anac_license', doc_number:'15530', issuing_authority:'ANAC', expiry_date:'2026-04-24', raw_data:{anac_code:'128972', medical_class:'Primeira', ratings:[{type:'GV',expiry_date:'2026-02-28'},{type:'IFRA',expiry_date:'2026-02-28'},{type:'MLTE',expiry_date:'2027-03-31'},{type:'MNTE',expiry_date:'2027-03-31'}]} }); await insertDoc(uid, { crew_member_id:p1.id, doc_type:'foreign_validation', doc_number:'PT-9RWMM', issuing_country:'UAE', issuing_authority:'GCAA', issue_date:'2025-10-20', expiry_date:'2026-04-19', raw_data:{aircraft_type:'G-V',operator:'Rotana Jet Aviation'} }); }
  } catch(e) { res.errors.push(e.message); }

  try { p2 = await upsertCrew(uid, { full_name:'SANTOS, Ricardo Mendes', role:'captain', nationality:'Brazil', dob:'1978-06-14', anac_code:'087432', notes:'PIC Seneca V' }); res.crew++;
    if (p2) { await insertDoc(uid, { crew_member_id:p2.id, doc_type:'passport', doc_number:'GX445512', issuing_country:'Brazil', expiry_date:'2030-03-15', raw_data:{} }); await insertDoc(uid, { crew_member_id:p2.id, doc_type:'anac_license', doc_number:'09821', issuing_authority:'ANAC', expiry_date:'2025-11-30', raw_data:{anac_code:'087432',medical_class:'Segunda',ratings:[{type:'IFRA',expiry_date:'2025-11-30'},{type:'MNTE',expiry_date:'2026-04-15'}]} }); await insertDoc(uid, { crew_member_id:p2.id, doc_type:'medical', issuing_authority:'ANAC', expiry_date:'2025-11-30', raw_data:{medical_class:'Segunda'} }); }
  } catch(e) { res.errors.push(e.message); }

  try { p3 = await upsertCrew(uid, { full_name:'OLIVEIRA, Fernanda Castro', role:'captain', nationality:'Brazil', dob:'1985-03-22', anac_code:'112045', notes:'PIC PC-12' }); res.crew++;
    if (p3) { await insertDoc(uid, { crew_member_id:p3.id, doc_type:'passport', doc_number:'HY228833', issuing_country:'Brazil', expiry_date:'2031-07-08', raw_data:{} }); await insertDoc(uid, { crew_member_id:p3.id, doc_type:'anac_license', doc_number:'18834', issuing_authority:'ANAC', expiry_date:'2026-08-31', raw_data:{anac_code:'112045',medical_class:'Primeira',ratings:[{type:'IFRA',expiry_date:'2026-08-31'},{type:'MLTE',expiry_date:'2026-08-31'}]} }); }
  } catch(e) { res.errors.push(e.message); }

  try { mgr = await upsertCrew(uid, { full_name:'AZEVEDO, Henrique Monteiro', role:'dispatcher', nationality:'Brazil', dob:'1966-11-30', notes:'Diretor de Operações G550 — não piloto' }); res.crew++;
    if (mgr) { await insertDoc(uid, { crew_member_id:mgr.id, doc_type:'passport', doc_number:'FZ119900', issuing_country:'Brazil', expiry_date:'2028-05-20', raw_data:{} }); }
  } catch(e) { res.errors.push(e.message); }

  try { p4 = await upsertCrew(uid, { full_name:'RODRIGUES, Alexandre Costa', role:'captain', nationality:'Brazil', dob:'1975-09-08', anac_code:'054321', notes:'PIC G550' }); res.crew++;
    if (p4) { await insertDoc(uid, { crew_member_id:p4.id, doc_type:'passport', doc_number:'HX334455', issuing_country:'Brazil', expiry_date:'2032-02-14', raw_data:{} }); await insertDoc(uid, { crew_member_id:p4.id, doc_type:'anac_license', doc_number:'07712', issuing_authority:'ANAC', expiry_date:'2026-12-15', raw_data:{anac_code:'054321',medical_class:'Primeira',ratings:[{type:'GV',expiry_date:'2026-12-15'},{type:'IFRA',expiry_date:'2026-12-15'},{type:'MLTE',expiry_date:'2026-12-15'}]} }); }
  } catch(e) { res.errors.push(e.message); }

  try { p5 = await upsertCrew(uid, { full_name:'PEREIRA, Camila Torres', role:'fo', nationality:'Brazil', dob:'1990-04-17', anac_code:'145678', notes:'SIC G550' }); res.crew++;
    if (p5) { await insertDoc(uid, { crew_member_id:p5.id, doc_type:'passport', doc_number:'HY556677', issuing_country:'Brazil', expiry_date:'2029-11-03', raw_data:{} }); await insertDoc(uid, { crew_member_id:p5.id, doc_type:'anac_license', doc_number:'22134', issuing_authority:'ANAC', expiry_date:'2026-06-30', raw_data:{anac_code:'145678',medical_class:'Primeira',ratings:[{type:'GV',expiry_date:'2026-06-30'},{type:'IFRA',expiry_date:'2026-06-30'}]} }); }
  } catch(e) { res.errors.push(e.message); }

  try { mec = await upsertCrew(uid, { full_name:'LIMA, José Augusto Ferreira', role:'cabin', nationality:'Brazil', dob:'1972-07-05', notes:'Mecânico de bordo G550' }); res.crew++;
    if (mec) { await insertDoc(uid, { crew_member_id:mec.id, doc_type:'passport', doc_number:'GZ778899', issuing_country:'Brazil', expiry_date:'2027-09-11', raw_data:{} }); }
  } catch(e) { res.errors.push(e.message); }

  log(`✓ ${res.crew} tripulante(s)`);

  // ── 3. VOOS ───────────────────────────────────────────────
  log('🛫 Criando voos...');
  const flights = [
    // PS-YNC — Extra 300 (acrobacia + passeios)
    ...(ac1?[
      {aircraft_id:ac1.id,date:daysAgo(4), departure_icao:'SDUN',destination_icao:'SDUN',flight_time_minutes:72, flight_time_day:72, cycles:4,fuel_added_liters:42, fuel_price_per_liter:9.20,flight_conditions:'vfr',purpose:'training', logbook_notes:'Acrobático — figuras básicas'},
      {aircraft_id:ac1.id,date:daysAgo(16),departure_icao:'SDUN',destination_icao:'SBBH',flight_time_minutes:95, flight_time_day:95, distance_nm:88,cycles:1,fuel_added_liters:58, fuel_price_per_liter:9.40,flight_conditions:'vfr',purpose:'leisure'},
      {aircraft_id:ac1.id,date:daysAgo(19),departure_icao:'SBBH',destination_icao:'SDUN',flight_time_minutes:92, flight_time_day:92, distance_nm:88,cycles:1,fuel_added_liters:56, fuel_price_per_liter:9.40,flight_conditions:'vfr',purpose:'leisure'},
      {aircraft_id:ac1.id,date:daysAgo(55),departure_icao:'SDUN',destination_icao:'SBSP',flight_time_minutes:48, flight_time_day:48, distance_nm:40,cycles:1,fuel_added_liters:30, fuel_price_per_liter:9.10,flight_conditions:'vfr',purpose:'business'},
      {aircraft_id:ac1.id,date:daysAgo(58),departure_icao:'SBSP',destination_icao:'SDUN',flight_time_minutes:52, flight_time_day:52, distance_nm:40,cycles:1,fuel_added_liters:32, fuel_price_per_liter:9.10,flight_conditions:'vfr',purpose:'business'},
      {aircraft_id:ac1.id,date:daysAgo(90),departure_icao:'SDUN',destination_icao:'SDUN',flight_time_minutes:60, flight_time_day:60, cycles:3,fuel_added_liters:36, fuel_price_per_liter:8.95,flight_conditions:'vfr',purpose:'training'},
    ]:[]),
    // PR-VCO — Seneca V (IFR negócios)
    ...(ac2?[
      {aircraft_id:ac2.id,date:daysAgo(3), departure_icao:'SBJD',destination_icao:'SBPA',flight_time_minutes:210,flight_time_day:150,flight_time_night:60,flight_time_ifr:210,distance_nm:295,cycles:1,fuel_added_liters:198,fuel_price_per_liter:8.60,flight_conditions:'ifr',purpose:'business',cruise_altitude_ft:10000},
      {aircraft_id:ac2.id,date:daysAgo(5), departure_icao:'SBPA',destination_icao:'SBJD',flight_time_minutes:205,flight_time_day:205,flight_time_ifr:205,distance_nm:295,cycles:1,fuel_added_liters:192,fuel_price_per_liter:8.75,flight_conditions:'ifr',purpose:'business'},
      {aircraft_id:ac2.id,date:daysAgo(22),departure_icao:'SBJD',destination_icao:'SBRP',flight_time_minutes:88, flight_time_day:88, distance_nm:98, cycles:1,fuel_added_liters:98, fuel_price_per_liter:8.50,flight_conditions:'vfr',purpose:'business'},
      {aircraft_id:ac2.id,date:daysAgo(24),departure_icao:'SBRP',destination_icao:'SBJD',flight_time_minutes:92, flight_time_day:92, distance_nm:98, cycles:1,fuel_added_liters:102,fuel_price_per_liter:8.50,flight_conditions:'vfr',purpose:'business'},
      {aircraft_id:ac2.id,date:daysAgo(60),departure_icao:'SBJD',destination_icao:'SBFL',flight_time_minutes:185,flight_time_day:185,flight_time_ifr:100,distance_nm:258,cycles:1,fuel_added_liters:178,fuel_price_per_liter:8.40,flight_conditions:'ifr',purpose:'leisure',cruise_altitude_ft:9000},
      {aircraft_id:ac2.id,date:daysAgo(62),departure_icao:'SBFL',destination_icao:'SBJD',flight_time_minutes:180,flight_time_day:180,flight_time_ifr:90, distance_nm:258,cycles:1,fuel_added_liters:172,fuel_price_per_liter:8.40,flight_conditions:'ifr',purpose:'leisure'},
    ]:[]),
    // PT-OXE — PC-12 (regionais + internacional)
    ...(ac3?[
      {aircraft_id:ac3.id,date:daysAgo(4), departure_icao:'SBKP',destination_icao:'SBCT',flight_time_minutes:75, flight_time_day:75, flight_time_ifr:75, distance_nm:195,  cycles:1,fuel_added_liters:225,fuel_price_per_liter:7.20,flight_conditions:'ifr',purpose:'business',cruise_altitude_ft:25000},
      {aircraft_id:ac3.id,date:daysAgo(7), departure_icao:'SBCT',destination_icao:'SBKP',flight_time_minutes:78, flight_time_day:78, flight_time_ifr:78, distance_nm:195,  cycles:1,fuel_added_liters:230,fuel_price_per_liter:7.20,flight_conditions:'ifr',purpose:'business'},
      {aircraft_id:ac3.id,date:daysAgo(25),departure_icao:'SBKP',destination_icao:'SCEL',flight_time_minutes:295,flight_time_day:200,flight_time_night:95,flight_time_ifr:295,distance_nm:1680,cycles:1,fuel_added_liters:810,fuel_price_per_liter:6.90,flight_conditions:'ifr',purpose:'business',cruise_altitude_ft:28000},
      {aircraft_id:ac3.id,date:daysAgo(29),departure_icao:'SCEL',destination_icao:'SBKP',flight_time_minutes:310,flight_time_day:310,flight_time_ifr:310,distance_nm:1680,cycles:1,fuel_added_liters:840,fuel_price_per_liter:6.85,flight_conditions:'ifr',purpose:'business'},
      {aircraft_id:ac3.id,date:daysAgo(75),departure_icao:'SBKP',destination_icao:'SBCY',flight_time_minutes:145,flight_time_day:145,flight_time_ifr:145,distance_nm:620,  cycles:1,fuel_added_liters:398,fuel_price_per_liter:7.10,flight_conditions:'ifr',purpose:'transport',cruise_altitude_ft:27000},
      {aircraft_id:ac3.id,date:daysAgo(77),departure_icao:'SBCY',destination_icao:'SBKP',flight_time_minutes:140,flight_time_day:100,flight_time_night:40,flight_time_ifr:140,distance_nm:620,cycles:1,fuel_added_liters:385,fuel_price_per_liter:7.10,flight_conditions:'ifr',purpose:'transport'},
    ]:[]),
    // PS-GVX — G550 (intercontinental)
    ...(ac4?[
      {aircraft_id:ac4.id,date:daysAgo(7), departure_icao:'SBGR',destination_icao:'KOPF',flight_time_minutes:570,flight_time_day:300,flight_time_night:270,flight_time_ifr:570,distance_nm:3840,cycles:1,fuel_added_liters:14200,fuel_price_per_liter:5.80,flight_conditions:'ifr',purpose:'business',cruise_altitude_ft:45000},
      {aircraft_id:ac4.id,date:daysAgo(12),departure_icao:'KOPF',destination_icao:'SBGR',flight_time_minutes:590,flight_time_day:400,flight_time_night:190,flight_time_ifr:590,distance_nm:3840,cycles:1,fuel_added_liters:14800,fuel_price_per_liter:5.95,flight_conditions:'ifr',purpose:'business'},
      {aircraft_id:ac4.id,date:daysAgo(40),departure_icao:'SBGR',destination_icao:'LIRF',flight_time_minutes:755,flight_time_day:400,flight_time_night:355,flight_time_ifr:755,distance_nm:5210,cycles:1,fuel_added_liters:17800,fuel_price_per_liter:6.10,flight_conditions:'ifr',purpose:'business',cruise_altitude_ft:45000},
      {aircraft_id:ac4.id,date:daysAgo(46),departure_icao:'LIRF',destination_icao:'SBGR',flight_time_minutes:780,flight_time_day:500,flight_time_night:280,flight_time_ifr:780,distance_nm:5210,cycles:1,fuel_added_liters:18200,fuel_price_per_liter:6.20,flight_conditions:'ifr',purpose:'business'},
      {aircraft_id:ac4.id,date:daysAgo(95),departure_icao:'SBGR',destination_icao:'MMTO',flight_time_minutes:480,flight_time_day:480,flight_time_ifr:480,distance_nm:3220,cycles:1,fuel_added_liters:13400,fuel_price_per_liter:5.75,flight_conditions:'ifr',purpose:'business',cruise_altitude_ft:43000},
      {aircraft_id:ac4.id,date:daysAgo(98),departure_icao:'MMTO',destination_icao:'SBGR',flight_time_minutes:500,flight_time_day:300,flight_time_night:200,flight_time_ifr:500,distance_nm:3220,cycles:1,fuel_added_liters:13800,fuel_price_per_liter:5.70,flight_conditions:'ifr',purpose:'business'},
    ]:[]),
  ];
  for (const f of flights) { try { await insertFlight(uid, f); res.flights++; } catch(e) { res.errors.push(e.message); } }
  log(`✓ ${res.flights} voo(s)`);

  // ── 4. PREÇOS DE COMBUSTÍVEL ──────────────────────────────
  log('⛽ Criando preços de combustível...');
  const fuels = [
    {icao:'SDUN',fuel_type:'avgas_100ll',price_per_liter:9.20,liters:42,   date:daysAgo(4),  vendor:'Posto SDUN'},
    {icao:'SBBH',fuel_type:'avgas_100ll',price_per_liter:9.40,liters:58,   date:daysAgo(16), vendor:'Posto SBBH'},
    {icao:'SBSP',fuel_type:'avgas_100ll',price_per_liter:9.10,liters:30,   date:daysAgo(55), vendor:'Shell SBSP'},
    {icao:'SBJD',fuel_type:'avgas_100ll',price_per_liter:8.50,liters:98,   date:daysAgo(22), vendor:'Posto SBJD'},
    {icao:'SBPA',fuel_type:'avgas_100ll',price_per_liter:8.75,liters:192,  date:daysAgo(5),  vendor:'Shell SBPA'},
    {icao:'SBFL',fuel_type:'avgas_100ll',price_per_liter:8.40,liters:178,  date:daysAgo(60), vendor:'Air BP SBFL'},
    {icao:'SBCT',fuel_type:'jet_a1',     price_per_liter:7.20,liters:225,  date:daysAgo(4),  vendor:'Air BP SBCT'},
    {icao:'SBKP',fuel_type:'jet_a1',     price_per_liter:7.15,liters:840,  date:daysAgo(29), vendor:'Air BP SBKP'},
    {icao:'SCEL',fuel_type:'jet_a1',     price_per_liter:6.90,liters:810,  date:daysAgo(25), vendor:'DGAC Chile'},
    {icao:'SBGR',fuel_type:'jet_a1',     price_per_liter:6.95,liters:1800, date:daysAgo(90), vendor:'Shell SBGR'},
    {icao:'KOPF',fuel_type:'jet_a1',     price_per_liter:5.80,liters:14200,date:daysAgo(7),  vendor:'World Fuel KOPF'},
    {icao:'LIRF',fuel_type:'jet_a1',     price_per_liter:6.10,liters:17800,date:daysAgo(40), vendor:'Eni LIRF'},
    {icao:'MMTO',fuel_type:'jet_a1',     price_per_liter:5.75,liters:13400,date:daysAgo(95), vendor:'Interjet FBO'},
  ];
  for (const f of fuels) { try { await insertFuel(uid, f); res.fuel++; } catch(e) { res.errors.push(e.message); } }
  log(`✓ ${res.fuel} preço(s) de combustível`);

  // ── 5. CUSTOS ─────────────────────────────────────────────
  log('💰 Criando custos...');
  const costs = [
    // PS-YNC
    ...(ac1?[
      {aircraft_id:ac1.id,category:'fuel',         cost_type:'variable',amount_brl:386.40,  description:'AVGAS 42L @ R$9,20 — SDUN',          reference_date:daysAgo(4),  vendor:'Posto SDUN'},
      {aircraft_id:ac1.id,category:'insurance',    cost_type:'fixed',   amount_brl:1250.00, description:'Seguro casco mensal — aerobático',    reference_date:daysAgo(10), vendor:'HDI Seguros'},
      {aircraft_id:ac1.id,category:'hangar',       cost_type:'fixed',   amount_brl:980.00,  description:'Hangar mensal — SDUN',               reference_date:daysAgo(10)},
      {aircraft_id:ac1.id,category:'scheduled_mx', cost_type:'variable',amount_brl:4800.00, description:'Inspeção 100h — motor e airframe',    reference_date:daysAgo(45), vendor:'Aerosul MX'},
      {aircraft_id:ac1.id,category:'engine_reserve',cost_type:'variable',amount_brl:1560.00,description:'Reserva TBO motor 312h × R$5/h',      reference_date:daysAgo(30)},
    ]:[]),
    // PR-VCO
    ...(ac2?[
      {aircraft_id:ac2.id,category:'fuel',         cost_type:'variable',amount_brl:1702.80, description:'AVGAS 198L @ R$8,60 — SBPA',         reference_date:daysAgo(3),  vendor:'Shell SBPA'},
      {aircraft_id:ac2.id,category:'hangar',       cost_type:'fixed',   amount_brl:3200.00, description:'Hangar mensal — SBJD',               reference_date:daysAgo(8)},
      {aircraft_id:ac2.id,category:'insurance',    cost_type:'fixed',   amount_brl:4800.00, description:'Seguro casco mensal — bimotor IFR',  reference_date:daysAgo(8),  vendor:'Tokio Marine'},
      {aircraft_id:ac2.id,category:'scheduled_mx', cost_type:'variable',amount_brl:9500.00, description:'Revisão anual — 2 motores',          reference_date:daysAgo(50), vendor:'Cenic Aviation'},
      {aircraft_id:ac2.id,category:'nav_fees',     cost_type:'variable',amount_brl:280.00,  description:'Taxa navegação IFR SBPA/SBJD',       reference_date:daysAgo(3)},
      {aircraft_id:ac2.id,category:'engine_reserve',cost_type:'variable',amount_brl:6800.00,description:'Reserva TBO — 2 motores × 680h',     reference_date:daysAgo(30)},
    ]:[]),
    // PT-OXE
    ...(ac3?[
      {aircraft_id:ac3.id,category:'fuel',         cost_type:'variable',amount_brl:1620.00, description:'Jet-A1 225L @ R$7,20 — SBCT',        reference_date:daysAgo(4),  vendor:'Air BP SBCT'},
      {aircraft_id:ac3.id,category:'hangar',       cost_type:'fixed',   amount_brl:8500.00, description:'Hangar mensal — SBKP',               reference_date:daysAgo(8)},
      {aircraft_id:ac3.id,category:'insurance',    cost_type:'fixed',   amount_brl:18000.00,description:'Seguro casco mensal — PC-12',        reference_date:daysAgo(8),  vendor:'Swiss Re'},
      {aircraft_id:ac3.id,category:'crew',         cost_type:'fixed',   amount_brl:22000.00,description:'Pro-rata piloto — Fernanda Castro',  reference_date:daysAgo(8)},
      {aircraft_id:ac3.id,category:'scheduled_mx', cost_type:'variable',amount_brl:32000.00,description:'Inspeção C — Pilatus Service Center',reference_date:daysAgo(85), vendor:'Pilatus SC SP'},
      {aircraft_id:ac3.id,category:'nav_fees',     cost_type:'variable',amount_brl:1850.00, description:'Sobrevoo Chile — taxa internacional', reference_date:daysAgo(25), vendor:'DGAC Chile'},
    ]:[]),
    // PS-GVX
    ...(ac4?[
      {aircraft_id:ac4.id,category:'fuel',         cost_type:'variable',amount_brl:82360.00, description:'Jet-A1 14.200L @ R$5,80 — KOPF',    reference_date:daysAgo(7),  vendor:'World Fuel KOPF'},
      {aircraft_id:ac4.id,category:'hangar',       cost_type:'fixed',   amount_brl:42000.00, description:'Hangar mensal — SBGR executivo',    reference_date:daysAgo(8)},
      {aircraft_id:ac4.id,category:'insurance',    cost_type:'fixed',   amount_brl:95000.00, description:'Seguro casco mensal — G550',        reference_date:daysAgo(8),  vendor:'Marsh Aviation'},
      {aircraft_id:ac4.id,category:'crew',         cost_type:'fixed',   amount_brl:68000.00, description:'Tripulação mensal — PIC+SIC+MEC',   reference_date:daysAgo(8)},
      {aircraft_id:ac4.id,category:'scheduled_mx', cost_type:'variable',amount_brl:185000.00,description:'Phase 4C — Gulfstream Service Ctr', reference_date:daysAgo(100),vendor:'Gulfstream Savannah'},
      {aircraft_id:ac4.id,category:'airport_fees', cost_type:'variable',amount_brl:12400.00, description:'Handling + overflight LIRF',        reference_date:daysAgo(40), vendor:'Aeroporti di Roma'},
      {aircraft_id:ac4.id,category:'nav_fees',     cost_type:'variable',amount_brl:8900.00,  description:'Eurocontrol — LIRF/SBGR',           reference_date:daysAgo(40)},
    ]:[]),
  ];
  for (const c of costs) { try { await insertCost(uid, c); res.costs++; } catch(e) { res.errors.push(e.message); } }
  log(`✓ ${res.costs} lançamento(s) financeiro(s)`);

  // ── 6. MANUTENÇÃO ─────────────────────────────────────────
  log('🔧 Criando manutenção...');
  const mx = [
    // PS-YNC
    ...(ac1?[
      {aircraft_id:ac1.id,name:'Inspeção 50 horas',           item_type:'inspection',interval_hours:50,  last_done_hours:1180,next_due_hours:1230,status:'current',  estimated_cost_brl:1200},
      {aircraft_id:ac1.id,name:'Inspeção 100h / anual',       item_type:'inspection',interval_hours:100, last_done_hours:1150,next_due_hours:1250,next_due_date:daysAgo(-40),status:'due_soon',estimated_cost_brl:4800,notes:'Vence em ~40 dias'},
      {aircraft_id:ac1.id,name:'TBO Motor AEIO-580 (1800h)',  item_type:'overhaul',  interval_hours:1800,last_done_hours:0,   next_due_hours:1800,status:'current',  estimated_cost_brl:95000},
      {aircraft_id:ac1.id,name:'TBO Hélice MTV-9 (1200h)',    item_type:'overhaul',  interval_hours:1200,last_done_hours:504, next_due_hours:1204,status:'current',  estimated_cost_brl:28000},
      {aircraft_id:ac1.id,name:'AD 2023-08-01 — Ignição',     item_type:'ad',        last_done_date:daysAgo(120),next_due_date:daysAgo(-240),status:'current',estimated_cost_brl:850,notes:'Inspeção de ignição obrigatória'},
      {aircraft_id:ac1.id,name:'Revisão ELT (2 anos)',        item_type:'component', interval_days:730,  last_done_date:daysAgo(480),next_due_date:daysAgo(-250),status:'current',estimated_cost_brl:380},
    ]:[]),
    // PR-VCO
    ...(ac2?[
      {aircraft_id:ac2.id,name:'Inspeção 100h — Motor #1',    item_type:'inspection',interval_hours:100, last_done_hours:3820,next_due_hours:3920,status:'due_soon',estimated_cost_brl:3200,notes:'16h restantes'},
      {aircraft_id:ac2.id,name:'Inspeção 100h — Motor #2',    item_type:'inspection',interval_hours:100, last_done_hours:3820,next_due_hours:3920,status:'due_soon',estimated_cost_brl:3200},
      {aircraft_id:ac2.id,name:'Revisão anual (annual)',       item_type:'inspection',interval_days:365,  last_done_date:daysAgo(310),next_due_date:daysAgo(-55),status:'current',estimated_cost_brl:9500},
      {aircraft_id:ac2.id,name:'TBO Cont. TSIO-360 #1 (1800h)',item_type:'overhaul', interval_hours:1800,last_done_hours:2240,next_due_hours:4040,status:'current',estimated_cost_brl:75000},
      {aircraft_id:ac2.id,name:'TBO Cont. TSIO-360 #2 (1800h)',item_type:'overhaul', interval_hours:1800,last_done_hours:2240,next_due_hours:4040,status:'current',estimated_cost_brl:75000},
      {aircraft_id:ac2.id,name:'Troca de óleo (50h)',          item_type:'inspection',interval_hours:50,  last_done_hours:3830,next_due_hours:3880,status:'current',estimated_cost_brl:480,notes:'Ambos os motores'},
    ]:[]),
    // PT-OXE
    ...(ac3?[
      {aircraft_id:ac3.id,name:'Inspeção 200h',               item_type:'inspection',interval_hours:200, last_done_hours:2040,next_due_hours:2240,status:'current',  estimated_cost_brl:18000},
      {aircraft_id:ac3.id,name:'Inspeção C (800h)',            item_type:'inspection',interval_hours:800, last_done_hours:1600,next_due_hours:2400,status:'current',  estimated_cost_brl:32000},
      {aircraft_id:ac3.id,name:'TBO PT6A-67P (3600h)',         item_type:'overhaul',  interval_hours:3600,last_done_hours:0,   next_due_hours:3600,status:'current',  estimated_cost_brl:420000},
      {aircraft_id:ac3.id,name:'AD 2024-09-01 — EFIS update', item_type:'ad',        last_done_date:daysAgo(60),next_due_date:daysAgo(-120),status:'current',estimated_cost_brl:4500,notes:'Mandatory avionics SW update'},
      {aircraft_id:ac3.id,name:'Calibração pitot/estático',   item_type:'inspection',interval_days:730,  last_done_date:daysAgo(600),next_due_date:daysAgo(-130),status:'overdue',estimated_cost_brl:2200,notes:'VENCIDO — agendar urgente'},
      {aircraft_id:ac3.id,name:'Troca filtro combustível',    item_type:'component', interval_hours:400, last_done_hours:1820,next_due_hours:2220,status:'current',  estimated_cost_brl:850},
    ]:[]),
    // PS-GVX
    ...(ac4?[
      {aircraft_id:ac4.id,name:'Phase 1 (400h)',               item_type:'inspection',interval_hours:400, last_done_hours:4600,next_due_hours:5000,status:'due_soon', estimated_cost_brl:45000,notes:'90h restantes'},
      {aircraft_id:ac4.id,name:'Phase 4C (4800h)',             item_type:'inspection',interval_hours:4800,last_done_hours:0,   next_due_hours:4800,status:'current',  estimated_cost_brl:185000},
      {aircraft_id:ac4.id,name:'TBO BR710 #1 (6000h)',         item_type:'overhaul',  interval_hours:6000,last_done_hours:0,   next_due_hours:6000,status:'current',  estimated_cost_brl:950000},
      {aircraft_id:ac4.id,name:'TBO BR710 #2 (6000h)',         item_type:'overhaul',  interval_hours:6000,last_done_hours:0,   next_due_hours:6000,status:'current',  estimated_cost_brl:950000},
      {aircraft_id:ac4.id,name:'RVSM — Calibração altímetros',item_type:'inspection',interval_days:365,  last_done_date:daysAgo(290),next_due_date:daysAgo(-75),status:'current',estimated_cost_brl:8500,notes:'DECEA requirement'},
      {aircraft_id:ac4.id,name:'APU — Inspeção 500h',         item_type:'inspection',interval_hours:500, last_done_hours:4100,next_due_hours:4600,status:'due_soon', estimated_cost_brl:22000,notes:'Honeywell RE220'},
    ]:[]),
  ];
  for (const m of mx) { try { await insertMX(uid, m); res.maintenance++; } catch(e) { res.errors.push(e.message); } }
  log(`✓ ${res.maintenance} item(ns) de manutenção`);

  // ── 7. MISSÕES ────────────────────────────────────────────
  log('🗺 Criando missões...');
  const missions = [
    ...(ac4?[{ aircraft_id:ac4.id,name:'GRU → OPF → GRU',type:'round_trip',status:'completed',purpose:'business',date_start:daysAgo(12),date_end:daysAgo(7),legs:[{seq:1,departureIcao:'SBGR',destinationIcao:'KOPF',date:daysAgo(12)},{seq:2,departureIcao:'KOPF',destinationIcao:'SBGR',date:daysAgo(7)}],passengers:[{name:'AZEVEDO, Henrique Monteiro',role:'pax',passport:'FZ119900',nationality:'Brazil'},{name:'RODRIGUES, Alexandre Costa',role:'crew',passport:'HX334455',nationality:'Brazil'},{name:'PEREIRA, Camila Torres',role:'crew',passport:'HY556677',nationality:'Brazil'},{name:'LIMA, José Augusto Ferreira',role:'crew',passport:'GZ778899',nationality:'Brazil'}],notes:'Reunião Miami — catering pedido FBO KOPF'}]:[]),
    ...(ac3?[{ aircraft_id:ac3.id,name:'VCP → SCL → VCP',type:'round_trip',status:'completed',purpose:'business',date_start:daysAgo(29),date_end:daysAgo(25),legs:[{seq:1,departureIcao:'SBKP',destinationIcao:'SCEL',date:daysAgo(29)},{seq:2,departureIcao:'SCEL',destinationIcao:'SBKP',date:daysAgo(25)}],passengers:[{name:'OLIVEIRA, Fernanda Castro',role:'crew',passport:'HY228833',nationality:'Brazil'}],notes:'Solo PIC — cliente em Santiago'}]:[]),
    ...(ac4?[{ aircraft_id:ac4.id,name:'GRU → FCO → GRU',type:'round_trip',status:'completed',purpose:'business',date_start:daysAgo(46),date_end:daysAgo(40),legs:[{seq:1,departureIcao:'SBGR',destinationIcao:'LIRF',date:daysAgo(46)},{seq:2,departureIcao:'LIRF',destinationIcao:'SBGR',date:daysAgo(40)}],passengers:[{name:'AZEVEDO, Henrique Monteiro',role:'pax',passport:'FZ119900',nationality:'Brazil'},{name:'RODRIGUES, Alexandre Costa',role:'crew',passport:'HX334455',nationality:'Brazil'},{name:'PEREIRA, Camila Torres',role:'crew',passport:'HY556677',nationality:'Brazil'},{name:'LIMA, José Augusto Ferreira',role:'crew',passport:'GZ778899',nationality:'Brazil'}],notes:'Europa — Roma e Milão. Handling ExecuJet FCO'}]:[]),
    ...(ac2?[{ aircraft_id:ac2.id,name:'JDA → POA (próxima)',type:'round_trip',status:'planned',purpose:'business',date_start:daysAgo(-8),date_end:daysAgo(-6),legs:[{seq:1,departureIcao:'SBJD',destinationIcao:'SBPA',date:daysAgo(-8)},{seq:2,departureIcao:'SBPA',destinationIcao:'SBJD',date:daysAgo(-6)}],passengers:[{name:'SANTOS, Ricardo Mendes',role:'crew',passport:'GX445512',nationality:'Brazil'}],notes:'Verificar NOTAM SBPA e ATIS'}]:[]),
  ];
  for (const m of missions) { try { await insertMission(uid, m); res.missions++; } catch(e) { res.errors.push(e.message); } }
  log(`✓ ${res.missions} missão(ões)`);

  if (res.errors.length > 0) {
    log(`⚠ ${res.errors.length} erro(s) ignorado(s) — dados parcialmente criados`);
  }
  log('🎉 Seed completo!');
  return res;
}

// ═════════════════════════════════════════════════════════════
// RESET — apaga TODOS os dados do usuário
// ═════════════════════════════════════════════════════════════
export async function resetAllData(onProgress) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const uid = user.id;
  const log = (msg) => { console.log(msg); onProgress?.(msg); };

  log('🗑 Apagando missões...');
  await supabase.from('missions').delete().eq('user_id', uid);

  log('🗑 Apagando óleo...');
  try { await supabase.from('oil_logs').delete().eq('user_id', uid); } catch(e) {}

  log('🗑 Apagando custos...');
  await supabase.from('costs').delete().eq('user_id', uid);

  log('🗑 Apagando manutenção...');
  await supabase.from('maintenance').delete().eq('user_id', uid);

  log('🗑 Apagando combustível...');
  await supabase.from('fuel_prices').delete().eq('user_id', uid);

  log('🗑 Apagando voos...');
  await supabase.from('flights').delete().eq('user_id', uid);

  log('🗑 Apagando aeronaves...');
  await supabase.from('aircraft').delete().eq('user_id', uid);

  log('🗑 Apagando documentos de tripulação...');
  try { await supabase.from('crew_documents').delete().eq('user_id', uid); } catch(e) {}

  log('🗑 Apagando tripulação...');
  try { await supabase.from('crew_members').delete().eq('user_id', uid); } catch(e) {}

  log('✓ Todos os dados apagados');
}
