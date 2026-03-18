import React, { useState, useMemo, useEffect } from 'react';
import { saveCost, deleteCost, bulkUpdateCosts, bulkDeleteCosts, getCostCategories } from '../store';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CATS = [
  { v:'fuel',            label:'Combustível',            group:'op_direct',   costType:'variable', icon:'⛽' },
  { v:'airport_fees',    label:'Taxas aeroportuárias',   group:'op_direct',   costType:'variable', icon:'🏛' },
  { v:'nav_fees',        label:'Taxas de navegação',     group:'op_direct',   costType:'variable', icon:'🗺' },
  { v:'handling',        label:'Handling / Ground',      group:'op_direct',   costType:'variable', icon:'🛒' },
  { v:'catering',        label:'Catering',               group:'op_direct',   costType:'variable', icon:'🍽' },
  { v:'overflight',      label:'Sobrevoo / Permissões',  group:'op_direct',   costType:'variable', icon:'✈' },
  { v:'scheduled_mx',    label:'MX Programada',          group:'maintenance', costType:'variable', icon:'🔧' },
  { v:'unscheduled_mx',  label:'MX Não Programada',      group:'maintenance', costType:'variable', icon:'🚨' },
  { v:'engine_reserve',  label:'Reserva Motor (TBO)',    group:'maintenance', costType:'reserve',  icon:'🔩' },
  { v:'prop_reserve',    label:'Reserva Hélice (TBO)',   group:'maintenance', costType:'reserve',  icon:'🌀' },
  { v:'apu_reserve',     label:'Reserva APU',            group:'maintenance', costType:'reserve',  icon:'⚙' },
  { v:'avionics_mx',     label:'Aviônica / Elétrica',    group:'maintenance', costType:'variable', icon:'📡' },
  { v:'airframe_mx',     label:'Célula / Estrutural',    group:'maintenance', costType:'variable', icon:'🛠' },
  { v:'insurance',       label:'Seguro aeronáutico',     group:'fixed_op',    costType:'fixed',    icon:'🛡' },
  { v:'hangar',          label:'Hangar / Tie-down',      group:'fixed_op',    costType:'fixed',    icon:'🏠' },
  { v:'crew',            label:'Tripulação (fixo)',       group:'fixed_op',    costType:'fixed',    icon:'👨‍✈️' },
  { v:'crew_variable',   label:'Tripulação (variável)',  group:'fixed_op',    costType:'variable', icon:'👨‍✈️' },
  { v:'training',        label:'Treinamento / Sim',      group:'fixed_op',    costType:'fixed',    icon:'🎓' },
  { v:'subscriptions',   label:'Assinaturas / Software', group:'admin',       costType:'fixed',    icon:'💻' },
  { v:'licenses',        label:'Licenças / CMA / ANAC',  group:'admin',       costType:'fixed',    icon:'📋' },
  { v:'admin',           label:'Administrativo geral',   group:'admin',       costType:'fixed',    icon:'📁' },
  { v:'financing',       label:'Financiamento / Leasing',group:'admin',       costType:'fixed',    icon:'🏦' },
  { v:'depreciation',    label:'Depreciação',            group:'other',       costType:'fixed',    icon:'📉' },
  { v:'other',           label:'Outros',                 group:'other',       costType:'variable', icon:'📦' },
];

const GROUPS = {
  op_direct:   { label:'Operacional direto',  color:'#4d9de0' },
  maintenance: { label:'Manutenção',          color:'#e8a84a' },
  fixed_op:    { label:'Fixo operacional',    color:'#3dbf8a' },
  admin:       { label:'Administrativo',      color:'#9b7fe8' },
  other:       { label:'Outros',              color:'#888' },
};

const COST_TYPES = [
  { v:'variable', label:'Variável' },
  { v:'fixed',    label:'Fixo' },
  { v:'reserve',  label:'Reserva (TBO/Overhaul)' },
  { v:'capital',  label:'Capital / Investimento' },
];

const EMPTY = {
  aircraftId:'', flightId:'', category:'fuel', costType:'variable',
  amountBrl:'', description:'', referenceDate:new Date().toISOString().slice(0,10),
  invoiceNumber:'', vendor:'', engineHoursAtCost:'',
  recurrence:'once', recurrenceDay:'', recurrenceEnd:'', billingPeriod:'',
};

function fmtBrl(v) { return 'R$ ' + Math.round(v||0).toLocaleString('pt-BR'); }
function fmtBrl2(v) { return 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2}); }

export default function Costs({ costs=[], aircraft=[], flights=[], reload, preselFlight, onScanReceipt }) {
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [tab, setTab]                 = useState('list');
  const [filterAc, setFilterAc]       = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType]   = useState('');
  const [filterFrom, setFilterFrom]   = useState('');
  const [filterTo, setFilterTo]       = useState('');
  const [deleting, setDeleting]       = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkPatch, setBulkPatch]     = useState({});
  const [customCats, setCustomCats]   = useState([]);
  const ms = useMultiSelect(costs);

  useEffect(() => {
    getCostCategories().then(setCustomCats).catch(() => {});
  }, []);

  // All categories: built-in + custom
  const allCats = useMemo(() => [
    ...CATS,
    ...customCats.map(c => ({ v: `custom_${c.id}`, label: c.name, group: c.group_type || 'other', costType: 'variable', icon: c.icon || '📦', custom: true }))
  ], [customCats]);

  const filtered = useMemo(() => costs.filter(c => {
    if (filterAc    && c.aircraftId !== filterAc) return false;
    if (filterGroup) { const cat = CATS.find(x => x.v === c.category); if (!cat || cat.group !== filterGroup) return false; }
    if (filterType  && c.costType !== filterType) return false;
    if (filterFrom  && (c.referenceDate||'') < filterFrom) return false;
    if (filterTo    && (c.referenceDate||'') > filterTo)   return false;
    return true;
  }).sort((a,b) => (b.referenceDate||'').localeCompare(a.referenceDate||'')), [costs, filterAc, filterGroup, filterType, filterFrom, filterTo]);

  const analytics = useMemo(() => {
    const src = filterAc ? costs.filter(c => c.aircraftId === filterAc) : costs;
    const total = src.reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
    const byGroup = {};
    Object.keys(GROUPS).forEach(g => { byGroup[g] = 0; });
    src.forEach(c => { const cat = CATS.find(x => x.v === c.category); if (cat) byGroup[cat.group] = (byGroup[cat.group]||0) + parseFloat(c.amountBrl||0); });
    const groupData = Object.entries(byGroup).filter(([,v]) => v > 0).map(([k,v]) => ({ name: GROUPS[k].label, value: Math.round(v), color: GROUPS[k].color, pct: total > 0 ? Math.round(v/total*100) : 0 })).sort((a,b) => b.value-a.value);
    const byType = { variable:0, fixed:0, reserve:0, capital:0 };
    src.forEach(c => { byType[c.costType] = (byType[c.costType]||0) + parseFloat(c.amountBrl||0); });
    const monthly = {};
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth()-i); const k = d.toISOString().slice(0,7); monthly[k] = { label: d.toLocaleDateString('pt-BR',{month:'short'}), total:0, variable:0, fixed:0, reserve:0 }; }
    src.forEach(c => { const k = (c.referenceDate||'').slice(0,7); if (monthly[k]) { monthly[k].total += parseFloat(c.amountBrl||0); monthly[k][c.costType] = (monthly[k][c.costType]||0) + parseFloat(c.amountBrl||0); } });
    return { total, groupData, byType, monthly: Object.values(monthly).map(v => ({ ...v, total:Math.round(v.total), variable:Math.round(v.variable||0), fixed:Math.round(v.fixed||0), reserve:Math.round(v.reserve||0) })) };
  }, [costs, filterAc]);

  const pricing = useMemo(() => {
    const src = filterAc ? costs.filter(c => c.aircraftId === filterAc) : costs;
    const ac = aircraft.find(a => a.id === filterAc);
    const totalHours = flights.filter(f => !filterAc || f.aircraftId === filterAc).reduce((s,f) => s + (f.flightTimeMinutes||0), 0) / 60;
    const totalFixed    = src.filter(c => c.costType === 'fixed').reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
    const totalVariable = src.filter(c => c.costType === 'variable').reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
    const totalReserve  = src.filter(c => c.costType === 'reserve').reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
    const total = totalFixed + totalVariable + totalReserve;
    const cph = totalHours > 0 ? total / totalHours : 0;
    const engineReserveAcc = src.filter(c => ['engine_reserve','apu_reserve','prop_reserve'].includes(c.category)).reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
    return { totalFixed, totalVariable, totalReserve, total, totalHours, cph, cphFixed: totalHours>0?totalFixed/totalHours:0, cphVariable: totalHours>0?totalVariable/totalHours:0, cphReserve: totalHours>0?totalReserve/totalHours:0, engineReserveAcc, ac };
  }, [costs, flights, aircraft, filterAc]);

  function startNew() {
    const init = { ...EMPTY, aircraftId: aircraft[0]?.id || '' };
    if (preselFlight) { init.flightId = preselFlight.id; init.aircraftId = preselFlight.aircraftId; init.referenceDate = preselFlight.date; }
    setForm(init); setEditing('new');
  }
  function startEdit(c) { setForm({...c}); setEditing(c.id); }
  function cancel() { setEditing(null); }
  function set(k,v) { setForm(f => { const n = {...f,[k]:v}; if(k==='category'){ const c=CATS.find(x=>x.v===v); if(c) n.costType=c.costType; } return n; }); }
  async function submit(e) { e.preventDefault(); await saveCost({...form, amountBrl: parseFloat(form.amountBrl)||0}); reload(); setEditing(null); }
  async function remove(id) { if(window.confirm('Remover?')){ await deleteCost(id); reload(); } }
  async function bulkDelete() {
    if (!window.confirm(`Remover ${ms.count} lançamento(s)?`)) return;
    setDeleting(true);
    await bulkDeleteCosts(ms.selectedIds);
    ms.clear(); reload(); setDeleting(false);
  }

  async function applyBulkEdit() {
    if (ms.count === 0 || Object.keys(bulkPatch).length === 0) return;
    await bulkUpdateCosts(ms.selectedIds, bulkPatch);
    ms.clear(); setBulkEditOpen(false); setBulkPatch({}); reload();
  }

  const totalFiltered = filtered.reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
  const acFlights = form.aircraftId ? flights.filter(f => f.aircraftId === form.aircraftId) : [];

  if (editing !== null) return (
    <div style={{ padding:24, maxWidth:640 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={cancel}>← Voltar</button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:20, fontWeight:400 }}>Lançar custo</div>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Identificação</div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Aeronave *</label><select required value={form.aircraftId} onChange={e=>set('aircraftId',e.target.value)}><option value="">Selecione...</option>{aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}</select></div>
            <div><label>Voo vinculado</label><select value={form.flightId} onChange={e=>set('flightId',e.target.value)}><option value="">— Custo sem voo —</option>{acFlights.sort((a,b)=>b.date.localeCompare(a.date)).map(f=><option key={f.id} value={f.id}>{f.date} · {f.departureIcao}→{f.destinationIcao}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label>Categoria *</label>
            <select required value={form.category} onChange={e=>set('category',e.target.value)}>
              {Object.entries(GROUPS).map(([gk,g]) => (
                <optgroup key={gk} label={g.label}>
                  {CATS.filter(c=>c.group===gk).map(c=><option key={c.v} value={c.v}>{c.icon} {c.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="g2">
            <div><label>Tipo de custo *</label><select value={form.costType} onChange={e=>set('costType',e.target.value)}>{COST_TYPES.map(t=><option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
            <div><label>Horas motor (opcional)</label><input type="number" step="0.1" value={form.engineHoursAtCost||''} onChange={e=>set('engineHoursAtCost',e.target.value)} placeholder="1240.5" /></div>
          </div>
        </div>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Valores</div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Valor (R$) *</label><input type="number" required step="0.01" min="0" value={form.amountBrl} onChange={e=>set('amountBrl',e.target.value)} placeholder="0,00" /></div>
            <div><label>Data de competência *</label><input type="date" required value={form.referenceDate} onChange={e=>set('referenceDate',e.target.value)} /></div>
          </div>
          <div style={{ marginBottom:14 }}><label>Descrição</label><input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Ex: AVGAS 100LL — 80L @ R$8,50" /></div>
          <div className="g2">
            <div><label>Fornecedor</label><input value={form.vendor} onChange={e=>set('vendor',e.target.value)} /></div>
            <div><label>Nº NF / Recibo</label><input value={form.invoiceNumber} onChange={e=>set('invoiceNumber',e.target.value)} /></div>
          </div>
        </div>

        {/* Recorrência */}
        <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
          <div className="section-title">Recorrência</div>
          <div className="g3" style={{ marginBottom: form.recurrence !== 'once' ? 10 : 0 }}>
            <div>
              <label>Tipo</label>
              <select value={form.recurrence||'once'} onChange={e=>set('recurrence',e.target.value)}>
                <option value="once">Avulso (único)</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
                <option value="per_hour">Por hora voada</option>
                <option value="per_cycle">Por ciclo / pouso</option>
              </select>
            </div>
            {form.recurrence === 'monthly' && (
              <div><label>Dia do mês</label><input type="number" min="1" max="31" value={form.recurrenceDay||''} onChange={e=>set('recurrenceDay',e.target.value)} placeholder="1–31" /></div>
            )}
            {form.recurrence !== 'once' && (
              <div><label>Data fim</label><input type="date" value={form.recurrenceEnd||''} onChange={e=>set('recurrenceEnd',e.target.value)} /></div>
            )}
          </div>
          {form.recurrence !== 'once' && (
            <div><label>Período de referência (ex: 2024-03)</label><input value={form.billingPeriod||''} onChange={e=>set('billingPeriod',e.target.value)} placeholder="AAAA-MM" style={{ maxWidth:180 }} /></div>
          )}
        </div>

        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar</button>
          <button type="button" onClick={cancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding:24 }}>
      {ms.count > 0 && (
        <div className="bulk-bar">
          <input type="checkbox" checked={ms.allSelected} onChange={ms.toggleAll} style={{ width:15,height:15 }} />
          <span>{ms.count} selecionado(s) · {fmtBrl2(ms.selectedIds.reduce((s,id)=>{ const c=costs.find(x=>x.id===id); return s+parseFloat(c?.amountBrl||0); },0))}</span>
          <button style={{ fontSize:12, padding:'5px 14px', background:'var(--blue-dim)', color:'var(--blue)', border:'1px solid var(--blue-mid)', borderRadius:7 }} onClick={() => { setBulkPatch({}); setBulkEditOpen(true); }}>✎ Editar {ms.count}</button>
          <button className="destructive" onClick={bulkDelete} disabled={deleting} style={{ fontSize:12, padding:'5px 14px' }}>{deleting?'Removendo...':`🗑 Remover ${ms.count}`}</button>
          <button className="ghost" onClick={ms.clear} style={{ fontSize:12 }}>Cancelar</button>
        </div>
      )}

      {/* ── BULK EDIT MODAL ──────────────────────────────────── */}
      {bulkEditOpen && (
        <div style={{ padding:'16px 20px', marginBottom:14, background:'var(--bg2)', border:'1px solid var(--blue-mid)', borderRadius:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--blue)' }}>Editar {ms.count} lançamento(s) em lote</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>Deixe em branco os campos que não quer alterar</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label>Categoria</label>
              <select value={bulkPatch.category||''} onChange={e => setBulkPatch(p => ({...p, category: e.target.value||undefined}))}>
                <option value="">— não alterar —</option>
                {Object.entries(GROUPS).map(([gk, gv]) => (
                  <optgroup key={gk} label={gv.label}>
                    {allCats.filter(c => c.group === gk).map(c => <option key={c.v} value={c.v}>{c.icon} {c.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label>Tipo de custo</label>
              <select value={bulkPatch.costType||''} onChange={e => setBulkPatch(p => ({...p, costType: e.target.value||undefined}))}>
                <option value="">— não alterar —</option>
                {COST_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label>Recorrência</label>
              <select value={bulkPatch.recurrence||''} onChange={e => setBulkPatch(p => ({...p, recurrence: e.target.value||undefined}))}>
                <option value="">— não alterar —</option>
                <option value="once">Avulso (único)</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
                <option value="per_hour">Por hora voada</option>
              </select>
            </div>
            <div>
              <label>Aeronave</label>
              <select value={bulkPatch.aircraftId||''} onChange={e => setBulkPatch(p => ({...p, aircraftId: e.target.value||undefined}))}>
                <option value="">— não alterar —</option>
                {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div>
              <label>Período de cobrança (ex: 2024-03)</label>
              <input value={bulkPatch.billingPeriod||''} onChange={e => setBulkPatch(p => ({...p, billingPeriod: e.target.value||undefined}))} placeholder="— não alterar —" />
            </div>
            <div>
              <label>Fornecedor / Empresa</label>
              <input value={bulkPatch.vendor||''} onChange={e => setBulkPatch(p => ({...p, vendor: e.target.value||undefined}))} placeholder="— não alterar —" />
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="primary" onClick={applyBulkEdit} disabled={Object.keys(bulkPatch).filter(k => bulkPatch[k] !== undefined).length === 0}>
              Aplicar em {ms.count} lançamento(s)
            </button>
            <button onClick={() => { setBulkEditOpen(false); setBulkPatch({}); }}>Cancelar</button>
          </div>
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Controle Financeiro</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{costs.length} lançamento(s) · Total: <span style={{ color:'var(--blue)', fontFamily:'var(--font-mono)' }}>{fmtBrl(costs.reduce((s,c)=>s+parseFloat(c.amountBrl||0),0))}</span></div>
        </div>
        {aircraft.length > 0 && <div style={{ display:'flex', gap:8 }}>{onScanReceipt && <button onClick={onScanReceipt} style={{ fontSize:12 }}>🧾 Digitalizar</button>}<button className="primary" onClick={startNew}>+ Lançar custo</button></div>}
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg2)', borderRadius:10, padding:4, width:'fit-content' }}>
        {[['list','📋 Lista'],['analytics','📊 Análise'],['pricing','💡 Precificação']].map(([v,l]) => (
          <button key={v} onClick={()=>setTab(v)} style={{ padding:'7px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background:tab===v?'var(--bg1)':'transparent', color:tab===v?'var(--text1)':'var(--text3)', boxShadow:tab===v?'0 1px 3px rgba(0,0,0,.15)':'' }}>{l}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select value={filterAc} onChange={e=>setFilterAc(e.target.value)} style={{ width:180 }}><option value="">Todas as aeronaves</option>{aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration}</option>)}</select>
        <select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} style={{ width:180 }}><option value="">Todos os grupos</option>{Object.entries(GROUPS).map(([k,g])=><option key={k} value={k}>{g.label}</option>)}</select>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ width:160 }}><option value="">Todos os tipos</option>{COST_TYPES.map(t=><option key={t.v} value={t.v}>{t.label}</option>)}</select>
        <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} style={{ width:140 }} />
        <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} style={{ width:140 }} />
        {(filterAc||filterGroup||filterType||filterFrom||filterTo) && <div style={{ padding:'6px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:12, color:'var(--blue)', fontFamily:'var(--font-mono)' }}>{fmtBrl(totalFiltered)} ({filtered.length})</div>}
        {(filterAc||filterGroup||filterType||filterFrom||filterTo) && <button className="ghost" style={{ fontSize:11 }} onClick={()=>{setFilterAc('');setFilterGroup('');setFilterType('');setFilterFrom('');setFilterTo('');}}>✕ Limpar</button>}
      </div>

      {tab === 'list' && (
        costs.length === 0 ? (
          <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
            <div style={{ fontWeight:600 }}>Nenhum custo lançado</div>
            {aircraft.length>0&&<button className="primary" style={{ marginTop:16 }} onClick={startNew}>Lançar primeiro custo</button>}
          </div>
        ) : (
          <div className="card" style={{ overflow:'hidden', padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'var(--bg2)' }}>
                <th style={{ padding:'9px 14px', width:36 }}><input type="checkbox" checked={ms.allSelected} onChange={ms.toggleAll} style={{ width:14,height:14 }} /></th>
                {['Data','Aeronave','Grupo','Categoria','Tipo','Valor','Descrição','Fornecedor','Voo',''].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:600, color:'var(--text3)', borderBottom:'1px solid var(--border)', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(c => {
                  const ac=aircraft.find(a=>a.id===c.aircraftId);
                  const fl=flights.find(f=>f.id===c.flightId);
                  const cat=CATS.find(x=>x.v===c.category);
                  const grp=cat?GROUPS[cat.group]:null;
                  const isSel=ms.isSelected(c.id);
                  const typeStyle = { variable:{bg:'var(--blue-dim)',color:'var(--blue)'}, fixed:{bg:'var(--purple-dim)',color:'var(--purple)'}, reserve:{bg:'var(--amber-dim)',color:'var(--amber)'}, capital:{bg:'var(--green-dim)',color:'var(--green)'} }[c.costType] || {};
                  const recurrLabel = { monthly:'↻ Mensal', annual:'↻ Anual', quarterly:'↻ Trim.', daily:'↻ Diário', weekly:'↻ Sem.', per_hour:'↻/h', per_cycle:'↻/cic.' }[c.recurrence];
                  return (
                    <tr key={c.id} className={isSel?'row-selected':''} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'9px 14px' }}><input type="checkbox" checked={isSel} onChange={()=>ms.toggle(c.id)} style={{ width:14,height:14 }} /></td>
                      <td style={{ padding:'9px 12px', whiteSpace:'nowrap', fontFamily:'var(--font-mono)', fontSize:11 }}>
                        {c.referenceDate?new Date(c.referenceDate+'T12:00:00').toLocaleDateString('pt-BR'):'—'}
                        {recurrLabel && <div style={{ fontSize:9, color:'var(--purple)', fontWeight:600 }}>{recurrLabel}</div>}
                      </td>
                      <td style={{ padding:'9px 12px' }}><span className={`tag tag-${ac?.type==='single_engine'?'mono':ac?.type==='multi_engine'?'bi':'exp'}`}>{ac?.registration||'?'}</span></td>
                      <td style={{ padding:'9px 12px' }}>{grp&&<span style={{ fontSize:10, padding:'2px 6px', background:`${grp.color}22`, color:grp.color, borderRadius:6, fontWeight:600 }}>{grp.label}</span>}</td>
                      <td style={{ padding:'9px 12px', fontSize:11 }}>{cat?.icon} {cat?.label||c.category}</td>
                      <td style={{ padding:'9px 12px' }}><span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, fontWeight:600, background:typeStyle.bg, color:typeStyle.color }}>{COST_TYPES.find(t=>t.v===c.costType)?.label||c.costType}</span></td>
                      <td style={{ padding:'9px 12px', fontWeight:600, color:'var(--blue)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>{fmtBrl2(c.amountBrl)}</td>
                      <td style={{ padding:'9px 12px', color:'var(--text2)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.description||'—'}</td>
                      <td style={{ padding:'9px 12px', color:'var(--text3)' }}>{c.vendor||'—'}</td>
                      <td style={{ padding:'9px 12px', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>{fl?`${fl.departureIcao}→${fl.destinationIcao}`:'—'}</td>
                      <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}><button style={{ fontSize:11, padding:'3px 8px', marginRight:6 }} onClick={()=>startEdit(c)}>Editar</button><button className="danger" style={{ fontSize:11, padding:'3px 8px' }} onClick={()=>remove(c.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'analytics' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Total geral', value:fmtBrl(analytics.total), sub:`${costs.length} lançamentos` },
              { label:'Variável', value:fmtBrl(analytics.byType.variable), sub:`${analytics.total>0?Math.round(analytics.byType.variable/analytics.total*100):0}%` },
              { label:'Fixo', value:fmtBrl(analytics.byType.fixed), sub:`${analytics.total>0?Math.round(analytics.byType.fixed/analytics.total*100):0}%` },
              { label:'Reserva TBO', value:fmtBrl(analytics.byType.reserve||0), sub:'capital provisionado' },
            ].map(k=>(
              <div key={k.label} style={{ padding:'14px 16px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:12 }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{k.label}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:19, color:'var(--text1)' }}>{k.value}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div className="section-title">Evolução mensal por tipo</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics.monthly} margin={{ top:4, right:4, bottom:0, left:0 }}>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} formatter={v=>[fmtBrl(v),'']} cursor={{ fill:'var(--bg3)' }} />
                  <Bar dataKey="variable" name="Variável" stackId="a" fill="#4d9de0" fillOpacity={.85} />
                  <Bar dataKey="fixed"    name="Fixo"     stackId="a" fill="#9b7fe8" fillOpacity={.85} />
                  <Bar dataKey="reserve"  name="Reserva"  stackId="a" fill="#e8a84a" fillOpacity={.85} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:12, marginTop:6 }}>
                {[['#4d9de0','Variável'],['#9b7fe8','Fixo'],['#e8a84a','Reserva']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}><div style={{ width:8,height:8,borderRadius:2,background:c }} />{l}</div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div className="section-title">Por grupo</div>
              {analytics.groupData.length > 0 ? analytics.groupData.map(g => (
                <div key={g.name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                    <span style={{ color:'var(--text2)', fontWeight:500 }}>{g.name}</span>
                    <span style={{ fontFamily:'var(--font-mono)', color:g.color }}>{fmtBrl(g.value)} <span style={{ color:'var(--text3)' }}>({g.pct}%)</span></span>
                  </div>
                  <div style={{ height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ width:`${g.pct}%`, height:'100%', background:g.color, borderRadius:3 }} />
                  </div>
                </div>
              )) : <div style={{ color:'var(--text3)', textAlign:'center', paddingTop:40, fontSize:12 }}>Sem dados</div>}
            </div>
          </div>
          <div className="card" style={{ padding:'14px 18px' }}>
            <div className="section-title">Breakdown por categoria</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'var(--bg2)' }}>
                {['Grupo','Categoria','Qtd','Total','Participação','Tipo'].map(h=>(
                  <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(() => {
                  const src = filterAc ? costs.filter(c=>c.aircraftId===filterAc) : costs;
                  const total = src.reduce((s,c)=>s+parseFloat(c.amountBrl||0),0);
                  const byCat = {};
                  src.forEach(c => { if(!byCat[c.category])byCat[c.category]={sum:0,cnt:0}; byCat[c.category].sum+=parseFloat(c.amountBrl||0); byCat[c.category].cnt++; });
                  return Object.entries(byCat).sort((a,b)=>b[1].sum-a[1].sum).map(([k,v]) => {
                    const cat=CATS.find(x=>x.v===k);
                    const grp=cat?GROUPS[cat.group]:null;
                    const pct=total>0?Math.round(v.sum/total*100):0;
                    return (
                      <tr key={k} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'7px 12px' }}>{grp&&<span style={{ fontSize:10, padding:'2px 6px', background:`${grp.color}22`, color:grp.color, borderRadius:6, fontWeight:600 }}>{grp.label}</span>}</td>
                        <td style={{ padding:'7px 12px' }}>{cat?.icon} {cat?.label||k}</td>
                        <td style={{ padding:'7px 12px', fontFamily:'var(--font-mono)', color:'var(--text3)' }}>{v.cnt}</td>
                        <td style={{ padding:'7px 12px', fontFamily:'var(--font-mono)', color:'var(--blue)', fontWeight:600 }}>{fmtBrl(v.sum)}</td>
                        <td style={{ padding:'7px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1, height:4, background:'var(--bg3)', borderRadius:2, overflow:'hidden' }}><div style={{ width:`${pct}%`, height:'100%', background:grp?.color||'var(--blue)' }} /></div>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, minWidth:28, color:'var(--text3)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding:'7px 12px' }}><span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, fontWeight:600, background:'var(--bg2)', color:'var(--text2)' }}>{cat?.costType||'—'}</span></td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pricing' && (
        <div>
          {!filterAc && <div style={{ padding:'14px 18px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:10, marginBottom:16, fontSize:12, color:'var(--amber)' }}>ℹ Selecione uma aeronave no filtro acima para precificação específica</div>}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Custo total/hora', value:pricing.cph>0?`R$ ${Math.round(pricing.cph).toLocaleString('pt-BR')}`:'—', sub:'histórico real', color:'var(--blue)' },
              { label:'Fixo/hora', value:pricing.cphFixed>0?`R$ ${Math.round(pricing.cphFixed).toLocaleString('pt-BR')}`:'—', sub:'hangar, seguro, licenças', color:'var(--purple)' },
              { label:'Variável/hora', value:pricing.cphVariable>0?`R$ ${Math.round(pricing.cphVariable).toLocaleString('pt-BR')}`:'—', sub:'combustível, taxas, MX', color:'var(--amber)' },
              { label:'Reserva TBO/hora', value:pricing.cphReserve>0?`R$ ${Math.round(pricing.cphReserve).toLocaleString('pt-BR')}`:'—', sub:'capital provisionado', color:'var(--green)' },
            ].map(k=>(
              <div key={k.label} style={{ padding:'14px 16px', background:'var(--bg1)', border:`1px solid var(--border)`, borderRadius:12, borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{k.label}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:22, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="card" style={{ padding:'18px 20px' }}>
              <div className="section-title">Tabela de preços por hora disponível</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginBottom:16 }}>Custo real histórico como base. Para fretamento ou rateio, considere a margem necessária.</div>
              {[
                { label:'Preço mínimo (custo real)',  mult:1.0, desc:'Sem margem — cobre todos os custos' },
                { label:'Operacional (+20%)',         mult:1.2, desc:'Margem para imprevistos' },
                { label:'Comercial (+40%)',           mult:1.4, desc:'Fretamento lucrativo' },
                { label:'Executivo (+60%)',           mult:1.6, desc:'Serviço premium' },
              ].map(p=>(
                <div key={p.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500 }}>{p.label}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{p.desc}</div>
                  </div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:16, color:'var(--blue)', fontWeight:500 }}>
                    {pricing.cph>0?`R$ ${Math.round(pricing.cph*p.mult).toLocaleString('pt-BR')}/h`:'—'}
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding:'18px 20px' }}>
              <div className="section-title">Reserva de Motor / Overhaul</div>
              {(() => {
                const ac = pricing.ac;
                if (!ac?.engineTboHours) return <div style={{ color:'var(--text3)', fontSize:12 }}>Configure o TBO no cadastro da aeronave</div>;
                const tbo=parseFloat(ac.engineTboHours); const used=parseFloat(ac.totalEngineHours||0); const left=Math.max(0,tbo-used); const pct=Math.min(used/tbo,1);
                const estOverhaulBrl = ac.type==='jet'?1500000:ac.type==='multi_engine'?400000:200000;
                const reservePerHour = left>0?(estOverhaulBrl-pricing.engineReserveAcc)/left:0;
                const capitalPct = Math.min(pricing.engineReserveAcc/estOverhaulBrl,1)*100;
                return (
                  <>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}><span style={{ color:'var(--text2)' }}>TBO consumido</span><span style={{ fontFamily:'var(--font-mono)', color:pct>.9?'var(--red)':pct>.75?'var(--amber)':'var(--green)' }}>{used.toFixed(0)}h / {tbo}h</span></div>
                      <div style={{ height:8, background:'var(--bg3)', borderRadius:4, overflow:'hidden' }}><div style={{ width:`${pct*100}%`, height:'100%', background:pct>.9?'var(--red)':pct>.75?'var(--amber)':'var(--green)', borderRadius:4 }} /></div>
                    </div>
                    {[['Horas restantes',`${left.toFixed(0)}h`],['Overhaul estimado',fmtBrl(estOverhaulBrl)],['Capital provisionado',fmtBrl(pricing.engineReserveAcc)],['Reserva recomendada/h',reservePerHour>0?`${fmtBrl(reservePerHour)}/h`:'—']].map(([l,v])=>(
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                        <span style={{ color:'var(--text2)' }}>{l}</span><span style={{ fontFamily:'var(--font-mono)', fontWeight:500 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}><span style={{ color:'var(--text2)' }}>Capital acumulado</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--green)' }}>{Math.round(capitalPct)}%</span></div>
                      <div style={{ height:8, background:'var(--bg3)', borderRadius:4, overflow:'hidden' }}><div style={{ width:`${capitalPct}%`, height:'100%', background:'var(--green)', borderRadius:4 }} /></div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
