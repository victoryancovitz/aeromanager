import React, { useState, useRef, useMemo } from 'react';
import {
  getFullDB, importAircraftDBFromJSON, exportAircraftDBAsJSON,
  getDBStats, clearCustomDB
} from '../aircraftDB';

const CATEGORIES = [
  'Todas','Treinamento','Privada – Pistão','Privada – Turboprop',
  'Utilitário / STOL','Kit / Experimental','Jato Muito Leve (VLJ)',
  'Jato Leve','Jato Médio','Jato Pesado / ULR',
];

const FUEL_LABEL = { avgas_100ll:'AVGAS 100LL', jet_a1:'JET-A1', mogas:'MOGAS', eletrico:'Elétrico' };
const TYPE_LABEL = { single_engine:'Monomotor', multi_engine:'Bimotor', turboprop:'Turboélice', jet:'Jato', experimental:'Experimental' };
const TYPE_COLOR = { single_engine:'var(--blue)', multi_engine:'var(--purple)', turboprop:'var(--amber)', jet:'var(--green)', experimental:'var(--text3)' };

function fmt(v, unit='') { return v != null ? `${Number(v).toLocaleString('pt-BR')}${unit}` : '—'; }

function AircraftCard({ ac, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card animate-in" style={{ padding:'14px 16px', marginBottom:8, cursor:'pointer', borderLeft:`3px solid ${TYPE_COLOR[ac.type]||'var(--bg3)'}` }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'space-between' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontFamily:'var(--font-serif)', fontSize:16, color:'var(--text1)' }}>{ac.manufacturer} {ac.model}</span>
            {ac.designacao && <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)', background:'var(--bg2)', padding:'1px 6px', borderRadius:4 }}>{ac.designacao}</span>}
            <span style={{ fontSize:11, color:TYPE_COLOR[ac.type], background:'var(--bg2)', padding:'1px 6px', borderRadius:4 }}>{TYPE_LABEL[ac.type]||ac.type}</span>
            {ac.em_producao && <span style={{ fontSize:10, color:'var(--green)', border:'1px solid var(--green-mid)', padding:'1px 5px', borderRadius:4 }}>EM PRODUÇÃO</span>}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {ac.engineModel}{ac.year_range ? ` · ${ac.year_range}` : ''}{ac.category ? ` · ${ac.category}` : ''}
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexShrink:0 }}>
          {ac.cruzeiro_ktas && <div style={{ textAlign:'center' }}><div style={{ fontSize:15, fontFamily:'var(--font-mono)', color:'var(--text1)' }}>{ac.cruzeiro_ktas}</div><div style={{ fontSize:10, color:'var(--text3)' }}>ktas</div></div>}
          {ac.alcance_nm && <div style={{ textAlign:'center' }}><div style={{ fontSize:15, fontFamily:'var(--font-mono)', color:'var(--text1)' }}>{ac.alcance_nm}</div><div style={{ fontSize:10, color:'var(--text3)' }}>nm</div></div>}
          {onSelect && <button className="primary" style={{ fontSize:11, padding:'5px 10px', flexShrink:0 }} onClick={e => { e.stopPropagation(); onSelect(ac); }}>Usar</button>}
          <span style={{ fontSize:14, color:'var(--text3)', userSelect:'none' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--bg2)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px, 1fr))', gap:8 }}>
            {[
              ['Motor', ac.engineModel],
              ['TBO (h)', ac.engineTboHours ? fmt(ac.engineTboHours) : null],
              ['Potência', ac.engineHp ? fmt(ac.engineHp, ac.type==='jet'?' lbf':' hp') : null],
              ['Motores', ac.numEngines ?? 1],
              ['Combustível', FUEL_LABEL[ac.fuelType]||ac.fuelType],
              ['Passageiros', ac.capacidadePassageiros ? fmt(ac.capacidadePassageiros,' pax') : null],
              ['MTOW', ac.mtow_kg ? fmt(ac.mtow_kg,' kg') : null],
              ['Cruzeiro', ac.cruzeiro_ktas ? fmt(ac.cruzeiro_ktas,' ktas') : null],
              ['Alcance', ac.alcance_nm ? fmt(ac.alcance_nm,' nm') : null],
              ['Teto', ac.teto_ft ? fmt(ac.teto_ft,' ft') : null],
              ['Cap. combustível', ac.fuelCapacityLiters ? fmt(ac.fuelCapacityLiters,' L') : null],
            ].filter(([,v]) => v != null && v !== '—').map(([label, val]) => (
              <div key={label} style={{ background:'var(--bg2)', borderRadius:6, padding:'6px 10px' }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:12, color:'var(--text1)', fontFamily:['Motor','Combustível','Passageiros'].includes(label)?'inherit':'var(--font-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</div>
              </div>
            ))}
          </div>
          {ac.notes && <div style={{ marginTop:8, fontSize:11, color:'var(--text3)', fontStyle:'italic', lineHeight:1.5 }}>{ac.notes}</div>}
          {ac.performance?.length > 0 && <div style={{ marginTop:8, fontSize:11, color:'var(--green)' }}>✓ {ac.performance.length} pontos de performance POH disponíveis</div>}
        </div>
      )}
    </div>
  );
}

export default function AircraftDBManager({ onSelect, embedded = false }) {
  const [stats, setStats] = useState(getDBStats);
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [inProduction, setInProduction] = useState(false);
  const [sortBy, setSortBy] = useState('manufacturer');
  const fileRef = useRef();

  const db = useMemo(() => getFullDB(), [stats]);

  const filtered = useMemo(() => {
    let r = db;
    if (search.length >= 2) {
      const q = search.toLowerCase();
      r = r.filter(a =>
        a.manufacturer?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q) ||
        a.designacao?.toLowerCase().includes(q) ||
        a.engineModel?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        `${a.manufacturer} ${a.model}`.toLowerCase().includes(q)
      );
    }
    if (category !== 'Todas') r = r.filter(a => a.category === category);
    if (inProduction) r = r.filter(a => a.em_producao);
    return [...r].sort((a, b) => {
      if (sortBy === 'manufacturer') return `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`, 'pt-BR');
      if (sortBy === 'cruzeiro') return (b.cruzeiro_ktas||0) - (a.cruzeiro_ktas||0);
      if (sortBy === 'alcance')  return (b.alcance_nm||0) - (a.alcance_nm||0);
      if (sortBy === 'mtow')     return (b.mtow_kg||0) - (a.mtow_kg||0);
      return 0;
    });
  }, [db, search, category, inProduction, sortBy]);

  const manufacturers = useMemo(() => [...new Set(db.map(a => a.manufacturer))].sort(), [db]);

  function refresh() { setStats(getDBStats()); }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = importAircraftDBFromJSON(text);
      refresh();
      setStatus({ type:'success', msg:`✓ ${result.added} nova(s), ${result.updated} atualizada(s). Total: ${result.total} aeronaves.` });
    } catch (err) { setStatus({ type:'error', msg:`Erro: ${err.message}` }); }
    e.target.value = '';
  }

  function handleExport() {
    const blob = new Blob([exportAircraftDBAsJSON()], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `AeroManager_AircraftDB_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function handleClear() {
    if (!window.confirm(`Remover ${stats.custom} aeronave(s) personalizada(s)? As aeronaves padrão permanecem.`)) return;
    clearCustomDB(); refresh();
    setStatus({ type:'success', msg:'✓ Base personalizada removida.' });
  }

  return (
    <div style={{ padding: embedded ? 0 : 24 }}>
      {!embedded && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Base de Aeronaves</div>
            <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>
              {stats.total} aeronaves · {stats.builtin} padrão · {stats.custom} personalizadas · {manufacturers.length} fabricantes
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />
            <button onClick={() => fileRef.current.click()} style={{ fontSize:12, padding:'6px 12px' }}>⬆ Importar JSON</button>
            <button onClick={handleExport} style={{ fontSize:12, padding:'6px 12px' }}>⬇ Exportar</button>
            {stats.custom > 0 && <button onClick={handleClear} className="danger" style={{ fontSize:12, padding:'6px 12px' }}>🗑 Limpar custom</button>}
          </div>
        </div>
      )}

      {status && (
        <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:8, background:status.type==='success'?'var(--green-dim)':'var(--red-dim)', border:`1px solid ${status.type==='success'?'var(--green-mid)':'var(--red-mid)'}`, color:status.type==='success'?'var(--green)':'var(--red)', fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>{status.msg}</span>
          <button className="ghost" style={{ fontSize:11 }} onClick={() => setStatus(null)}>✕</button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Buscar fabricante, modelo, motor..."
          style={{ flex:1, minWidth:200, padding:'8px 12px', borderRadius:8, border:'1px solid var(--bg3)', background:'var(--bg1)', color:'var(--text1)', fontSize:13 }}
          autoFocus={embedded}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ minWidth:165, padding:'8px 10px' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ minWidth:130, padding:'8px 10px' }}>
          <option value="manufacturer">A-Z fabricante</option>
          <option value="cruzeiro">Velocidade ↓</option>
          <option value="alcance">Alcance ↓</option>
          <option value="mtow">MTOW ↓</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)', cursor:'pointer', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={inProduction} onChange={e => setInProduction(e.target.checked)} />
          Só em produção
        </label>
      </div>

      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
        {filtered.length} aeronave{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        {(search || category !== 'Todas' || inProduction) && (
          <button className="ghost" style={{ fontSize:11, marginLeft:10 }} onClick={() => { setSearch(''); setCategory('Todas'); setInProduction(false); }}>✕ Limpar filtros</button>
        )}
      </div>

      <div style={{ maxHeight: embedded ? 480 : undefined, overflowY: embedded ? 'auto' : undefined }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
            <div>Nenhuma aeronave encontrada</div>
            <div style={{ fontSize:12, marginTop:4 }}>Tente outros termos ou remova os filtros</div>
          </div>
        ) : (
          filtered.map((ac, i) => <AircraftCard key={`${ac.manufacturer}_${ac.model}_${i}`} ac={ac} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}
