// Budgets.js — módulo de Orçamento & Followup
import React, { useState, useEffect, useMemo } from 'react';
import {
  getBudgets, saveBudget, deleteBudget,
  getBudgetLines, saveBudgetLine, deleteBudgetLine,
  regenerateBudgetMonthly, getBudgetFollowup,
} from '../store';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const UNIT_LABELS = {
  annual: 'Anual',
  monthly: 'Mensal',
  per_hour: 'Por hora',
  per_flight: 'Por voo',
  per_overnight: 'Por pernoite',
  per_landing: 'Por pouso',
};

const CATEGORY_LABELS = {
  scheduled_mx: 'Manutenção',
  crew: 'Pessoal & Tripulação',
  insurance: 'Seguros',
  hangar: 'Hangar & Infra',
  fuel: 'Combustível',
  airport_fees: 'Taxas Aeroportuárias',
  nav_fees: 'Taxas ATC/Nav',
  engine_reserve: 'Reserva de Motor',
  other: 'Outros',
};

const fmtBRL = (v) => `R$ ${(parseFloat(v)||0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtBRLShort = (v) => {
  const n = parseFloat(v)||0;
  if (Math.abs(n) >= 1_000_000) return `R$${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$${(n/1_000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
};

function varianceColor(pct) {
  if (pct === null || pct === undefined) return 'var(--text3)';
  if (pct <= 0) return 'var(--green)';        // economia
  if (pct <= 10) return 'var(--text2)';       // neutro
  if (pct <= 25) return 'var(--amber)';       // atenção
  return 'var(--red)';                         // estouro
}

export default function Budgets({ aircraft = [], reload }) {
  const [view, setView] = useState('list');   // 'list' | 'edit' | 'followup'
  const [budgets, setBudgets] = useState([]);
  const [editing, setEditing] = useState(null);
  const [followupId, setFollowupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterAc, setFilterAc] = useState('');

  useEffect(() => { loadList(); }, []);

  async function loadList() {
    setLoading(true);
    try { setBudgets(await getBudgets()); } catch(e) { console.error(e); }
    setLoading(false);
  }

  function startNew() {
    setEditing({
      name: 'Novo orçamento',
      fiscalYear: new Date().getFullYear(),
      aircraftId: aircraft[0]?.id || null,
      status: 'active',
      fxUsdBrl: 5.0,
      fuelUsdGal: 6.0,
      contingencyPct: 0.05,
      hoursYearAssumed: 0,
      flightsYearAssumed: 0,
      overnightsYearAssumed: 0,
      seasonality: { 1:1,2:0.75,3:1,4:1,5:1,6:1,7:1.4,8:1,9:1,10:1,11:1,12:1.1 },
      notes: '',
    });
    setView('edit');
  }

  function startEdit(b) { setEditing({...b}); setView('edit'); }
  function startFollowup(id) { setFollowupId(id); setView('followup'); }
  function back() { setView('list'); setEditing(null); setFollowupId(null); loadList(); }

  if (view === 'edit') return <BudgetEditor budget={editing} aircraft={aircraft} onBack={back} />;
  if (view === 'followup') return <BudgetFollowup budgetId={followupId} onBack={back} />;

  // ── LISTA ────────────────────────────────────────────────────
  const filtered = filterAc ? budgets.filter(b => b.aircraftId === filterAc) : budgets;

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Orçamento & Followup</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{budgets.length} orçamento(s) — planejado vs realizado</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {aircraft.length > 1 && (
            <select value={filterAc} onChange={e => setFilterAc(e.target.value)} style={{ fontSize:12 }}>
              <option value="">Todas aeronaves</option>
              {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration}</option>)}
            </select>
          )}
          <button className="primary" onClick={startNew}>+ Novo orçamento</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
          <div style={{ fontWeight:600 }}>Nenhum orçamento ainda</div>
          <div style={{ fontSize:12, marginTop:8 }}>Crie um plano financeiro anual e acompanhe planejado vs realizado mês a mês</div>
          <button className="primary" style={{ marginTop:16 }} onClick={startNew}>Criar primeiro orçamento</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:14 }}>
          {filtered.map(b => {
            const ac = aircraft.find(a => a.id === b.aircraftId);
            return (
              <div key={b.id} className="card animate-in" style={{ padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', gap:8, marginBottom:10 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                      AF {b.fiscalYear} · {ac ? ac.registration : 'sem aeronave'} · câmbio R$ {b.fxUsdBrl.toFixed(2)}
                    </div>
                  </div>
                  <span className={`tag tag-${b.status==='active'?'ok':b.status==='draft'?'warn':'mono'}`}>{b.status}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12, fontSize:11 }}>
                  <div><div style={{ color:'var(--text3)' }}>Horas/ano</div><div style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{b.hoursYearAssumed}</div></div>
                  <div><div style={{ color:'var(--text3)' }}>Voos/ano</div><div style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{b.flightsYearAssumed}</div></div>
                  <div><div style={{ color:'var(--text3)' }}>Pernoites/ano</div><div style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{b.overnightsYearAssumed}</div></div>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:14, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                  <button onClick={() => startFollowup(b.id)} className="primary" style={{ fontSize:12, padding:'6px 12px', flex:1 }}>📈 Followup</button>
                  <button onClick={() => startEdit(b)} style={{ fontSize:12, padding:'6px 12px' }}>Editar</button>
                  <button className="danger" style={{ fontSize:12, padding:'6px 10px' }}
                    onClick={async () => { if(window.confirm('Remover este orçamento?')){ await deleteBudget(b.id); loadList(); } }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function BudgetEditor({ budget, aircraft, onBack }) {
  const [form, setForm] = useState(budget);
  const [lines, setLines] = useState([]);
  const [tab, setTab] = useState('premissas');
  const [savedId, setSavedId] = useState(budget.id || null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (savedId) loadLines(savedId);
  }, [savedId]);

  async function loadLines(id) {
    try { setLines(await getBudgetLines(id)); } catch(e) { console.error(e); }
  }

  async function savePremissas() {
    setBusy(true);
    try {
      const saved = await saveBudget(form);
      setForm(saved);
      setSavedId(saved.id);
    } catch(e) { alert('Erro: '+e.message); }
    setBusy(false);
  }

  async function addLine(costType) {
    if (!savedId) { alert('Salve as premissas primeiro.'); return; }
    const newLine = await saveBudgetLine({
      budgetId: savedId, category: 'other', description: 'Novo item',
      costType, unit: costType==='fixed'?'annual':'per_flight',
      unitAmountBrl: 0, annualQtyAssumed: costType==='variable'?form.flightsYearAssumed:1,
      recurrence: costType==='fixed'?'annual':null,
    });
    setLines(ls => [...ls, newLine]);
  }

  async function updateLine(id, patch) {
    const updated = await saveBudgetLine({ ...lines.find(l=>l.id===id), ...patch });
    setLines(ls => ls.map(l => l.id===id ? updated : l));
  }

  async function removeLine(id) {
    if (!window.confirm('Remover esta linha?')) return;
    await deleteBudgetLine(id);
    setLines(ls => ls.filter(l => l.id !== id));
  }

  async function regenerate() {
    setBusy(true);
    try {
      const n = await regenerateBudgetMonthly(savedId);
      alert(`Distribuição mensal regenerada: ${n} células.`);
    } catch(e) { alert('Erro: '+e.message); }
    setBusy(false);
  }

  function setF(k, v) { setForm(f => ({...f, [k]: v})); }

  const totalAnual = useMemo(() => {
    return lines.reduce((s, l) => {
      if (!l.isActive) return s;
      if (l.unit === 'annual') return s + l.unitAmountBrl;
      if (l.unit === 'monthly') return s + l.unitAmountBrl * 12;
      return s + l.unitAmountBrl * (l.annualQtyAssumed||0);
    }, 0);
  }, [lines]);

  return (
    <div style={{ padding:24, maxWidth:980 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={onBack}>← Voltar</button>
        <div style={{ fontSize:16, fontWeight:700 }}>{savedId?'Editar':'Novo'} orçamento</div>
        <div style={{ marginLeft:'auto', fontSize:13, color:'var(--text3)' }}>
          Total/ano: <span style={{ color:'var(--blue)', fontFamily:'var(--font-mono)', fontWeight:600 }}>{fmtBRL(totalAnual)}</span>
        </div>
      </div>

      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid var(--bg2)' }}>
        {[
          {id:'premissas', label:'Premissas'},
          {id:'fixed', label:'Custos fixos'},
          {id:'variable', label:'Custos variáveis'},
          {id:'monthly', label:'Distribuição mensal'},
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'8px 16px', border:'none', background:'transparent',
            color:tab===t.id?'var(--blue)':'var(--text3)', fontWeight:tab===t.id?600:400, fontSize:12,
            cursor:'pointer', borderBottom:tab===t.id?'2px solid var(--blue)':'2px solid transparent',
            borderRadius:0
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'premissas' && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Identificação</div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Nome do orçamento *</label><input required value={form.name||''} onChange={e=>setF('name',e.target.value)} /></div>
            <div><label>Ano fiscal *</label><input type="number" required value={form.fiscalYear||''} onChange={e=>setF('fiscalYear',parseInt(e.target.value)||0)} /></div>
          </div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Aeronave</label>
              <select value={form.aircraftId||''} onChange={e=>setF('aircraftId',e.target.value||null)}>
                <option value="">— Geral —</option>
                {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} {a.model}</option>)}
              </select>
            </div>
            <div><label>Status</label>
              <select value={form.status||'active'} onChange={e=>setF('status',e.target.value)}>
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          <div className="section-title" style={{ marginTop:18 }}>Premissas financeiras</div>
          <div className="g3">
            <div><label>Câmbio USD/BRL</label><input type="number" step="0.01" value={form.fxUsdBrl||''} onChange={e=>setF('fxUsdBrl',parseFloat(e.target.value)||0)} /></div>
            <div><label>Jet-A1 (USD/gal)</label><input type="number" step="0.01" value={form.fuelUsdGal||''} onChange={e=>setF('fuelUsdGal',parseFloat(e.target.value)||0)} /></div>
            <div><label>Contingência (%)</label><input type="number" step="0.01" value={(form.contingencyPct*100)||''} onChange={e=>setF('contingencyPct',(parseFloat(e.target.value)||0)/100)} /></div>
          </div>

          <div className="section-title" style={{ marginTop:18 }}>Premissas operacionais (anuais)</div>
          <div className="g3">
            <div><label>Horas de voo</label><input type="number" value={form.hoursYearAssumed||''} onChange={e=>setF('hoursYearAssumed',parseFloat(e.target.value)||0)} placeholder="253" /></div>
            <div><label>Voos</label><input type="number" value={form.flightsYearAssumed||''} onChange={e=>setF('flightsYearAssumed',parseInt(e.target.value)||0)} placeholder="22" /></div>
            <div><label>Pernoites</label><input type="number" value={form.overnightsYearAssumed||''} onChange={e=>setF('overnightsYearAssumed',parseInt(e.target.value)||0)} placeholder="63" /></div>
          </div>

          <div className="section-title" style={{ marginTop:18 }}>Sazonalidade mensal</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>Peso relativo do mês (1.0 = médio). Afeta apenas linhas variáveis.</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:4 }}>
            {MONTH_NAMES.map((mn, idx) => (
              <div key={mn}>
                <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center' }}>{mn}</div>
                <input type="number" step="0.05" style={{ width:'100%', padding:'4px 6px', fontSize:11, textAlign:'center' }}
                  value={(form.seasonality?.[idx+1])||1}
                  onChange={e=>setF('seasonality',{...form.seasonality, [idx+1]: parseFloat(e.target.value)||1 })}/>
              </div>
            ))}
          </div>

          <div style={{ marginTop:18 }}><label>Notas</label><textarea value={form.notes||''} onChange={e=>setF('notes',e.target.value)} placeholder="Premissas, fontes, referências…" /></div>

          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="primary" onClick={savePremissas} disabled={busy}>{savedId?'Atualizar premissas':'Salvar e adicionar linhas'}</button>
            {savedId && <button onClick={regenerate} disabled={busy} style={{ fontSize:12 }}>🔄 Regenerar distribuição mensal</button>}
          </div>
        </div>
      )}

      {(tab === 'fixed' || tab === 'variable') && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          {!savedId ? (
            <div style={{ color:'var(--text3)', fontSize:13 }}>Salve as premissas primeiro para adicionar linhas.</div>
          ) : (
            <LinesTable
              lines={lines.filter(l => l.costType === (tab==='fixed'?'fixed':'variable'))}
              costType={tab==='fixed'?'fixed':'variable'}
              onAdd={() => addLine(tab==='fixed'?'fixed':'variable')}
              onChange={updateLine}
              onRemove={removeLine}
            />
          )}
        </div>
      )}

      {tab === 'monthly' && savedId && (
        <BudgetMonthlyView budgetId={savedId} onRegenerate={regenerate} />
      )}

      <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, borderTop:'1px solid var(--bg2)', display:'flex', gap:10 }}>
        <button onClick={onBack}>Voltar</button>
        {savedId && <button className="primary" onClick={() => alert('Orçamento salvo.')}>Concluir</button>}
      </div>
    </div>
  );
}

function LinesTable({ lines, costType, onAdd, onChange, onRemove }) {
  const fixedUnits = ['annual','monthly'];
  const varUnits = ['per_hour','per_flight','per_overnight','per_landing'];
  const units = costType === 'fixed' ? fixedUnits : varUnits;

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div className="section-title" style={{ margin:0 }}>
          {costType === 'fixed' ? 'Custos fixos' : 'Custos variáveis (por unidade)'}
        </div>
        <button onClick={onAdd} className="secondary" style={{ fontSize:12 }}>+ Adicionar linha</button>
      </div>
      {lines.length === 0 ? (
        <div style={{ color:'var(--text3)', fontSize:12, padding:'10px 0' }}>Nenhuma linha. Clique em "Adicionar linha" para começar.</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Categoria','Descrição','Fornecedor','Unidade','Valor/unidade','Qty anual','Total/ano',''].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const totalAno = l.unit==='annual' ? l.unitAmountBrl
                  : l.unit==='monthly' ? l.unitAmountBrl*12
                  : l.unitAmountBrl * (l.annualQtyAssumed||0);
                return (
                  <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'4px 6px', width:140 }}>
                      <select value={l.category} onChange={e=>onChange(l.id, {category: e.target.value})} style={{ fontSize:11, padding:'4px 6px', width:'100%' }}>
                        {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'4px 6px' }}><input value={l.description||''} onChange={e=>onChange(l.id, {description: e.target.value})} style={{ fontSize:11, padding:'4px 6px', width:'100%' }} /></td>
                    <td style={{ padding:'4px 6px', width:120 }}><input value={l.vendor||''} onChange={e=>onChange(l.id, {vendor: e.target.value})} style={{ fontSize:11, padding:'4px 6px', width:'100%' }} /></td>
                    <td style={{ padding:'4px 6px', width:120 }}>
                      <select value={l.unit} onChange={e=>onChange(l.id, {unit: e.target.value})} style={{ fontSize:11, padding:'4px 6px', width:'100%' }}>
                        {units.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'4px 6px', width:110 }}>
                      <input type="number" step="0.01" value={l.unitAmountBrl||''} onChange={e=>onChange(l.id, {unitAmountBrl: parseFloat(e.target.value)||0})}
                        style={{ fontSize:11, padding:'4px 6px', width:'100%', fontFamily:'var(--font-mono)', textAlign:'right' }} />
                    </td>
                    <td style={{ padding:'4px 6px', width:80 }}>
                      {costType === 'variable' && (
                        <input type="number" step="1" value={l.annualQtyAssumed||''} onChange={e=>onChange(l.id, {annualQtyAssumed: parseFloat(e.target.value)||0})}
                          style={{ fontSize:11, padding:'4px 6px', width:'100%', fontFamily:'var(--font-mono)', textAlign:'right' }} />
                      )}
                    </td>
                    <td style={{ padding:'4px 6px', fontFamily:'var(--font-mono)', textAlign:'right', color:'var(--blue)', fontWeight:500, width:120 }}>
                      {fmtBRL(totalAno)}
                    </td>
                    <td style={{ padding:'4px 6px', width:30 }}>
                      <button className="danger" onClick={()=>onRemove(l.id)} style={{ fontSize:10, padding:'3px 6px' }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function BudgetMonthlyView({ budgetId, onRegenerate }) {
  const [followup, setFollowup] = useState(null);
  useEffect(() => { getBudgetFollowup(budgetId).then(setFollowup); }, [budgetId]);
  if (!followup) return <div style={{ color:'var(--text3)' }}>Carregando…</div>;
  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div className="section-title" style={{ margin:0 }}>Distribuição mensal (planejado)</div>
        <button onClick={onRegenerate} style={{ fontSize:12 }}>🔄 Recalcular</button>
      </div>
      <MonthlyTable table={followup.table} showActual={false} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWUP — planejado vs realizado
// ─────────────────────────────────────────────────────────────────────────────
function BudgetFollowup({ budgetId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getBudgetFollowup(budgetId).then(d => { setData(d); setLoading(false); }); }, [budgetId]);

  if (loading || !data) return (
    <div style={{ padding:24 }}>
      <button className="ghost" onClick={onBack}>← Voltar</button>
      <div style={{ marginTop:20, color:'var(--text3)' }}>Carregando followup…</div>
    </div>
  );

  const { budget, table } = data;
  const totals = table.reduce((acc, r) => ({
    planned: acc.planned + r.plannedTotal,
    actual: acc.actual + r.actualTotal,
  }), { planned:0, actual:0 });
  const totalVariance = totals.actual - totals.planned;
  const totalPct = totals.planned > 0 ? ((totals.actual/totals.planned - 1)*100) : null;

  // Cumulative monthly view
  const today = new Date();
  const currentMonth = today.getFullYear() === budget.fiscalYear ? today.getMonth()+1 : 12;
  const monthSums = Array.from({length:12}, (_, m) => {
    const planned = table.reduce((s, r) => s + r.months[m].planned, 0);
    const actual = table.reduce((s, r) => s + r.months[m].actual, 0);
    return { month: m+1, planned, actual };
  });

  // YTD projection (linear)
  const ytdActual = monthSums.slice(0, currentMonth).reduce((s, m) => s + m.actual, 0);
  const ytdPlanned = monthSums.slice(0, currentMonth).reduce((s, m) => s + m.planned, 0);
  const yeProjection = currentMonth > 0 ? (ytdActual / currentMonth) * 12 : 0;
  const yePlanned = totals.planned;
  const yeVarianceProj = yeProjection - yePlanned;

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={onBack}>← Voltar</button>
        <div>
          <div style={{ fontSize:16, fontWeight:700 }}>{budget.name}</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Followup planejado × realizado · AF {budget.fiscalYear}</div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:12, marginBottom:18 }}>
        <KpiCard label="Orçado/ano" value={fmtBRL(totals.planned)} sub="Premissa anual" />
        <KpiCard label={`Realizado YTD (até ${MONTH_NAMES[currentMonth-1]})`} value={fmtBRL(ytdActual)} sub={`vs ${fmtBRL(ytdPlanned)} orçado`} />
        <KpiCard label="Projeção YE" value={fmtBRL(yeProjection)} sub={`${yeVarianceProj>=0?'+':''}${fmtBRL(yeVarianceProj)} vs orçado`}
          color={yeVarianceProj > totals.planned*0.05 ? 'var(--red)' : (yeVarianceProj < -totals.planned*0.05 ? 'var(--green)' : 'var(--text1)')} />
        <KpiCard label="Variação YTD" value={totalPct!==null?`${totalPct>=0?'+':''}${totalPct.toFixed(1)}%`:'—'}
          sub={`${totalVariance>=0?'+':''}${fmtBRL(totalVariance)}`}
          color={varianceColor(totalPct)} />
      </div>

      {/* Cumulative monthly bar */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div className="section-title">Curva mensal acumulada</div>
        <MonthlyBarChart months={monthSums} currentMonth={currentMonth} />
      </div>

      {/* Detalhado por categoria */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div className="section-title">Planejado × Realizado por categoria</div>
        <MonthlyTable table={table} showActual currentMonth={currentMonth} />
      </div>

      {/* Top desvios */}
      <div className="card" style={{ padding:'16px 20px' }}>
        <div className="section-title">Top desvios YTD</div>
        <TopDeviations table={table} currentMonth={currentMonth} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontFamily:'var(--font-mono)', fontWeight:600, color: color || 'var(--text1)' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function MonthlyTable({ table, showActual, currentMonth }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
        <thead>
          <tr style={{ background:'var(--bg2)' }}>
            <th style={{ padding:'8px 10px', textAlign:'left', position:'sticky', left:0, background:'var(--bg2)', minWidth:160 }}>Categoria</th>
            {MONTH_NAMES.map((m, idx) => (
              <th key={m} style={{ padding:'8px 6px', textAlign:'right', minWidth:90, borderLeft: idx+1===currentMonth ? '2px solid var(--blue)' : 'none' }}>{m}</th>
            ))}
            <th style={{ padding:'8px 10px', textAlign:'right', borderLeft:'1px solid var(--border2)', minWidth:110 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {table.map(row => (
            <tr key={row.category} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'8px 10px', fontWeight:500, position:'sticky', left:0, background:'var(--bg0)' }}>
                {CATEGORY_LABELS[row.category] || row.category}
              </td>
              {row.months.map((cell, idx) => (
                <td key={idx} style={{ padding:'4px 6px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:10, borderLeft: idx+1===currentMonth ? '2px solid var(--blue)' : 'none' }}>
                  <div style={{ color:'var(--text3)' }}>{cell.planned > 0 ? fmtBRLShort(cell.planned) : '—'}</div>
                  {showActual && (
                    <div style={{ color: cell.pct !== null ? varianceColor(cell.pct) : 'var(--text2)', fontWeight:600 }}>
                      {cell.actual > 0 ? fmtBRLShort(cell.actual) : '·'}
                    </div>
                  )}
                </td>
              ))}
              <td style={{ padding:'4px 10px', textAlign:'right', fontFamily:'var(--font-mono)', borderLeft:'1px solid var(--border2)' }}>
                <div style={{ color:'var(--text3)' }}>{fmtBRLShort(row.plannedTotal)}</div>
                {showActual && (
                  <div style={{ color: varianceColor(row.pctTotal), fontWeight:600 }}>
                    {fmtBRLShort(row.actualTotal)}
                    {row.pctTotal !== null && <span style={{ fontSize:9, marginLeft:4 }}>({row.pctTotal>=0?'+':''}{row.pctTotal.toFixed(0)}%)</span>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize:10, color:'var(--text3)', marginTop:8, display:'flex', gap:14 }}>
        <span><span style={{ color:'var(--text3)' }}>━</span> planejado</span>
        {showActual && <span><span style={{ color:'var(--blue)', fontWeight:600 }}>━</span> realizado</span>}
        {showActual && <span>cor da variação: <span style={{color:'var(--green)'}}>economia</span> · <span style={{color:'var(--amber)'}}>até +25%</span> · <span style={{color:'var(--red)'}}>{'>+25%'}</span></span>}
      </div>
    </div>
  );
}

function MonthlyBarChart({ months, currentMonth }) {
  const max = Math.max(...months.map(m => Math.max(m.planned, m.actual)), 1);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:6, alignItems:'end', height:160, marginTop:8 }}>
      {months.map((m, idx) => {
        const planH = (m.planned / max) * 130;
        const actH = (m.actual / max) * 130;
        const isCurrent = idx+1 === currentMonth;
        const isFuture = idx+1 > currentMonth;
        return (
          <div key={idx} style={{ display:'flex', flexDirection:'column', alignItems:'center', height:160 }}>
            <div style={{ flex:1, display:'flex', alignItems:'end', gap:2 }}>
              <div style={{ width:14, height:planH, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'2px 2px 0 0' }} title={`Planejado: ${fmtBRL(m.planned)}`} />
              {!isFuture && <div style={{ width:14, height:actH, background:'var(--blue)', borderRadius:'2px 2px 0 0' }} title={`Realizado: ${fmtBRL(m.actual)}`} />}
            </div>
            <div style={{ fontSize:10, color: isCurrent ? 'var(--blue)' : 'var(--text3)', fontWeight: isCurrent?600:400, marginTop:4 }}>{MONTH_NAMES[idx]}</div>
          </div>
        );
      })}
    </div>
  );
}

function TopDeviations({ table, currentMonth }) {
  // Calcula apenas até o mês corrente
  const items = table.map(row => {
    const plannedYtd = row.months.slice(0, currentMonth).reduce((s,c)=>s+c.planned,0);
    const actualYtd = row.months.slice(0, currentMonth).reduce((s,c)=>s+c.actual,0);
    const variance = actualYtd - plannedYtd;
    const pct = plannedYtd > 0 ? ((actualYtd/plannedYtd - 1)*100) : null;
    return { category: row.category, plannedYtd, actualYtd, variance, pct };
  }).filter(i => i.plannedYtd > 0 || i.actualYtd > 0)
    .sort((a,b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 5);

  if (items.length === 0) return <div style={{ color:'var(--text3)', fontSize:12 }}>Sem variações registradas ainda — nenhum custo real foi lançado.</div>;

  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
      <thead>
        <tr style={{ background:'var(--bg2)' }}>
          {['Categoria','Planejado YTD','Realizado YTD','Δ','Δ%'].map(h =>
            <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {items.map(i => (
          <tr key={i.category} style={{ borderBottom:'1px solid var(--border)' }}>
            <td style={{ padding:'8px 10px', fontWeight:500 }}>{CATEGORY_LABELS[i.category] || i.category}</td>
            <td style={{ padding:'8px 10px', fontFamily:'var(--font-mono)' }}>{fmtBRL(i.plannedYtd)}</td>
            <td style={{ padding:'8px 10px', fontFamily:'var(--font-mono)' }}>{fmtBRL(i.actualYtd)}</td>
            <td style={{ padding:'8px 10px', fontFamily:'var(--font-mono)', color: varianceColor(i.pct) }}>{i.variance>=0?'+':''}{fmtBRL(i.variance)}</td>
            <td style={{ padding:'8px 10px', fontFamily:'var(--font-mono)', color: varianceColor(i.pct), fontWeight:600 }}>{i.pct!==null?`${i.pct>=0?'+':''}${i.pct.toFixed(1)}%`:'—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
