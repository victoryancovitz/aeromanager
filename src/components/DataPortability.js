import React, { useState } from 'react';
import {
  getAircraft, getFlights, getCosts, getMaintenance, getMissions,
  getFuelPrices, getSettings, getCrewMembers, getCrewDocuments,
  saveAircraft, saveFlight, saveCost, saveMaintenance, saveMission,
  recordFuelPrice, saveSettings, saveCrewMember, saveCrewDocument,
  getUser
} from '../store';
import { supabase } from '../supabase';

const VERSION = '1.0';

// ── Export ────────────────────────────────────────────────────
async function exportAllData(onProgress) {
  onProgress('Coletando aeronaves...');
  const aircraft   = await getAircraft();

  onProgress('Coletando voos...');
  const flights    = await getFlights();

  onProgress('Coletando custos...');
  const costs      = await getCosts();

  onProgress('Coletando manutenção...');
  const maintenance = await getMaintenance();

  onProgress('Coletando missões...');
  const missions   = await getMissions();

  onProgress('Coletando combustível...');
  const fuelPrices = await getFuelPrices();

  onProgress('Coletando configurações...');
  const settings   = await getSettings();

  onProgress('Coletando tripulação...');
  let crewMembers = [];
  let crewDocuments = [];
  try {
    crewMembers  = await getCrewMembers();
    for (const m of crewMembers) {
      const docs = await getCrewDocuments(m.id);
      crewDocuments.push(...docs);
    }
  } catch(e) { /* tabelas podem não existir */ }

  onProgress('Coletando óleo...');
  let oilLogs = [];
  try {
    const user = await getUser();
    const { data } = await supabase.from('oil_logs').select('*').eq('user_id', user.id);
    oilLogs = data || [];
  } catch(e) {}

  const backup = {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      aircraft: aircraft.length,
      flights: flights.length,
      costs: costs.length,
      maintenance: maintenance.length,
      missions: missions.length,
      fuelPrices: fuelPrices.length,
      crewMembers: crewMembers.length,
      crewDocuments: crewDocuments.length,
      oilLogs: oilLogs.length,
    },
    data: { aircraft, flights, costs, maintenance, missions, fuelPrices, settings, crewMembers, crewDocuments, oilLogs },
  };

  return backup;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(rows, headers, filename) {
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => {
    const v = r[h] ?? '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') ? `"${s}"` : s;
  }).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ────────────────────────────────────────────────────
async function importData(backup, options, onProgress) {
  if (!backup?.data) throw new Error('Arquivo inválido — formato não reconhecido.');
  if (!backup.version) throw new Error('Arquivo sem versão — pode ser incompatível.');

  const { aircraft, flights, costs, maintenance, missions, fuelPrices, settings, crewMembers, crewDocuments, oilLogs } = backup.data;
  const results = {};
  const idMap = {}; // old_id → new_id for each table

  if (options.aircraft && aircraft?.length) {
    onProgress(`Importando ${aircraft.length} aeronaves...`);
    idMap.aircraft = {};
    for (const ac of aircraft) {
      const oldId = ac.id;
      const { id, updatedAt, ...rest } = ac;
      const saved = await saveAircraft(rest);
      if (saved?.id) idMap.aircraft[oldId] = saved.id;
    }
    results.aircraft = Object.keys(idMap.aircraft).length;
  }

  if (options.flights && flights?.length) {
    onProgress(`Importando ${flights.length} voos...`);
    idMap.flights = {};
    for (const f of flights) {
      const oldId = f.id;
      const { id, updatedAt, ...rest } = f;
      if (idMap.aircraft?.[rest.aircraftId]) rest.aircraftId = idMap.aircraft[rest.aircraftId];
      const saved = await saveFlight(rest);
      if (saved?.id) idMap.flights[oldId] = saved.id;
    }
    results.flights = Object.keys(idMap.flights).length;
  }

  if (options.costs && costs?.length) {
    onProgress(`Importando ${costs.length} lançamentos...`);
    for (const c of costs) {
      const { id, updatedAt, ...rest } = c;
      if (idMap.aircraft?.[rest.aircraftId]) rest.aircraftId = idMap.aircraft[rest.aircraftId];
      if (idMap.flights?.[rest.flightId])    rest.flightId   = idMap.flights[rest.flightId];
      await saveCost(rest);
    }
    results.costs = costs.length;
  }

  if (options.maintenance && maintenance?.length) {
    onProgress(`Importando ${maintenance.length} itens de manutenção...`);
    for (const m of maintenance) {
      const { id, ...rest } = m;
      if (idMap.aircraft?.[rest.aircraftId]) rest.aircraftId = idMap.aircraft[rest.aircraftId];
      await saveMaintenance(rest);
    }
    results.maintenance = maintenance.length;
  }

  if (options.missions && missions?.length) {
    onProgress(`Importando ${missions.length} missões...`);
    for (const m of missions) {
      const { id, updatedAt, ...rest } = m;
      if (idMap.aircraft?.[rest.aircraftId]) rest.aircraftId = idMap.aircraft[rest.aircraftId];
      await saveMission(rest);
    }
    results.missions = missions.length;
  }

  if (options.fuel && fuelPrices?.length) {
    onProgress(`Importando ${fuelPrices.length} preços de combustível...`);
    for (const p of fuelPrices) {
      await recordFuelPrice({ icao: p.icao, pricePerLiter: p.price_per_liter || p.pricePerLiter, liters: p.liters, fuelType: p.fuel_type || p.fuelType, vendor: p.vendor, date: p.date });
    }
    results.fuelPrices = fuelPrices.length;
  }

  if (options.crew && crewMembers?.length) {
    onProgress(`Importando ${crewMembers.length} tripulantes...`);
    idMap.crew = {};
    for (const m of crewMembers) {
      const oldId = m.id;
      const { id, created_at, updated_at, user_id, ...rest } = m;
      try {
        const saved = await saveCrewMember(rest);
        if (saved?.id) idMap.crew[oldId] = saved.id;
      } catch(e) {}
    }
    results.crewMembers = Object.keys(idMap.crew).length;

    if (crewDocuments?.length) {
      for (const d of crewDocuments) {
        const { id, created_at, updated_at, user_id, ...rest } = d;
        if (idMap.crew?.[rest.crew_member_id]) rest.crew_member_id = idMap.crew[rest.crew_member_id];
        try { await saveCrewDocument(rest); } catch(e) {}
      }
      results.crewDocuments = crewDocuments.length;
    }
  }

  if (options.settings && settings) {
    onProgress('Importando configurações...');
    const { apiKey: _, ...restSettings } = settings; // never import API key
    await saveSettings(restSettings);
    results.settings = 1;
  }

  return results;
}

// ── Component ─────────────────────────────────────────────────
export default function DataPortability({ onDone }) {
  const [tab, setTab]         = useState('export');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importData_, setImportData_] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [exportOptions, setExportOptions] = useState({
    aircraft:true, flights:true, costs:true, maintenance:true,
    missions:true, fuel:true, crew:true, settings:false,
  });
  const [importOptions, setImportOptions] = useState({
    aircraft:true, flights:true, costs:true, maintenance:true,
    missions:true, fuel:true, crew:true, settings:false,
  });

  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');

  async function handleExport() {
    setLoading(true); setError(''); setResult(null);
    try {
      const backup = await exportAllData(msg => setProgress(msg));
      const { data } = backup;

      if (exportFormat === 'json') {
        // Filter by options
        const filtered = {
          ...backup,
          data: {
            aircraft:    exportOptions.aircraft    ? data.aircraft    : [],
            flights:     exportOptions.flights     ? data.flights     : [],
            costs:       exportOptions.costs       ? data.costs       : [],
            maintenance: exportOptions.maintenance ? data.maintenance : [],
            missions:    exportOptions.missions    ? data.missions    : [],
            fuelPrices:  exportOptions.fuel        ? data.fuelPrices  : [],
            crewMembers: exportOptions.crew        ? data.crewMembers : [],
            crewDocuments: exportOptions.crew      ? data.crewDocuments : [],
            oilLogs:     data.oilLogs,
            settings:    exportOptions.settings    ? data.settings    : null,
          }
        };
        downloadJSON(filtered, `aeromanager_backup_${today}.json`);
        setResult({ type:'export', format:'JSON', ...filtered.counts });
      } else if (exportFormat === 'csv_flights') {
        const headers = ['date','departureIcao','destinationIcao','flightTimeMinutes','flightTimeDay','flightTimeNight','flightTimeIfr','distanceNm','fuelAddedLiters','fuelPricePerLiter','flightConditions','purpose','cycles','logbookNotes'];
        downloadCSV(data.flights, headers, `aeromanager_flights_${today}.csv`);
        setResult({ type:'export', format:'CSV Voos', flights: data.flights.length });
      } else if (exportFormat === 'csv_costs') {
        const headers = ['referenceDate','category','costType','amountBrl','description','vendor'];
        downloadCSV(data.costs, headers, `aeromanager_costs_${today}.csv`);
        setResult({ type:'export', format:'CSV Custos', costs: data.costs.length });
      } else if (exportFormat === 'csv_crew') {
        const rows = data.crewMembers.map(m => ({
          full_name: m.full_name, role: m.role, nationality: m.nationality,
          dob: m.dob, anac_code: m.anac_code,
        }));
        downloadCSV(rows, ['full_name','role','nationality','dob','anac_code'], `aeromanager_crew_${today}.csv`);
        setResult({ type:'export', format:'CSV Tripulação', crew: rows.length });
      }
    } catch(e) {
      setError(e.message);
    }
    setProgress('');
    setLoading(false);
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportData_(null);
    setError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.data) throw new Error('Arquivo inválido');
      setImportData_(parsed);
    } catch(err) {
      setError('Arquivo inválido ou corrompido. Use um backup .json gerado pelo AeroManager.');
    }
  }

  async function handleImport() {
    if (!importData_) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await importData(importData_, importOptions, msg => setProgress(msg));
      setResult({ type:'import', ...res });
      onDone?.();
    } catch(e) {
      setError(e.message);
    }
    setProgress('');
    setLoading(false);
  }

  const optionList = [
    { key:'aircraft',    label:'Aeronaves',       icon:'✈' },
    { key:'flights',     label:'Voos',            icon:'📋' },
    { key:'costs',       label:'Custos',          icon:'💰' },
    { key:'maintenance', label:'Manutenção',      icon:'🔧' },
    { key:'missions',    label:'Missões',         icon:'🗺' },
    { key:'fuel',        label:'Combustível',     icon:'⛽' },
    { key:'crew',        label:'Tripulação',      icon:'👨‍✈️' },
    { key:'settings',    label:'Configurações',   icon:'⚙' },
  ];

  return (
    <div style={{ padding:24, maxWidth:760 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Exportar / Importar dados</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>Backup completo ou parcial dos seus dados</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg2)', borderRadius:10, padding:4 }}>
        {[['export','⬇ Exportar'],['import','⬆ Importar']].map(([t,l]) => (
          <button key={t} onClick={() => { setTab(t); setResult(null); setError(''); }}
            style={{ flex:1, padding:'9px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background: tab===t?'var(--bg1)':'transparent', color: tab===t?'var(--text1)':'var(--text3)', boxShadow: tab===t?'0 1px 3px rgba(0,0,0,.15)':'' }}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom:16 }}>
          <span>⚠ {error}</span>
          <button className="ghost" style={{ marginLeft:'auto' }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      {result && (
        <div className="alert alert-success" style={{ marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <span>{result.type === 'export' ? `✓ ${result.format} exportado` : '✓ Importação concluída'}</span>
          <div style={{ display:'flex', gap:10, marginLeft:'auto', flexWrap:'wrap' }}>
            {Object.entries(result).filter(([k]) => !['type','format'].includes(k)).map(([k,v]) => (
              <span key={k} style={{ fontSize:11 }}>{v} {k}</span>
            ))}
          </div>
        </div>
      )}

      {/* EXPORT TAB */}
      {tab === 'export' && (
        <div>
          {/* Format */}
          <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
            <div className="section-title">Formato</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
              {[
                ['json',       '📦 JSON completo', 'Backup total — inclui tudo'],
                ['csv_flights','📄 CSV Voos',       'Planilha de voos'],
                ['csv_costs',  '📄 CSV Custos',     'Planilha financeira'],
                ['csv_crew',   '📄 CSV Tripulação', 'Lista de tripulantes'],
              ].map(([v,l,sub]) => (
                <div key={v} onClick={() => setExportFormat(v)} style={{ padding:'10px 12px', borderRadius:9, border:`1px solid ${exportFormat===v?'var(--blue-mid)':'var(--border)'}`, background: exportFormat===v?'var(--blue-dim)':'var(--bg2)', cursor:'pointer', transition:'all .15s' }}>
                  <div style={{ fontSize:12, fontWeight:500, color: exportFormat===v?'var(--blue)':'var(--text1)', marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Options (JSON only) */}
          {exportFormat === 'json' && (
            <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
              <div className="section-title">O que incluir</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {optionList.map(o => (
                  <div key={o.key} onClick={() => setExportOptions(x => ({...x,[o.key]:!x[o.key]}))}
                    style={{ padding:'8px 10px', borderRadius:8, border:`1px solid ${exportOptions[o.key]?'var(--green-mid)':'var(--border)'}`, background: exportOptions[o.key]?'var(--green-dim)':'var(--bg2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13 }}>{o.icon}</span>
                    <span style={{ fontSize:11, color: exportOptions[o.key]?'var(--green)':'var(--text3)', fontWeight:500 }}>{o.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>
                ⚠ Configurações não incluem a chave da API por segurança.
              </div>
            </div>
          )}

          {progress && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10, fontFamily:'var(--font-mono)' }}>{progress}</div>}

          <button className="primary" onClick={handleExport} disabled={loading} style={{ padding:'12px 24px', fontSize:13 }}>
            {loading ? '⏳ Exportando...' : '⬇ Exportar agora'}
          </button>
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === 'import' && (
        <div>
          <div className="card" style={{ padding:'14px 18px', marginBottom:14, borderLeft:'3px solid var(--amber)' }}>
            <div style={{ fontSize:12, color:'var(--amber)', fontWeight:500, marginBottom:4 }}>⚠ Atenção</div>
            <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>
              A importação <strong>adiciona</strong> os dados ao seu banco — não apaga os dados existentes. Se importar um backup duas vezes, terá registros duplicados. Use apenas arquivos <code style={{ fontSize:11, background:'var(--bg3)', padding:'1px 5px', borderRadius:4 }}>.json</code> gerados pelo AeroManager.
            </div>
          </div>

          {/* File picker */}
          <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
            <div className="section-title">Arquivo de backup</div>
            <input type="file" accept=".json" onChange={handleFileSelect} style={{ fontSize:12 }} />
            {importData_ && (
              <div style={{ marginTop:10, padding:'8px 12px', background:'var(--green-dim)', borderRadius:8, fontSize:11, color:'var(--green)' }}>
                ✓ Arquivo válido — exportado em {new Date(importData_.exportedAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                <div style={{ display:'flex', gap:10, marginTop:6, flexWrap:'wrap', color:'var(--text2)' }}>
                  {Object.entries(importData_.counts || {}).filter(([,v])=>v>0).map(([k,v]) => (
                    <span key={k}><strong style={{ color:'var(--text1)' }}>{v}</strong> {k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {importData_ && (
            <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
              <div className="section-title">O que importar</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {optionList.map(o => {
                  const available = importData_?.data?.[o.key === 'fuel' ? 'fuelPrices' : o.key === 'crew' ? 'crewMembers' : o.key]?.length || 0;
                  const enabled = importOptions[o.key] && available > 0;
                  return (
                    <div key={o.key} onClick={() => available > 0 && setImportOptions(x => ({...x,[o.key]:!x[o.key]}))}
                      style={{ padding:'8px 10px', borderRadius:8, border:`1px solid ${enabled?'var(--blue-mid)':'var(--border)'}`, background: enabled?'var(--blue-dim)':'var(--bg2)', cursor: available>0?'pointer':'not-allowed', opacity: available===0?0.4:1, display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:13 }}>{o.icon}</span>
                      <div>
                        <div style={{ fontSize:11, color: enabled?'var(--blue)':'var(--text3)', fontWeight:500 }}>{o.label}</div>
                        <div style={{ fontSize:9.5, color:'var(--text3)' }}>{available} registros</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {progress && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10, fontFamily:'var(--font-mono)' }}>{progress}</div>}

          <button className="primary" onClick={handleImport} disabled={loading || !importData_} style={{ padding:'12px 24px', fontSize:13 }}>
            {loading ? '⏳ Importando...' : '⬆ Importar dados'}
          </button>
        </div>
      )}
    </div>
  );
}
