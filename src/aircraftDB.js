import BUILTIN_DB from './aircraftDB.json';

const CUSTOM_KEY = 'am3_custom_aircraft_db';

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
