import React, { useState, useEffect, useRef } from 'react';
import { saveAircraft, deleteAircraft, computeFuelBias } from '../store';
import { supabase } from '../supabase';
import { AcIcon, ArcGauge, ProgressBar } from './Instruments';
import { searchAircraftDB } from '../aircraftDB';
import { useMultiSelect } from '../hooks/useMultiSelect';
import IcaoInput from './IcaoInput';

const EMPTY = { registration:'', type:'single_engine', manufacturer:'', model:'', year:new Date().getFullYear(), engineModel:'', engineTboHours:'', propModel:'', propTboHours:'', apuModel:'', apuTboHours:'', apuTotalHours:'', apuCycles:'', baseAirframeHours:'', totalEngineHours:'', totalCycles:0, fuelType:'avgas_100ll', fuelCapacityLiters:'', homeBase:'', monthlyFixed:'', performanceProfiles:[], climbProfiles:[], fuelBiasManual:null, anacConfig:{ volumeId:null, status:'nao_configurado' } };

async function deleteCascade(ids) {
  // Delete in dependency order
  for (const id of ids) {
    await supabase.from('oil_logs').delete().eq('aircraft_id', id);
    await supabase.from('costs').delete().eq('aircraft_id', id);
    await supabase.from('maintenance').delete().eq('aircraft_id', id);
    await supabase.from('missions').delete().eq('aircraft_id', id);
    await supabase.from('flights').delete().eq('aircraft_id', id);
    await deleteAircraft(id);
  }
}

function DBSearch({ value, onChange, onSelect }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => { const r = searchAircraftDB(value); setResults(r); setOpen(r.length > 0 && value.length >= 2); }, [value]);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  function typeLabel(r) {
    if (r.type === 'jet') return 'Jato';
    if (r.type === 'turboprop') return 'Turboélice';
    if (r.type === 'multi_engine') return 'Bimotor';
    if (r.type === 'experimental') return 'Experimental';
    return 'Monomotor';
  }

  function motorLine(r) {
    const parts = [];
    parts.push(r.engineModel || '');
    if (r.engineHp) parts.push(`${r.engineHp} hp`);
    if (r.engineShp) parts.push(`${r.engineShp} shp`);
    if (r.engineTboHours) parts.push(`TBO ${r.engineTboHours}h`);
    return parts.filter(Boolean).join(' · ');
  }

  function specsLine(r) {
    const parts = [];
    if (r.maxCruiseKtas) parts.push(`${r.maxCruiseKtas} kt cruzeiro`);
    if (r.rangeNm) parts.push(`${r.rangeNm} nm`);
    if (r.mtowKg) parts.push(`MTOW ${r.mtowKg.toLocaleString('pt-BR')} kg`);
    if (r.serviceCeilingFt) parts.push(`Teto ${(r.serviceCeilingFt/1000).toFixed(0)}kft`);
    return parts.filter(Boolean).join(' · ');
  }

  const catColor = (cat='') => {
    if (cat.includes('Jato Pesado')) return '#9b7fe8';
    if (cat.includes('Jato Médio')) return '#4d9de0';
    if (cat.includes('Jato Leve') || cat.includes('VLJ')) return '#3dbf8a';
    if (cat.includes('Turboprop') || cat.includes('Turboélice')) return '#e8a84a';
    if (cat.includes('Pistão')) return '#e24b4a';
    if (cat.includes('Treinamento')) return '#5a6080';
    if (cat.includes('STOL')) return '#1D9E75';
    return '#888';
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="Ex: Cessna 172, TBM 960, Gulfstream G550, King Air 360…" onFocus={() => value.length >= 2 && setOpen(true)} />
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#1e2230', border:'1px solid #3d4560', borderRadius:8, zIndex:100, maxHeight:320, overflowY:'auto', marginTop:2, boxShadow:'0 8px 24px rgba(0,0,0,.5)' }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => { onSelect(r); setOpen(false); }} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #252a3a', fontSize:13 }} onMouseEnter={e=>e.currentTarget.style.background='#252a3a'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontWeight:600, color:'#e8eaf0' }}>{r.manufacturer} {r.model}</span>
                {r.categoria && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background: catColor(r.categoria)+'22', color: catColor(r.categoria), border:`1px solid ${catColor(r.categoria)}44`, flexShrink:0 }}>{r.categoria}</span>}
                <span style={{ fontSize:10, color:'#5a6080', marginLeft:'auto', flexShrink:0 }}>{typeLabel(r)}{r.numEngines > 1 ? ` ×${r.numEngines}` : ''}</span>
              </div>
              <div style={{ fontSize:11, color:'#9aa0b8' }}>{motorLine(r)}</div>
              {specsLine(r) && <div style={{ fontSize:10, color:'#5a6080', marginTop:2 }}>{specsLine(r)}</div>}
            </div>
          ))}
          <div style={{ padding:'8px 14px', fontSize:10, color:'#3d4560', borderTop:'1px solid #252a3a', textAlign:'center' }}>
            {results.length} resultado{results.length !== 1 ? 's' : ''} · {results.length === 10 ? 'Refine sua busca para mais resultados' : 'Base com 116+ modelos'}
          </div>
        </div>
      )}
    </div>
  );
}

function EditableTable({ profiles, columns, onChange, addRow }) {
  function update(i, k, v) { onChange(profiles.map((p, idx) => idx === i ? { ...p, [k]: parseFloat(v)||0 } : p)); }
  return (
    <div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:'#161920' }}>
            {[...columns.map(c=>c.label),''].map(h => <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'#5a6080', borderBottom:'1px solid #1e2230', fontWeight:600, fontSize:10, textTransform:'uppercase' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {profiles.map((p, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #0f1117' }}>
                {columns.map(({ key }) => (
                  <td key={key} style={{ padding:'4px 6px' }}>
                    <input type="number" value={p[key]||''} onChange={e=>update(i,key,e.target.value)} style={{ padding:'5px 8px', fontSize:12, background:'#1e2230', border:'1px solid #2e3448', borderRadius:6, width:'90px', color:'#e8eaf0' }} />
                  </td>
                ))}
                <td style={{ padding:'4px 6px' }}><button className="danger" style={{ fontSize:10, padding:'3px 8px' }} onClick={()=>onChange(profiles.filter((_,idx)=>idx!==i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={{ marginTop:8, fontSize:11, padding:'5px 12px', width:'100%', background:'transparent', border:'1px dashed #2e3448', color:'#5a6080' }} onClick={addRow}>+ Adicionar linha</button>
    </div>
  );
}

export default function Aircraft({ aircraft=[], reload, onImportPOH }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('basic');
  const [deleting, setDeleting] = useState(false);
  const ms = useMultiSelect(aircraft);

  function startNew() { setForm({...EMPTY}); setEditing('new'); setSearchQuery(''); setTab('basic'); }
  function startEdit(ac) { setForm({...ac, performanceProfiles:ac.performanceProfiles||[], climbProfiles:ac.climbProfiles||[]}); setEditing(ac.id); setSearchQuery(`${ac.manufacturer} ${ac.model}`); setTab('basic'); getComponents(ac.id).then(setComponents).catch(()=>{}); }
  function cancel() { setEditing(null); }
  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  async function submit(e) { e.preventDefault(); await saveAircraft(form); reload(); setEditing(null); }
  async function remove(id) { if(window.confirm('Remover aeronave e todos os dados vinculados (voos, custos, manutenção)?')){ await deleteCascade([id]); reload(); } }

  async function bulkDelete() {
    const n = ms.count;
    if (!window.confirm(`Remover ${n} aeronave${n>1?'s':''} e TODOS os dados vinculados?\n\nEsta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    await deleteCascade(ms.selectedIds);
    ms.clear();
    reload();
    setDeleting(false);
  }
  function applyDB(db) {
    setForm(f=>({
      ...f,
      manufacturer:      db.manufacturer || f.manufacturer,
      model:             db.model || f.model,
      type:              db.type || f.type,
      engineModel:       db.engineModel || f.engineModel,
      engineTboHours:    db.engineTboHours || f.engineTboHours,
      propModel:         db.propModel || f.propModel || '',
      propTboHours:      db.propTboHours || f.propTboHours,
      fuelType:          db.fuelType || f.fuelType,
      fuelCapacityLiters:db.fuelCapacityLiters || f.fuelCapacityLiters,
      performanceProfiles: db.performance?.length ? db.performance : f.performanceProfiles,
      climbProfiles:     db.climbData?.length ? db.climbData : f.climbProfiles,
      // novos campos do banco expandido
      ...(db.engineShp    && { engineShp:    db.engineShp }),
      ...(db.rangeNm      && { rangeNm:      db.rangeNm }),
      ...(db.mtowKg       && { mtowKg:       db.mtowKg }),
      ...(db.maxCruiseKtas && { maxCruiseKtas: db.maxCruiseKtas }),
      ...(db.serviceCeilingFt && { serviceCeilingFt: db.serviceCeilingFt }),
      ...(db.numEngines   && { numEngines:   db.numEngines }),
    }));
    setSearchQuery(`${db.manufacturer} ${db.model}`);
  }

  const [biasMap, setBiasMap] = useState({});
  const [components, setComponents] = useState([]);
  const [showAddComp, setShowAddComp] = useState(null); // 'engine' | 'propeller' | null
  const [newComp, setNewComp] = useState({});
  useEffect(() => {
    aircraft.forEach(async ac => {
      const b = await computeFuelBias(ac.id);
      setBiasMap(m => ({ ...m, [ac.id]: b }));
    });
  }, [aircraft]);

  const TABS = [{ id:'basic',label:'Identificação'},{ id:'engine',label:'Motor'},{ id:'propeller',label:'Hélice'},{ id:'hours',label:'Célula'},{ id:'perf',label:'Performance'},{ id:'climb',label:'Subida'}];
  const perfCols = [{ key:'altFt',label:'Alt (ft)'},{ key:'power',label:'Pot (%)'},{ key:'ktas',label:'KTAS'},{ key:'fuelLph',label:'L/h'}];
  const climbCols = [{ key:'altFromFt',label:'De (ft)'},{ key:'altToFt',label:'Para (ft)'},{ key:'kias',label:'KIAS'},{ key:'fpm',label:'ft/min'},{ key:'fuelLph',label:'L/h'},{ key:'distNm',label:'nm'}];

  if (editing !== null) return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={cancel}>← Voltar</button>
        <div style={{ fontSize:16, fontWeight:700 }}>{editing==='new'?'Cadastrar aeronave':'Editar aeronave'}</div>
      </div>
      {editing==='new' && (
        <div className="card" style={{ padding:'14px 18px', marginBottom:16, borderColor:'#4a9eff44' }}>
          <div style={{ fontSize:11, color:'#4a9eff', fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>Busca na base de dados</div>
          <DBSearch value={searchQuery} onChange={setSearchQuery} onSelect={applyDB} />
          <div style={{ fontSize:11, color:'#5a6080', marginTop:6 }}>Digite o modelo para preencher specs automaticamente — 116+ modelos: Cessna, Beechcraft, Piper, Gulfstream, Bombardier, Dassault, Embraer, Pilatus, TBM, Cirrus e mais</div>
        </div>
      )}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid #1e2230' }}>
        {TABS.map(t => <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'8px 16px', border:'none', background:'transparent', color:tab===t.id?'#4a9eff':'#5a6080', fontWeight:tab===t.id?600:400, fontSize:12, cursor:'pointer', borderBottom:tab===t.id?'2px solid #4a9eff':'2px solid transparent', borderRadius:0 }}>{t.label}</button>)}
      </div>
      <form onSubmit={submit} style={{ maxWidth:720 }}>
        {tab==='basic' && <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="g3" style={{ marginBottom:14 }}>
            <div><label>Matrícula *</label><input required value={form.registration} onChange={e=>set('registration',e.target.value.toUpperCase())} placeholder="PP-XRV" /></div>
            <div><label>Tipo *</label><select required value={form.type} onChange={e=>set('type',e.target.value)}><option value="single_engine">Monomotor</option><option value="multi_engine">Bimotor</option><option value="turboprop">Turboélice</option><option value="jet">Jato</option><option value="experimental">Experimental</option></select></div>
            <div><label>Ano</label><input type="number" value={form.year} onChange={e=>set('year',e.target.value)} /></div>
          </div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Fabricante *</label><input required value={form.manufacturer} onChange={e=>set('manufacturer',e.target.value)} placeholder="Cessna" /></div>
            <div><label>Modelo *</label><input required value={form.model} onChange={e=>set('model',e.target.value)} placeholder="172S Skyhawk" /></div>
          </div>
          <div className="g2">
            <div><IcaoInput label="Base ICAO" value={form.homeBase||''} onChange={v=>set('homeBase',v)} placeholder="SBBR" /></div>
            <div><label>Custo fixo mensal (R$)</label><input type="number" value={form.monthlyFixed||''} onChange={e=>set('monthlyFixed',e.target.value)} placeholder="2200" /></div>
          </div>
        </div>}
        {tab==='engine' && <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="g3" style={{ marginBottom:14 }}>
            <div style={{ gridColumn:'1/3' }}><label>Modelo do motor</label><input value={form.engineModel||''} onChange={e=>set('engineModel',e.target.value)} placeholder="Lycoming IO-360-L2A" /></div>
            <div><label>TBO motor (h)</label><input type="number" value={form.engineTboHours||''} onChange={e=>set('engineTboHours',e.target.value)} placeholder="2000" /></div>
          </div>
          <div className="g3" style={{ marginBottom:14 }}>
            <div style={{ gridColumn:'1/3' }}><label>Modelo da hélice</label><input value={form.propModel||''} onChange={e=>set('propModel',e.target.value)} placeholder="McCauley 1C160" /></div>
            <div><label>TBO hélice (h)</label><input type="number" value={form.propTboHours||''} onChange={e=>set('propTboHours',e.target.value)} placeholder="2400" /></div>
          </div>
          {/* APU — para jatos e turboélices */}
          {['jet','turboprop'].includes(form.type) && (
            <div className="g3" style={{ marginBottom:14, padding:'12px 14px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ gridColumn:'1/3', marginBottom:6 }}>
                <div className="section-title" style={{ margin:0 }}>APU (Auxiliary Power Unit)</div>
              </div>
              <div style={{ gridColumn:'1/3' }}><label>Modelo do APU</label><input value={form.apuModel||''} onChange={e=>set('apuModel',e.target.value)} placeholder="Honeywell RE220, APS 3200..." /></div>
              <div><label>TBO APU (h)</label><input type="number" value={form.apuTboHours||''} onChange={e=>set('apuTboHours',e.target.value)} placeholder="5000" /></div>
              <div><label>Horas totais APU</label><input type="number" step="0.1" value={form.apuTotalHours||''} onChange={e=>set('apuTotalHours',e.target.value)} placeholder="1250.0" /></div>
              <div><label>Ciclos APU</label><input type="number" value={form.apuCycles||''} onChange={e=>set('apuCycles',e.target.value)} placeholder="3200" /></div>
            </div>
          )}
          <div className="g3">
            <div><label>Combustível</label><select value={form.fuelType||'avgas_100ll'} onChange={e=>set('fuelType',e.target.value)}><option value="avgas_100ll">AVGAS 100LL</option><option value="mogas">MOGAS</option><option value="jet_a1">JET-A1</option></select></div>
            <div><label>Capacidade (L)</label><input type="number" value={form.fuelCapacityLiters||''} onChange={e=>set('fuelCapacityLiters',e.target.value)} placeholder="212" /></div>
            <div><label>Fuel bias manual (%)</label><input type="number" step="0.1" value={form.fuelBiasManual||''} onChange={e=>set('fuelBiasManual',e.target.value?parseFloat(e.target.value):null)} placeholder="+5 ou -2" /></div>
          </div>
        </div>}
        
      {tab==='propeller' && <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/3' }}><label>Modelo da hélice</label><input value={form.propModel||''} onChange={e=>set('propModel',e.target.value)} placeholder="McCauley 1C160/DTM7553" /></div>
          <div><label>Número de série</label><input value={form.propSerial||''} onChange={e=>set('propSerial',e.target.value)} placeholder="AB-12345" /></div>
          <div><label>TBO hélice (h)</label><input type="number" value={form.propTboHours||''} onChange={e=>set('propTboHours',e.target.value)} placeholder="2400" /></div>
          <div><label>TBO hélice (anos)</label><input type="number" value={form.propTboYears||''} onChange={e=>set('propTboYears',e.target.value)} placeholder="6" /></div>
          <div><label>Horas desde overhaul</label><input type="number" step="0.1" value={form.propTso||''} onChange={e=>set('propTso',e.target.value)} placeholder="0" /></div>
        </div>
        <hr style={{ margin:'16px 0', borderColor:'var(--border2)' }} />
        <div className="section-title">Componentes instalados — Hélice</div>
        {components.filter(c=>c.type==='propeller' && c.status==='active').map(c=>(
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg1)', borderRadius:8, marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>{c.manufacturer} {c.model}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>S/N: {c.serialNumber||'—'} · TBO: {c.tboHours||'?'}h · Instalada: {c.installedDate}</div>
            </div>
            <button type="button" style={{ fontSize:11, color:'#ff6b6b', background:'none', border:'1px solid #ff6b6b44', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}
              onClick={()=>{ if(window.confirm('Registrar remoção desta hélice?')) removeComponent(c.id, form.totalAirframeHours||null,'swap').then(()=>getComponents(form.id).then(setComponents)).catch(e=>alert(e.message)); }}>
              Remover
            </button>
          </div>
        ))}
        {components.filter(c=>c.type==='propeller' && c.status==='removed').length>0 && (
          <details style={{ marginTop:8 }}>
            <summary style={{ fontSize:12, color:'var(--text3)', cursor:'pointer' }}>Histórico removidos ({components.filter(c=>c.type==='propeller'&&c.status==='removed').length})</summary>
            {components.filter(c=>c.type==='propeller'&&c.status==='removed').map(c=>(
              <div key={c.id} style={{ padding:'8px 12px', background:'var(--bg0)', borderRadius:6, margin:'4px 0', fontSize:12, color:'var(--text3)', opacity:0.7 }}>
                <span style={{ fontWeight:600 }}>{c.manufacturer} {c.model}</span> · Removida: {c.removedDate} · Motivo: {c.removedReason}
              </div>
            ))}
          </details>
        )}
        <button type="button" className="secondary" style={{ marginTop:10, fontSize:12 }}
          onClick={()=>setShowAddComp('propeller')}>
          + Adicionar hélice
        </button>
      </div>}
      {tab==='hours' && <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="g3" style={{ marginBottom:12 }}>
            <div><label>Horas célula (base)</label><input type="number" step="0.1" value={form.baseAirframeHours||''} onChange={e=>set('baseAirframeHours',e.target.value)} placeholder="1240.0" /></div>
            <div><label>Horas motor SMOH</label><input type="number" step="0.1" value={form.totalEngineHours||''} onChange={e=>set('totalEngineHours',e.target.value)} placeholder="640.0" /></div>
            <div><label>Ciclos totais</label><input type="number" value={form.totalCycles||0} onChange={e=>set('totalCycles',e.target.value)} placeholder="820" /></div>
          </div>
          <div style={{ padding:'10px 14px', background:'#1e2230', borderRadius:8, fontSize:11, color:'#9aa0b8' }}>Os voos registrados no sistema são somados automaticamente às horas de base acima.</div>
        </div>}
        {tab==='perf' && <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div className="section-title" style={{ margin:0 }}>Tabela de cruzeiro (POH)</div>
            <div style={{ fontSize:11, color:'#5a6080' }}>Altitude × Potência → KTAS + L/h</div>
          </div>
          <EditableTable profiles={form.performanceProfiles||[]} columns={perfCols} onChange={v=>set('performanceProfiles',v)} addRow={()=>set('performanceProfiles',[...(form.performanceProfiles||[]),{altFt:8500,power:65,ktas:0,fuelLph:0}])} />
          {(form.performanceProfiles||[]).length > 0 && (
            <div style={{ marginTop:12, padding:'10px 14px', background:'#0d3320', border:'1px solid #3dd68c44', borderRadius:8, fontSize:11, color:'#3dd68c' }}>
              {form.performanceProfiles.length} perfis · Consumo médio: {(form.performanceProfiles.reduce((s,p)=>s+p.fuelLph,0)/form.performanceProfiles.length).toFixed(1)} L/h · Velocidade média: {Math.round(form.performanceProfiles.reduce((s,p)=>s+p.ktas,0)/form.performanceProfiles.length)} KTAS
            </div>
          )}
        </div>}
        {tab==='climb' && <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div className="section-title" style={{ margin:0 }}>Perfil de subida por segmento</div>
            <div style={{ fontSize:11, color:'#5a6080' }}>Blocos de altitude com razão, consumo e distância horizontal</div>
          </div>
          <EditableTable profiles={form.climbProfiles||[]} columns={climbCols} onChange={v=>set('climbProfiles',v)} addRow={()=>set('climbProfiles',[...(form.climbProfiles||[]),{altFromFt:0,altToFt:4500,kias:76,fpm:700,fuelLph:40,distNm:10}])} />
        </div>}
        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar aeronave</button>
          <button type="button" onClick={cancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding:24 }}>
      {/* Bulk bar */}
      {ms.count > 0 && (
        <div className="bulk-bar">
          <input type="checkbox" checked={ms.allSelected} onChange={ms.toggleAll} style={{ width:15, height:15 }} />
          <span>{ms.count} selecionada{ms.count>1?'s':''}</span>
          <button className="destructive" onClick={bulkDelete} disabled={deleting} style={{ fontSize:12, padding:'5px 14px' }}>
            {deleting ? 'Removendo...' : `🗑 Remover ${ms.count} aeronave${ms.count>1?'s':''} + todos os dados`}
          </button>
          <button className="ghost" onClick={ms.clear} style={{ fontSize:12 }}>Cancelar</button>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Aeronaves</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{aircraft.length} aeronave(s)</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {onImportPOH && <button onClick={onImportPOH} style={{ fontSize:12 }}>📖 Importar POH</button>}
          <button className="primary" onClick={startNew}>+ Nova aeronave</button>
        </div>
      </div>

      {aircraft.length===0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✈</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Nenhuma aeronave cadastrada</div>
          <button className="primary" onClick={startNew}>Cadastrar primeira aeronave</button>
        </div>
      ) : aircraft.map(ac => {
        const tbo    = parseFloat(ac.totalEngineHours)||0;
        const tboMax = parseFloat(ac.engineTboHours)||2000;
        const bias   = biasMap[ac.id];
        const isSel  = ms.isSelected(ac.id);
        return (
          <div key={ac.id} className="card animate-in" style={{ padding:'18px 20px', marginBottom:12, display:'flex', alignItems:'center', gap:14, borderLeft: isSel ? '3px solid var(--blue)' : '3px solid transparent', background: isSel ? 'var(--blue-dim)' : 'var(--bg1)', overflow:'hidden', minWidth:0 }}>
            {/* Checkbox */}
            <input type="checkbox" checked={isSel} onChange={() => ms.toggle(ac.id)} onClick={e=>e.stopPropagation()} style={{ width:15, height:15, flexShrink:0 }} />
            <AcIcon type={ac.type} size={44} />
            <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:400, color:'var(--text1)' }}>{ac.registration}</div>
              <div style={{ fontSize:12, color:'var(--text2)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ac.manufacturer} {ac.model}{ac.year?` · ${ac.year}`:''}  {ac.engineModel ? `· ${ac.engineModel}` : ''}</div>
              <div style={{ marginTop:6, display:'flex', gap:5, flexWrap:'wrap' }}>
                <span className={`tag tag-${ac.type==='single_engine'?'mono':ac.type==='multi_engine'?'bi':ac.type==='jet'?'jet':ac.type==='turboprop'?'tp':'exp'}`}>{ac.type==='single_engine'?'Monomotor':ac.type==='multi_engine'?'Bimotor':ac.type==='turboprop'?'Turboélice':ac.type==='jet'?'Jato':'Experimental'}</span>
                {ac.performanceProfiles?.length > 0 && <span className="tag tag-ok">{ac.performanceProfiles.length} perfis POH</span>}
                {bias !== null && <span className={`tag ${parseFloat(bias)>5?'tag-warn':'tag-ok'}`}>Bias {bias>0?'+':''}{bias}%</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              <ArcGauge value={tbo.toFixed(1)} max={tboMax} label="Motor" unit="h" size={80} color="var(--green)" warning={.75} danger={.9} />
              <ArcGauge value={parseInt(ac.totalCycles||0)} max={Math.max(1000,(ac.totalCycles||0)+100)} label="Ciclos" unit="ldg" size={80} color="var(--purple)" />
            </div>
            <div style={{ minWidth:120, maxWidth:140, flexShrink:0 }}>
              {ac.engineTboHours && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)', marginBottom:3 }}>
                    <span>TBO restante</span>
                    <span style={{ color:(tboMax-tbo)/tboMax<.15?'var(--red)':'var(--green)', fontFamily:'var(--font-mono)' }}>{Math.max(0,tboMax-tbo).toFixed(0)}h</span>
                  </div>
                  <ProgressBar value={tbo} max={tboMax} color="var(--green)" />
                </div>
              )}
              {ac.homeBase && <div style={{ fontSize:11, color:'var(--text3)' }}>Base: <span style={{ color:'var(--text2)', fontFamily:'var(--font-mono)' }}>{ac.homeBase}</span></div>}
              {ac.monthlyFixed && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Fixo/mês: <span style={{ color:'var(--amber)', fontFamily:'var(--font-mono)' }}>R$ {parseFloat(ac.monthlyFixed).toLocaleString('pt-BR')}</span></div>}
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button style={{ fontSize:12, padding:'6px 12px' }} onClick={()=>startEdit(ac)}>Editar</button>
              <button className="danger" style={{ fontSize:12, padding:'6px 10px' }} onClick={()=>remove(ac.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
