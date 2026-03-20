import BUILTIN_DB from './aircraftDB.json';

const CUSTOM_KEY = 'am3_custom_aircraft_db';

// Load custom entries added by the user via import
  // ── Lote 1: Cessna Pistão ─────────────────────────
  {"manufacturer":"Cessna","model":"150M","type":"single_engine","categoria":"Treinamento","engineModel":"Continental O-200-A","engineHp":100,"engineTboHours":1800,"numEngines":1,"propModel":"McCauley 1A101/MCM6958","propTboHours":2400,"fuelType":"avgas_100ll","fuelCapacityLiters":98,"maxCruiseKtas":107,"rangeNm":420,"mtowKg":726,"serviceCeilingFt":14000,"performance":[{"altFt":2000,"power":75,"ktas":104,"fuelLph":22},{"altFt":6000,"power":65,"ktas":100,"fuelLph":19.5},{"altFt":10000,"power":55,"ktas":94,"fuelLph":17}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":67,"fpm":670,"fuelLph":27,"distNm":7},{"altFromFt":4000,"altToFt":8000,"kias":65,"fpm":530,"fuelLph":26,"distNm":9},{"altFromFt":8000,"altToFt":12000,"kias":63,"fpm":360,"fuelLph":25,"distNm":14}]},
  {"manufacturer":"Cessna","model":"152","type":"single_engine","categoria":"Treinamento","engineModel":"Lycoming O-235-L2C","engineHp":110,"engineTboHours":2400,"numEngines":1,"propModel":"Sensenich 69/63","propTboHours":2400,"fuelType":"avgas_100ll","fuelCapacityLiters":144,"maxCruiseKtas":107,"rangeNm":415,"mtowKg":757,"serviceCeilingFt":14700,"performance":[{"altFt":2000,"power":75,"ktas":105,"fuelLph":23.5},{"altFt":6000,"power":65,"ktas":101,"fuelLph":20.5},{"altFt":10000,"power":55,"ktas":95,"fuelLph":18}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":67,"fpm":715,"fuelLph":29,"distNm":7},{"altFromFt":4000,"altToFt":8000,"kias":65,"fpm":565,"fuelLph":28,"distNm":9},{"altFromFt":8000,"altToFt":12000,"kias":63,"fpm":380,"fuelLph":27,"distNm":13}]},
  {"manufacturer":"Cessna","model":"172N Skyhawk","type":"single_engine","categoria":"Treinamento","engineModel":"Lycoming O-320-H2AD","engineHp":160,"engineTboHours":2000,"numEngines":1,"propModel":"McCauley 1C160/DTM7557","propTboHours":2400,"fuelType":"avgas_100ll","fuelCapacityLiters":212,"maxCruiseKtas":122,"rangeNm":575,"mtowKg":1043,"serviceCeilingFt":14200,"performance":[{"altFt":4000,"power":75,"ktas":120,"fuelLph":34},{"altFt":8000,"power":65,"ktas":116,"fuelLph":29.5},{"altFt":12000,"power":55,"ktas":109,"fuelLph":25.5}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":74,"fpm":730,"fuelLph":43,"distNm":8},{"altFromFt":4000,"altToFt":8000,"kias":72,"fpm":590,"fuelLph":41,"distNm":10},{"altFromFt":8000,"altToFt":12000,"kias":70,"fpm":420,"fuelLph":39,"distNm":15}]},
  {"manufacturer":"Cessna","model":"172R Skyhawk","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Lycoming IO-360-L2A","engineHp":160,"engineTboHours":2000,"numEngines":1,"propModel":"McCauley 1C160/DTM7557","propTboHours":2400,"fuelType":"avgas_100ll","fuelCapacityLiters":212,"maxCruiseKtas":122,"rangeNm":580,"mtowKg":1043,"serviceCeilingFt":14000,"performance":[{"altFt":4000,"power":75,"ktas":121,"fuelLph":33.5},{"altFt":8000,"power":65,"ktas":117,"fuelLph":29},{"altFt":12000,"power":55,"ktas":110,"fuelLph":25}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":74,"fpm":725,"fuelLph":43,"distNm":8},{"altFromFt":4000,"altToFt":8000,"kias":72,"fpm":580,"fuelLph":41,"distNm":10},{"altFromFt":8000,"altToFt":12000,"kias":70,"fpm":410,"fuelLph":39,"distNm":15}]},
  {"manufacturer":"Cessna","model":"172S Skyhawk SP","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Lycoming IO-360-L2A","engineHp":180,"engineTboHours":2000,"numEngines":1,"propModel":"McCauley 1C160/DTM7553","propTboHours":2400,"fuelType":"avgas_100ll","fuelCapacityLiters":212,"maxCruiseKtas":124,"rangeNm":640,"mtowKg":1111,"serviceCeilingFt":14000,"performance":[{"altFt":4000,"power":75,"ktas":122,"fuelLph":36},{"altFt":8000,"power":65,"ktas":119,"fuelLph":31.5},{"altFt":12000,"power":55,"ktas":112,"fuelLph":27}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":76,"fpm":720,"fuelLph":44,"distNm":8},{"altFromFt":4000,"altToFt":8000,"kias":74,"fpm":620,"fuelLph":42,"distNm":10},{"altFromFt":8000,"altToFt":12000,"kias":72,"fpm":480,"fuelLph":40,"distNm":14}]},
  {"manufacturer":"Cessna","model":"177B Cardinal","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Lycoming IO-360-A1B6D","engineHp":180,"engineTboHours":2000,"numEngines":1,"propModel":"McCauley 2A34C58-B","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":189,"maxCruiseKtas":130,"rangeNm":630,"mtowKg":1089,"serviceCeilingFt":14600,"performance":[{"altFt":4000,"power":75,"ktas":128,"fuelLph":38},{"altFt":8000,"power":65,"ktas":124,"fuelLph":33},{"altFt":12000,"power":55,"ktas":116,"fuelLph":28.5}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":76,"fpm":840,"fuelLph":46,"distNm":7},{"altFromFt":4000,"altToFt":8000,"kias":74,"fpm":690,"fuelLph":44,"distNm":9},{"altFromFt":8000,"altToFt":12000,"kias":72,"fpm":510,"fuelLph":42,"distNm":12}]},
  {"manufacturer":"Cessna","model":"182T Skylane","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Lycoming IO-540-AB1A5","engineHp":230,"engineTboHours":2000,"numEngines":1,"propModel":"McCauley 2A36C50-JHA6058","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":348,"maxCruiseKtas":145,"rangeNm":919,"mtowKg":1406,"serviceCeilingFt":18100,"performance":[{"altFt":4000,"power":75,"ktas":143,"fuelLph":52},{"altFt":8000,"power":65,"ktas":138,"fuelLph":45.5},{"altFt":12000,"power":55,"ktas":130,"fuelLph":39}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":80,"fpm":924,"fuelLph":60,"distNm":7},{"altFromFt":4000,"altToFt":8000,"kias":78,"fpm":780,"fuelLph":57,"distNm":8},{"altFromFt":8000,"altToFt":14000,"kias":76,"fpm":570,"fuelLph":54,"distNm":14}]},
  {"manufacturer":"Cessna","model":"T182T Turbo Skylane","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Lycoming TIO-540-AK1A","engineHp":235,"engineTboHours":1800,"numEngines":1,"propModel":"McCauley 2A36C50-JHA6058","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":348,"maxCruiseKtas":156,"rangeNm":970,"mtowKg":1406,"serviceCeilingFt":20000,"performance":[{"altFt":6000,"power":75,"ktas":153,"fuelLph":57},{"altFt":12000,"power":75,"ktas":156,"fuelLph":56},{"altFt":18000,"power":75,"ktas":152,"fuelLph":54.5}],"climbData":[{"altFromFt":0,"altToFt":6000,"kias":82,"fpm":960,"fuelLph":64,"distNm":9},{"altFromFt":6000,"altToFt":12000,"kias":80,"fpm":820,"fuelLph":62,"distNm":10},{"altFromFt":12000,"altToFt":18000,"kias":78,"fpm":600,"fuelLph":58,"distNm":14}]},
  {"manufacturer":"Cessna","model":"185F Skywagon","type":"single_engine","categoria":"STOL/Utilitário","engineModel":"Continental IO-520-D","engineHp":300,"engineTboHours":1700,"numEngines":1,"propModel":"McCauley 3A32C88-H/90A","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":303,"maxCruiseKtas":148,"rangeNm":735,"mtowKg":1519,"serviceCeilingFt":17900,"performance":[{"altFt":4000,"power":75,"ktas":146,"fuelLph":65},{"altFt":8000,"power":65,"ktas":141,"fuelLph":57},{"altFt":12000,"power":55,"ktas":132,"fuelLph":49}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":84,"fpm":1010,"fuelLph":78,"distNm":6},{"altFromFt":4000,"altToFt":8000,"kias":82,"fpm":850,"fuelLph":74,"distNm":7},{"altFromFt":8000,"altToFt":12000,"kias":80,"fpm":640,"fuelLph":70,"distNm":9}]},
  {"manufacturer":"Cessna","model":"206H Stationair","type":"single_engine","categoria":"STOL/Utilitário","engineModel":"Continental IO-540-AB1A5","engineHp":300,"engineTboHours":1700,"numEngines":1,"propModel":"McCauley 3A32C401","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":303,"maxCruiseKtas":145,"rangeNm":750,"mtowKg":1633,"serviceCeilingFt":15700,"performance":[{"altFt":4000,"power":75,"ktas":143,"fuelLph":64},{"altFt":8000,"power":65,"ktas":138,"fuelLph":56.5},{"altFt":12000,"power":55,"ktas":129,"fuelLph":48.5}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":83,"fpm":920,"fuelLph":76,"distNm":7},{"altFromFt":4000,"altToFt":8000,"kias":81,"fpm":760,"fuelLph":72,"distNm":8},{"altFromFt":8000,"altToFt":12000,"kias":79,"fpm":560,"fuelLph":68,"distNm":10}]},
  {"manufacturer":"Cessna","model":"207A Skywagon","type":"single_engine","categoria":"STOL/Utilitário","engineModel":"Continental TSIO-520-M","engineHp":310,"engineTboHours":1400,"numEngines":1,"propModel":"McCauley 3AF32C80-C/80NSA","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":341,"maxCruiseKtas":150,"rangeNm":720,"mtowKg":1724,"serviceCeilingFt":20000,"performance":[{"altFt":6000,"power":75,"ktas":148,"fuelLph":68},{"altFt":12000,"power":75,"ktas":150,"fuelLph":66.5},{"altFt":17000,"power":65,"ktas":144,"fuelLph":59}],"climbData":[{"altFromFt":0,"altToFt":6000,"kias":87,"fpm":810,"fuelLph":82,"distNm":10},{"altFromFt":6000,"altToFt":12000,"kias":85,"fpm":680,"fuelLph":78,"distNm":12},{"altFromFt":12000,"altToFt":17000,"kias":83,"fpm":510,"fuelLph":74,"distNm":14}]},
  {"manufacturer":"Cessna","model":"210N Centurion","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Continental TSIO-520-R","engineHp":310,"engineTboHours":1400,"numEngines":1,"propModel":"McCauley 3AF32C80-C/90NSA","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":341,"maxCruiseKtas":176,"rangeNm":920,"mtowKg":1724,"serviceCeilingFt":23000,"performance":[{"altFt":6000,"power":75,"ktas":172,"fuelLph":70},{"altFt":12000,"power":75,"ktas":176,"fuelLph":68.5},{"altFt":20000,"power":65,"ktas":168,"fuelLph":60.5}],"climbData":[{"altFromFt":0,"altToFt":6000,"kias":100,"fpm":930,"fuelLph":85,"distNm":9},{"altFromFt":6000,"altToFt":12000,"kias":98,"fpm":790,"fuelLph":81,"distNm":10},{"altFromFt":12000,"altToFt":20000,"kias":95,"fpm":590,"fuelLph":76,"distNm":18}]},
  {"manufacturer":"Cessna","model":"162 Skycatcher","type":"single_engine","categoria":"Treinamento","engineModel":"Continental O-200-D","engineHp":100,"engineTboHours":2000,"numEngines":1,"propModel":"Sensenich 68CK-2-51","propTboHours":2400,"fuelType":"avgas_100ll","fuelCapacityLiters":75,"maxCruiseKtas":107,"rangeNm":400,"mtowKg":590,"serviceCeilingFt":14000,"performance":[{"altFt":2000,"power":75,"ktas":105,"fuelLph":21.5},{"altFt":6000,"power":65,"ktas":101,"fuelLph":19},{"altFt":10000,"power":55,"ktas":94,"fuelLph":16.5}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":62,"fpm":640,"fuelLph":26,"distNm":8},{"altFromFt":4000,"altToFt":8000,"kias":60,"fpm":490,"fuelLph":25,"distNm":11},{"altFromFt":8000,"altToFt":12000,"kias":58,"fpm":310,"fuelLph":24,"distNm":17}]},
  {"manufacturer":"Cessna","model":"182S Skylane","type":"single_engine","categoria":"Pistão Monomotor","engineModel":"Lycoming IO-540-AB1A5","engineHp":230,"engineTboHours":2000,"numEngines":1,"propModel":"McCauley 2A36C50-JHA6058","propTboHours":2000,"fuelType":"avgas_100ll","fuelCapacityLiters":303,"maxCruiseKtas":145,"rangeNm":875,"mtowKg":1406,"serviceCeilingFt":18100,"performance":[{"altFt":4000,"power":75,"ktas":143,"fuelLph":51.5},{"altFt":8000,"power":65,"ktas":138,"fuelLph":45},{"altFt":12000,"power":55,"ktas":129,"fuelLph":38.5}],"climbData":[{"altFromFt":0,"altToFt":4000,"kias":80,"fpm":900,"fuelLph":59,"distNm":7},{"altFromFt":4000,"altToFt":8000,"kias":78,"fpm":760,"fuelLph":56,"distNm":8},{"altFromFt":8000,"altToFt":14000,"kias":76,"fpm":550,"fuelLph":53,"distNm":14}]},

function loadCustomDB() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; }
  catch { return []; }
}

// Save custom entries
export function saveCustomDB(entries) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(entries));
}

// Merge built-in + custom, custom takes priority on same manufacturer+model
export function getFullDB() {
  const custom = loadCustomDB();
  const builtin = BUILTIN_DB.filter(b =>
    !custom.some(c =>
      c.manufacturer?.toLowerCase() === b.manufacturer?.toLowerCase() &&
      c.model?.toLowerCase() === b.model?.toLowerCase()
    )
  );
  return [...custom, ...builtin];
}

// Fuzzy search across full DB
export function searchAircraftDB(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return getFullDB()
    .filter(a =>
      a.manufacturer?.toLowerCase().includes(q) ||
      a.model?.toLowerCase().includes(q) ||
      a.designacao?.toLowerCase().includes(q) ||
      a.categoria?.toLowerCase().includes(q) ||
      `${a.manufacturer} ${a.model}`.toLowerCase().includes(q)
    )
    .slice(0, 10);
}

// Import a JSON array of aircraft — merges with existing custom DB
export function importAircraftDBFromJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error('O arquivo deve conter um array JSON de aeronaves.');

  // Validate minimum fields
  const valid = parsed.filter(a => a.manufacturer && a.model && a.engineModel);
  if (valid.length === 0) throw new Error('Nenhuma aeronave válida encontrada. Verifique os campos obrigatórios: manufacturer, model, engineModel.');

  const existing = loadCustomDB();
  const merged = [...existing];

  let added = 0, updated = 0;
  valid.forEach(entry => {
    const idx = merged.findIndex(e =>
      e.manufacturer?.toLowerCase() === entry.manufacturer?.toLowerCase() &&
      e.model?.toLowerCase() === entry.model?.toLowerCase()
    );
    if (idx >= 0) { merged[idx] = entry; updated++; }
    else { merged.push(entry); added++; }
  });

  saveCustomDB(merged);
  return { added, updated, total: merged.length };
}

// Export full DB as JSON string
export function exportAircraftDBAsJSON() {
  return JSON.stringify(getFullDB(), null, 2);
}

// Get stats
export function getDBStats() {
  const custom = loadCustomDB();
  return {
    builtin: BUILTIN_DB.length,
    custom: custom.length,
    total: BUILTIN_DB.length + custom.length,
  };
}

// Clear custom DB
export function clearCustomDB() {
  localStorage.removeItem(CUSTOM_KEY);
}
