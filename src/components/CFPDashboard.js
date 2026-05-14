// CFPDashboard.js — Computerized Flight Plan integrado na plataforma.
// Substitui o Excel CFP de Victor: dashboard com detecções automáticas,
// matriz de checklist por leg, planejamento de fuel multi-fornecedor e
// snapshot de validades crew/MX no momento da missão.

import React, { useState, useEffect, useCallback } from 'react';
import {
  detectMissionFlags, saveMissionDetections,
  getMissionChecklist, saveMissionChecklistItem, deleteMissionChecklistItem,
  CHECKLIST_TYPE_LABELS,
  getMissionFuelQuotes, saveMissionFuelQuote, chooseFuelQuote, deleteMissionFuelQuote,
  getMissionDocSnapshots, snapshotMissionDocs,
  getMissionCosts, quickAddCostToMission,
} from '../store';
import { supabase } from '../supabase';
import CategoryInput from './CategoryInput';

const OPERATION_TYPES = [
  { v: 'private_part91',     l: 'Privado (Part 91)' },
  { v: 'commercial_part135', l: 'Comercial (Part 135 / Táxi Aéreo)' },
  { v: 'cargo',              l: 'Cargo' },
  { v: 'medical',            l: 'Médico / UTI Aérea' },
  { v: 'training',           l: 'Instrução' },
  { v: 'other',              l: 'Outro' },
];

const FLAG_META = {
  international:   { label: 'Internacional',      icon: '🌍' },
  operates_us:     { label: 'Opera nos EUA',      icon: '🇺🇸' },
  operates_br:     { label: 'Opera no Brasil',    icon: '🇧🇷' },
  exits_br:        { label: 'Sai do Brasil',      icon: '📤' },
  enters_br:       { label: 'Entra no Brasil',    icon: '📥' },
  has_passengers:  { label: 'Tem PAX',            icon: '👥' },
  has_overnights:  { label: 'Tem pernoite',       icon: '🌙' },
  uses_handler:    { label: 'Usa handler',        icon: '🛬' },
};

const CHECKLIST_DEFAULTS_INTL = ['briefing','HR','GD','PM','CR','insurance','fuel','eAPIS','preflight','postflight'];
const CHECKLIST_DEFAULTS_DOM  = ['briefing','fuel','preflight','postflight'];

const STATUS_META = {
  pending:  { label: 'Pendente',   color: '#888',     icon: '○' },
  required: { label: 'Obrigatório',color: '#e8a84a',  icon: '!' },
  done:     { label: 'Feito',      color: '#3dbf8a',  icon: '✓' },
  na:       { label: 'N/A',        color: '#666',     icon: '—' },
  blocked:  { label: 'Bloqueado',  color: '#ef4444',  icon: '✕' },
};

const DOC_STATUS_META = {
  ok:       { label: 'OK',       color: '#3dbf8a' },
  warning:  { label: 'Atenção',  color: '#e8a84a' },
  expired:  { label: 'Vencido',  color: '#ef4444' },
  blocking: { label: 'Bloqueia', color: '#ef4444' },
};

export default function CFPDashboard({ missionId, onClose }) {
  const [mission, setMission]       = useState(null);
  const [tab, setTab]               = useState('summary'); // summary | checklist | fuel | validity
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [busy, setBusy]             = useState(false);

  const loadMission = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from('missions').select('*').eq('id', missionId).single();
      if (err) throw err;
      setMission(data);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [missionId]);

  useEffect(() => { loadMission(); }, [loadMission]);

  async function recomputeDetections() {
    if (!mission) return;
    setBusy(true);
    try {
      await saveMissionDetections(mission.id);
      await loadMission();
    } catch(e) { setError(e.message); }
    setBusy(false);
  }

  async function saveMeta(patch) {
    setBusy(true);
    try {
      await supabase.from('missions').update(patch).eq('id', mission.id);
      await loadMission();
      setEditingMeta(false);
    } catch(e) { setError(e.message); }
    setBusy(false);
  }

  if (loading) return <div style={{ padding:40, color:'var(--text3)' }}>Carregando CFP…</div>;
  if (error) return (
    <div style={{ padding:40 }}>
      <button onClick={onClose}>← Voltar</button>
      <div style={{ padding:14, background:'rgba(239,68,68,.1)', color:'var(--red)', borderRadius:6, marginTop:14 }}>Erro: {error}</div>
    </div>
  );
  if (!mission) return null;

  const fromDB = (r) => ({
    id: r.id, name: r.name, type: r.type, status: r.status, purpose: r.purpose,
    dateStart: r.date_start, dateEnd: r.date_end,
    legs: r.legs || [], passengers: r.passengers || [],
    missionCode: r.mission_code, operationType: r.operation_type,
    operatorName: r.operator_name, operatorCnpj: r.operator_cnpj,
    operatorEmail: r.operator_email, operatorPhone: r.operator_phone,
    briefingNotes: r.briefing_notes, detections: r.detections || {},
  });
  const m = fromDB(mission);
  // detecções podem estar vazias (criação antiga) — calculamos on-the-fly se vazio
  const detections = Object.keys(m.detections).length ? m.detections : detectMissionFlags(m);

  return (
    <div style={{ padding:24, maxWidth:1100 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <button onClick={onClose}>← Voltar</button>
        <div>
          <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em' }}>
            CFP — Computerized Flight Plan
          </div>
          <div style={{ fontSize:18, fontWeight:700 }}>{m.name}</div>
          {m.missionCode && (
            <div style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--font-mono)', marginTop:2 }}>{m.missionCode}</div>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={recomputeDetections} disabled={busy} style={{ fontSize:12 }}>🔄 Recalcular detecções</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid var(--bg2)', overflowX:'auto' }}>
        {[
          { id:'summary',   label:'📋 Resumo' },
          { id:'checklist', label:'✓ Checklist' },
          { id:'fuel',      label:'⛽ Fuel' },
          { id:'validity',  label:'📅 Validades' },
          { id:'costs',     label:'💰 Custos' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'8px 16px', border:'none', background:'transparent',
            color: tab===t.id?'var(--blue)':'var(--text3)', fontWeight: tab===t.id?600:400, fontSize:12,
            cursor:'pointer', borderBottom: tab===t.id?'2px solid var(--blue)':'2px solid transparent', borderRadius:0
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'summary' && (
        <SummaryTab
          mission={m}
          detections={detections}
          editingMeta={editingMeta}
          setEditingMeta={setEditingMeta}
          onSave={saveMeta}
          busy={busy}
        />
      )}

      {tab === 'checklist' && <ChecklistTab mission={m} detections={detections} />}

      {tab === 'fuel' && <FuelTab mission={m} />}

      {tab === 'validity' && <ValidityTab mission={m} />}

      {tab === 'costs' && <CustosTab mission={m} />}
    </div>
  );
}

// ── Custos Tab — Planejado × Realizado ────────────────────────────────────
const QUICK_COST_CATS = ['Combustível Jet-A1','Hotel Tripulação','Per Diem Tripulação','Catering','Handling Fee','Taxa Aeroportuária','Suprimentos de Bordo','Gorjetas / Tips','De-icing'];

function CustosTab({ mission }) {
  const [costs, setCosts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fx, setFx] = useState(5.2); // câmbio USD/BRL default
  const [form, setForm] = useState({
    category: '',
    amount_brl: '',
    amount_usd: '',
    currency: 'BRL',
    vendor: '',
    description: '',
    referenceDate: new Date().toISOString().slice(0,10),
  });

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, q] = await Promise.all([
        getMissionCosts(mission.id, mission.aircraftId),
        getMissionFuelQuotes(mission.id),
      ]);
      setCosts(c);
      setQuotes(q);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [mission.id, mission.aircraftId]);
  useEffect(() => { load(); }, [load]);

  // Cálculo do planejado: soma das cotações de fuel escolhidas (USD → BRL)
  const chosenFuelUsd = quotes.filter(q => q.is_chosen).reduce((s,q) => s + (parseFloat(q.total_usd) || 0), 0);
  const plannedFuelBrl = chosenFuelUsd * fx;

  // Realizado: soma de costs
  const actualTotalBrl = costs.reduce((s,c) => s + (c.amountBrl || 0), 0);

  // Por categoria
  const byCategory = {};
  for (const c of costs) {
    const k = c.category || 'sem categoria';
    if (!byCategory[k]) byCategory[k] = { actual: 0, count: 0 };
    byCategory[k].actual += c.amountBrl;
    byCategory[k].count += 1;
  }
  // Adiciona fuel planejado (mesmo sem realizado)
  const fuelKey = Object.keys(byCategory).find(k => k.toLowerCase().includes('combust')) || 'Combustível Jet-A1';
  if (plannedFuelBrl > 0 && !byCategory[fuelKey]) byCategory[fuelKey] = { actual: 0, count: 0 };

  const totalPlannedBrl = plannedFuelBrl; // outras categorias planejadas ainda manuais
  const variance = actualTotalBrl - totalPlannedBrl;
  const variancePct = totalPlannedBrl > 0 ? ((actualTotalBrl / totalPlannedBrl - 1) * 100) : null;

  async function handleAdd() {
    setBusy(true);
    try {
      let amountBrl = parseFloat(form.amount_brl) || 0;
      let amountUsd = parseFloat(form.amount_usd) || null;
      if (form.currency === 'USD' && amountUsd && !amountBrl) {
        amountBrl = +(amountUsd * fx).toFixed(2);
      }
      await quickAddCostToMission({
        missionId: mission.id,
        aircraftId: mission.aircraftId,
        category: form.category || 'other',
        amountBrl,
        amountUsd,
        currency: form.currency,
        vendor: form.vendor,
        description: form.description,
        referenceDate: form.referenceDate,
      });
      setShowAdd(false);
      setForm({ category:'', amount_brl:'', amount_usd:'', currency:'BRL', vendor:'', description:'', referenceDate:new Date().toISOString().slice(0,10) });
      await load();
    } catch(e) { setError(e.message); }
    setBusy(false);
  }

  const fmtBRL = (v) => `R$ ${(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtUSD = (v) => `$ ${(v||0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) return <div style={{ color:'var(--text3)' }}>Carregando…</div>;

  return (
    <>
      {error && <div style={{ padding:10, background:'rgba(239,68,68,.1)', color:'var(--red)', borderRadius:6, marginBottom:10 }}>{error}</div>}

      {/* KPIs */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div className="section-title" style={{ margin:0 }}>Planejado × Realizado</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:11 }}>
            <span style={{ color:'var(--text3)' }}>Câmbio USD→BRL:</span>
            <input type="number" step="0.01" value={fx} onChange={e=>setFx(parseFloat(e.target.value)||5.2)} style={{ width:60, padding:'3px 6px', fontSize:11, fontFamily:'var(--font-mono)' }} />
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
          <KpiBox label="Estimado total" value={fmtBRL(totalPlannedBrl)} sub={chosenFuelUsd>0 ? `fuel: ${fmtUSD(chosenFuelUsd)}` : 'só fuel cotado'} color="var(--text2)" />
          <KpiBox label="Realizado total" value={fmtBRL(actualTotalBrl)} sub={`${costs.length} lançamento(s)`} color="var(--blue)" />
          <KpiBox label="Variance" value={variance>=0 ? `+${fmtBRL(variance)}` : fmtBRL(variance)} sub={variancePct!==null ? `${variancePct>=0?'+':''}${variancePct.toFixed(0)}%` : ''} color={variance>=0 ? 'var(--amber)' : 'var(--green)'} />
        </div>
      </div>

      {/* Por categoria */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div className="section-title" style={{ margin:0 }}>Por categoria</div>
          <button className="primary" onClick={() => setShowAdd(true)} style={{ fontSize:12 }}>+ Lançar custo</button>
        </div>
        {Object.keys(byCategory).length === 0 ? (
          <div style={{ padding:30, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
            <div style={{ fontSize:28, marginBottom:6 }}>💸</div>
            Nenhum custo lançado nesta missão. Clique "+ Lançar custo" pra começar.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Categoria','Planejado','Realizado','Variance','Lanç.'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign: h==='Categoria'?'left':'right', fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byCategory).map(([cat, d]) => {
                const planned = cat.toLowerCase().includes('combust') ? plannedFuelBrl : 0;
                const v = d.actual - planned;
                const pct = planned > 0 ? ((d.actual / planned - 1) * 100) : null;
                const color = v > 0 ? 'var(--amber)' : v < 0 ? 'var(--green)' : 'var(--text2)';
                return (
                  <tr key={cat} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 10px', fontWeight:500 }}>{cat}</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--text3)' }}>
                      {planned > 0 ? fmtBRL(planned) : '—'}
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:600 }}>
                      {fmtBRL(d.actual)}
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'var(--font-mono)', color }}>
                      {planned > 0 ? (
                        <>
                          {v >= 0 ? '+' : ''}{fmtBRL(v)}
                          {pct !== null && <div style={{ fontSize:10 }}>({pct>=0?'+':''}{pct.toFixed(0)}%)</div>}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', color:'var(--text3)', fontSize:11 }}>
                      {d.count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Lista detalhada */}
      {costs.length > 0 && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title" style={{ marginBottom:8 }}>Lançamentos ({costs.length})</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Data','Categoria','Descrição','Fornecedor','Valor','Recibo'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text3)' }}>{c.referenceDate}</td>
                  <td style={{ padding:'7px 10px' }}>{c.category}</td>
                  <td style={{ padding:'7px 10px' }}>{c.description || '—'}</td>
                  <td style={{ padding:'7px 10px', color:'var(--text2)' }}>{c.vendor || '—'}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:600 }}>
                    {fmtBRL(c.amountBrl)}
                    {c.currency === 'USD' && c.amountUsd && (
                      <div style={{ fontSize:10, color:'var(--text3)' }}>${c.amountUsd.toFixed(2)}</div>
                    )}
                  </td>
                  <td style={{ padding:'7px 10px' }}>
                    {c.receiptUrl ? <a href={c.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize:11 }}>📎 ver</a> : <span style={{ color:'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Lançar */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(560px, 90vw)', background:'var(--bg1)', borderRadius:12, padding:20, border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700 }}>+ Lançar custo da missão</div>
              <button onClick={() => setShowAdd(false)} style={{ fontSize:14, padding:'4px 10px' }}>✕</button>
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>
              Missão: <strong>{mission.name}</strong> · Aeronave linkada automaticamente
            </div>

            <div className="g2" style={{ marginBottom:10 }}>
              <div><label>Data *</label><input type="date" value={form.referenceDate} onChange={e=>setForm(f=>({...f, referenceDate:e.target.value}))} /></div>
              <div><label>Categoria *</label>
                <CategoryInput value={form.category} onChange={(name) => setForm(f => ({...f, category: name}))} groupType="operational" />
              </div>
            </div>

            <div style={{ marginBottom:10, display:'flex', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:10, color:'var(--text3)', alignSelf:'center' }}>Atalho:</span>
              {QUICK_COST_CATS.map(qc => (
                <button key={qc} type="button" onClick={() => setForm(f => ({...f, category: qc}))}
                  style={{ fontSize:10, padding:'3px 8px', background: form.category===qc ? 'var(--blue-dim)' : 'var(--bg2)', color: form.category===qc ? 'var(--blue)' : 'var(--text3)', border:`1px solid ${form.category===qc ? 'var(--blue)' : 'var(--border)'}`, borderRadius:10 }}>
                  {qc}
                </button>
              ))}
            </div>

            <div className="g3" style={{ marginBottom:10 }}>
              <div><label>Moeda</label>
                <select value={form.currency} onChange={e=>setForm(f=>({...f, currency:e.target.value}))}>
                  <option value="BRL">BRL</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div><label>Valor BRL{form.currency==='BRL'?' *':''}</label>
                <input type="number" step="0.01" value={form.amount_brl} onChange={e=>setForm(f=>({...f, amount_brl:e.target.value}))} placeholder="0,00" />
              </div>
              <div><label>Valor USD</label>
                <input type="number" step="0.01" value={form.amount_usd} onChange={e=>setForm(f=>({...f, amount_usd:e.target.value, amount_brl: e.target.value && f.currency==='USD' ? (parseFloat(e.target.value)*fx).toFixed(2) : f.amount_brl}))} placeholder="0.00" />
              </div>
            </div>

            <div className="g2" style={{ marginBottom:10 }}>
              <div><label>Fornecedor</label><input value={form.vendor} onChange={e=>setForm(f=>({...f, vendor:e.target.value}))} placeholder="Fornecedor / FBO / hotel" /></div>
              <div><label>Descrição</label><input value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} placeholder="ex.: Fuel uplift KOPF" /></div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="primary" disabled={busy || !form.category || (!form.amount_brl && !form.amount_usd)} onClick={handleAdd}>{busy?'Salvando…':'Salvar custo'}</button>
              <button onClick={() => setShowAdd(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KpiBox({ label, value, sub, color }) {
  return (
    <div style={{ background:'var(--bg2)', padding:'12px 14px', borderRadius:8, borderLeft:`3px solid ${color}` }}>
      <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:18, fontWeight:700, color, marginTop:3 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ── Summary ─────────────────────────────────────────────────────────
function SummaryTab({ mission, detections, editingMeta, setEditingMeta, onSave, busy }) {
  const [form, setForm] = useState({
    missionCode: mission.missionCode || '',
    operationType: mission.operationType || 'private_part91',
    operatorName: mission.operatorName || '',
    operatorCnpj: mission.operatorCnpj || '',
    operatorEmail: mission.operatorEmail || '',
    operatorPhone: mission.operatorPhone || '',
    briefingNotes: mission.briefingNotes || '',
  });

  useEffect(() => {
    setForm({
      missionCode: mission.missionCode || '',
      operationType: mission.operationType || 'private_part91',
      operatorName: mission.operatorName || '',
      operatorCnpj: mission.operatorCnpj || '',
      operatorEmail: mission.operatorEmail || '',
      operatorPhone: mission.operatorPhone || '',
      briefingNotes: mission.briefingNotes || '',
    });
  }, [mission]);

  const totalLegs = (mission.legs || []).length;
  const totalPax = (mission.passengers || []).filter(p => p.role !== 'crew').length;
  const totalCrew = (mission.passengers || []).filter(p => p.role === 'crew').length;
  const firstLeg = mission.legs?.[0];
  const lastLeg  = mission.legs?.[mission.legs.length - 1];
  const opType = OPERATION_TYPES.find(o => o.v === mission.operationType);

  return (
    <>
      {/* Resumo da missão */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div className="section-title">Resumo</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginTop:8 }}>
          {[
            { label:'Legs', value: totalLegs },
            { label:'PAX', value: totalPax },
            { label:'Tripulação', value: totalCrew },
            { label:'Origem', value: firstLeg?.departureIcao || '—' },
            { label:'Destino final', value: lastLeg?.destinationIcao || '—' },
            { label:'Início', value: mission.dateStart || '—' },
            { label:'Fim', value: mission.dateEnd || '—' },
            { label:'Tipo de operação', value: opType?.l || '—' },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--bg2)', padding:'10px 12px', borderRadius:6 }}>
              <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{k.label}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, marginTop:3 }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detecções automáticas */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div className="section-title">Detecções automáticas</div>
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
          Calculadas a partir dos ICAOs dos legs, datas e PAX. Definem quais checklists são obrigatórios.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
          {Object.entries(FLAG_META).map(([key, meta]) => {
            const on = !!detections[key];
            return (
              <div key={key} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                background: on ? 'rgba(61,191,138,0.08)' : 'var(--bg2)',
                border: `1px solid ${on ? 'rgba(61,191,138,0.4)' : 'var(--border)'}`,
                borderRadius:6, fontSize:12
              }}>
                <span style={{ fontSize:16 }}>{meta.icon}</span>
                <span style={{ flex:1 }}>{meta.label}</span>
                <span style={{ color: on ? 'var(--green)' : 'var(--text3)', fontWeight:600 }}>
                  {on ? '✓ SIM' : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operador */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div className="section-title" style={{ margin:0 }}>Operador & Metadados</div>
          {!editingMeta ? (
            <button onClick={() => setEditingMeta(true)} style={{ fontSize:12 }}>Editar</button>
          ) : (
            <div style={{ display:'flex', gap:8 }}>
              <button className="primary" disabled={busy} onClick={() => onSave({
                mission_code: form.missionCode || null,
                operation_type: form.operationType || null,
                operator_name: form.operatorName || null,
                operator_cnpj: form.operatorCnpj || null,
                operator_email: form.operatorEmail || null,
                operator_phone: form.operatorPhone || null,
                briefing_notes: form.briefingNotes || null,
              })} style={{ fontSize:12 }}>Salvar</button>
              <button onClick={() => setEditingMeta(false)} style={{ fontSize:12 }}>Cancelar</button>
            </div>
          )}
        </div>
        {!editingMeta ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, fontSize:12 }}>
            <Field label="Mission Code" value={mission.missionCode} />
            <Field label="Tipo de Operação" value={opType?.l} />
            <Field label="Operador" value={mission.operatorName} />
            <Field label="CNPJ" value={mission.operatorCnpj} mono />
            <Field label="E-mail Operacional" value={mission.operatorEmail} />
            <Field label="Telefone" value={mission.operatorPhone} />
            <div style={{ gridColumn:'1 / -1' }}>
              <Field label="Notas do Briefing" value={mission.briefingNotes} preserveLineBreaks />
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
            <div><label>Mission Code</label><input value={form.missionCode} onChange={e=>setForm(f=>({...f, missionCode:e.target.value}))} placeholder="CFP Voo 1 — KOPF/KHWD" /></div>
            <div><label>Tipo de Operação</label>
              <select value={form.operationType} onChange={e=>setForm(f=>({...f, operationType:e.target.value}))}>
                {OPERATION_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div><label>Operador (razão social)</label><input value={form.operatorName} onChange={e=>setForm(f=>({...f, operatorName:e.target.value}))} /></div>
            <div><label>CNPJ</label><input value={form.operatorCnpj} onChange={e=>setForm(f=>({...f, operatorCnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></div>
            <div><label>E-mail Operacional</label><input type="email" value={form.operatorEmail} onChange={e=>setForm(f=>({...f, operatorEmail:e.target.value}))} /></div>
            <div><label>Telefone</label><input value={form.operatorPhone} onChange={e=>setForm(f=>({...f, operatorPhone:e.target.value}))} /></div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label>Notas do Briefing</label>
              <textarea rows={3} value={form.briefingNotes} onChange={e=>setForm(f=>({...f, briefingNotes:e.target.value}))} placeholder="Considerações operacionais, NOTAMs, etc." />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, value, mono, preserveLineBreaks }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
      <div style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, marginTop:3, whiteSpace: preserveLineBreaks ? 'pre-wrap' : undefined }}>
        {value || <span style={{ color:'var(--text3)' }}>—</span>}
      </div>
    </div>
  );
}

// ── Checklist Tab ───────────────────────────────────────────────────
function ChecklistTab({ mission, detections }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await getMissionChecklist(mission.id)); }
    catch(e) { setError(e.message); }
    setLoading(false);
  }, [mission.id]);
  useEffect(() => { load(); }, [load]);

  async function seed() {
    if (!window.confirm('Gerar checklist padrão para todos os legs?\n(Se já existir, novos itens são adicionados, sem duplicar.)')) return;
    setBusy(true);
    try {
      const defaults = detections.international ? CHECKLIST_DEFAULTS_INTL : CHECKLIST_DEFAULTS_DOM;
      const legs = mission.legs || [];
      const existing = new Set(items.map(i => `${i.leg_index}|${i.checklist_type}`));
      for (let li = 0; li < legs.length; li++) {
        for (const type of defaults) {
          const key = `${li+1}|${type}`;
          if (existing.has(key)) continue;
          await saveMissionChecklistItem({
            missionId: mission.id,
            legIndex: li+1,
            checklistType: type,
            status: 'pending',
          });
        }
      }
      await load();
    } catch(e) { setError(e.message); }
    setBusy(false);
  }

  async function updateStatus(item, newStatus) {
    try {
      await saveMissionChecklistItem({ ...itemToCamel(item), status: newStatus });
      await load();
    } catch(e) { setError(e.message); }
  }

  async function addItem(legIndex, type) {
    try {
      await saveMissionChecklistItem({ missionId: mission.id, legIndex, checklistType: type, status: 'pending' });
      await load();
    } catch(e) { setError(e.message); }
  }

  async function removeItem(id) {
    if (!window.confirm('Remover este item?')) return;
    try { await deleteMissionChecklistItem(id); await load(); }
    catch(e) { setError(e.message); }
  }

  const legs = mission.legs || [];
  const types = Array.from(new Set([
    ...Object.keys(CHECKLIST_TYPE_LABELS).filter(t => t !== 'custom'),
    ...items.map(i => i.checklist_type),
  ]));

  function itemFor(legIndex, type) {
    return items.find(i => i.leg_index === legIndex && i.checklist_type === type);
  }

  if (loading) return <div style={{ color:'var(--text3)' }}>Carregando…</div>;
  if (legs.length === 0) return (
    <div className="card" style={{ padding:30, textAlign:'center', color:'var(--text3)' }}>
      Esta missão não tem legs ainda. Adicione legs no editor da missão antes de configurar checklists.
    </div>
  );

  return (
    <>
      {error && <div style={{ padding:10, background:'rgba(239,68,68,.1)', color:'var(--red)', borderRadius:6, marginBottom:10 }}>{error}</div>}

      <div className="card" style={{ padding:'12px 16px', marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12, color:'var(--text2)' }}>
            Matriz X / N-A por leg × tipo de checklist. {legs.length} leg(s) · {items.length} item(ns).
            {detections.international && ' Operação internacional → defaults expandidos (eAPIS, GD, PM, CR).'}
          </div>
          <button className="primary" disabled={busy} onClick={seed} style={{ fontSize:12 }}>
            🪄 Gerar checklist padrão
          </button>
        </div>
      </div>

      <div className="card" style={{ padding:0, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'var(--bg2)' }}>
              <th style={{ padding:'8px 10px', textAlign:'left', position:'sticky', left:0, background:'var(--bg2)', minWidth:200 }}>Checklist</th>
              {legs.map((leg, idx) => (
                <th key={idx} style={{ padding:'8px 6px', textAlign:'center', minWidth:120 }}>
                  <div style={{ fontWeight:600 }}>Leg {idx+1}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>
                    {leg.departureIcao}→{leg.destinationIcao}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map(type => (
              <tr key={type} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 10px', fontWeight:500, position:'sticky', left:0, background:'var(--bg0)' }}>
                  {CHECKLIST_TYPE_LABELS[type] || type}
                </td>
                {legs.map((_, legIdx) => {
                  const it = itemFor(legIdx+1, type);
                  if (!it) {
                    return (
                      <td key={legIdx} style={{ padding:'4px 6px', textAlign:'center' }}>
                        <button onClick={() => addItem(legIdx+1, type)} title="Adicionar" style={{ fontSize:11, padding:'2px 8px', opacity:.5 }}>+</button>
                      </td>
                    );
                  }
                  const meta = STATUS_META[it.status] || STATUS_META.pending;
                  return (
                    <td key={legIdx} style={{ padding:'4px 6px', textAlign:'center' }}>
                      <select
                        value={it.status}
                        onChange={e => updateStatus(it, e.target.value)}
                        style={{
                          fontSize:11, padding:'3px 6px',
                          background: `${meta.color}22`, color: meta.color, fontWeight:600,
                          border:`1px solid ${meta.color}44`, borderRadius:4
                        }}>
                        {Object.entries(STATUS_META).map(([k,v]) => (
                          <option key={k} value={k} style={{ background:'var(--bg1)', color:'var(--text1)' }}>
                            {v.icon} {v.label}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => removeItem(it.id)} title="Remover" style={{ fontSize:10, padding:'1px 4px', marginLeft:4, opacity:.4 }}>✕</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function itemToCamel(r) {
  return {
    id: r.id, missionId: r.mission_id, legIndex: r.leg_index, checklistType: r.checklist_type,
    customLabel: r.custom_label, status: r.status, assignedTo: r.assigned_to,
    dueDate: r.due_date, notes: r.notes, attachmentUrl: r.attachment_url,
  };
}

// ── Fuel Tab ────────────────────────────────────────────────────────
function FuelTab({ mission }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setQuotes(await getMissionFuelQuotes(mission.id)); }
    catch(e) { setError(e.message); }
    setLoading(false);
  }, [mission.id]);
  useEffect(() => { load(); }, [load]);

  const legs = mission.legs || [];

  async function addQuote(legIndex, airport) {
    setEditing({ legIndex, airport, supplier:'', upliftLb:'', pricePerGal:'' });
  }

  async function saveQuote() {
    setBusy(true);
    try {
      await saveMissionFuelQuote({
        missionId: mission.id,
        legIndex: editing.legIndex,
        airportIcao: editing.airport,
        supplier: editing.supplier,
        upliftLb: parseFloat(editing.upliftLb) || null,
        pricePerGal: parseFloat(editing.pricePerGal) || null,
        notes: editing.notes || null,
      });
      setEditing(null);
      await load();
    } catch(e) { setError(e.message); }
    setBusy(false);
  }

  async function choose(legIndex, quoteId) {
    try { await chooseFuelQuote(mission.id, legIndex, quoteId); await load(); }
    catch(e) { setError(e.message); }
  }

  async function removeQuote(id) {
    if (!window.confirm('Remover esta cotação?')) return;
    try { await deleteMissionFuelQuote(id); await load(); }
    catch(e) { setError(e.message); }
  }

  if (loading) return <div style={{ color:'var(--text3)' }}>Carregando…</div>;
  if (legs.length === 0) return (
    <div className="card" style={{ padding:30, textAlign:'center', color:'var(--text3)' }}>
      Adicione legs antes de planejar fuel.
    </div>
  );

  let totalChosen = 0;

  return (
    <>
      {error && <div style={{ padding:10, background:'rgba(239,68,68,.1)', color:'var(--red)', borderRadius:6, marginBottom:10 }}>{error}</div>}

      {legs.map((leg, legIdx) => {
        const idx = legIdx + 1;
        const legQuotes = quotes.filter(q => q.leg_index === idx);
        const chosen = legQuotes.find(q => q.is_chosen);
        if (chosen?.total_usd) totalChosen += parseFloat(chosen.total_usd);

        return (
          <div key={legIdx} className="card" style={{ padding:'14px 18px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:600 }}>Leg {idx} — {leg.departureIcao} → {leg.destinationIcao}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>Cotação de combustível no destino ({leg.destinationIcao})</div>
              </div>
              <button onClick={() => addQuote(idx, leg.destinationIcao)} style={{ fontSize:12 }}>+ Cotação</button>
            </div>

            {legQuotes.length === 0 ? (
              <div style={{ fontSize:12, color:'var(--text3)', padding:'10px 0' }}>Nenhuma cotação ainda.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg2)' }}>
                    {['Fornecedor','Uplift (lb)','$ / gal','Total US$','Escolhido',''].map(h => (
                      <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {legQuotes.map(q => (
                    <tr key={q.id} style={{ borderBottom:'1px solid var(--border)', background: q.is_chosen ? 'rgba(77,157,224,0.05)' : undefined }}>
                      <td style={{ padding:'7px 10px', fontWeight: q.is_chosen ? 600 : 400 }}>{q.supplier || '—'}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)' }}>{q.uplift_lb ? Math.round(q.uplift_lb).toLocaleString() : '—'}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)' }}>{q.price_per_gal ? `$${parseFloat(q.price_per_gal).toFixed(2)}` : '—'}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontWeight:600, color: q.is_chosen ? 'var(--blue)' : 'var(--text2)' }}>
                        {q.total_usd ? `$${parseFloat(q.total_usd).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding:'7px 10px' }}>
                        <button onClick={() => choose(idx, q.is_chosen ? null : q.id)} style={{ fontSize:11, padding:'2px 8px', background: q.is_chosen ? 'var(--blue-dim)' : undefined, color: q.is_chosen ? 'var(--blue)' : undefined }}>
                          {q.is_chosen ? '✓ Selecionado' : 'Escolher'}
                        </button>
                      </td>
                      <td style={{ padding:'7px 10px', textAlign:'right' }}>
                        <button className="danger" onClick={() => removeQuote(q.id)} style={{ fontSize:11, padding:'2px 6px' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <div className="card" style={{ padding:'12px 18px', marginTop:14, background:'rgba(77,157,224,0.05)' }}>
        <div style={{ fontSize:11, color:'var(--text3)' }}>Custo total combustível (cotações escolhidas)</div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--blue)', fontFamily:'var(--font-mono)' }}>
          ${totalChosen.toFixed(2)}
        </div>
      </div>

      {/* Modal de adicionar cotação */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(480px, 90vw)', background:'var(--bg1)', borderRadius:12, padding:20, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, marginBottom:12 }}>Nova cotação — Leg {editing.legIndex} ({editing.airport})</div>
            <div className="g2" style={{ marginBottom:10 }}>
              <div><label>Fornecedor</label>
                <input list="fuel-suppliers" value={editing.supplier} onChange={e=>setEditing(s=>({...s, supplier:e.target.value}))} placeholder="Air BP, Shell, World Fuel..." />
                <datalist id="fuel-suppliers">
                  <option value="Air BP" /><option value="Shell Aviation" /><option value="World Fuel Services" /><option value="Local FBO" />
                </datalist>
              </div>
              <div><label>Uplift (lb)</label><input type="number" value={editing.upliftLb} onChange={e=>setEditing(s=>({...s, upliftLb:e.target.value}))} placeholder="22000" /></div>
            </div>
            <div className="g2" style={{ marginBottom:10 }}>
              <div><label>Preço (USD / galão)</label><input type="number" step="0.01" value={editing.pricePerGal} onChange={e=>setEditing(s=>({...s, pricePerGal:e.target.value}))} placeholder="5.75" /></div>
              <div>
                <label>Total calculado</label>
                <input readOnly disabled value={(() => {
                  const lb = parseFloat(editing.upliftLb)||0;
                  const ppg = parseFloat(editing.pricePerGal)||0;
                  if (!lb || !ppg) return '';
                  return `$${((lb/6.7) * ppg).toFixed(2)}`;
                })()} />
              </div>
            </div>
            <div style={{ marginBottom:14 }}><label>Notas</label><input value={editing.notes||''} onChange={e=>setEditing(s=>({...s, notes:e.target.value}))} /></div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="primary" disabled={busy} onClick={saveQuote}>Salvar cotação</button>
              <button onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Validity Tab ───────────────────────────────────────────────────
function ValidityTab({ mission }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSnaps(await getMissionDocSnapshots(mission.id)); }
    catch(e) { setError(e.message); }
    setLoading(false);
  }, [mission.id]);
  useEffect(() => { load(); }, [load]);

  async function takeSnapshot() {
    setBusy(true);
    try {
      const n = await snapshotMissionDocs(mission.id);
      await load();
      alert(`Snapshot tirado: ${n} item(ns) capturados.`);
    } catch(e) { setError(e.message); }
    setBusy(false);
  }

  const blockers = snaps.filter(s => s.status === 'expired' || s.status === 'blocking');
  const warnings = snaps.filter(s => s.status === 'warning');
  const oks = snaps.filter(s => s.status === 'ok');

  return (
    <>
      {error && <div style={{ padding:10, background:'rgba(239,68,68,.1)', color:'var(--red)', borderRadius:6, marginBottom:10 }}>{error}</div>}

      <div className="card" style={{ padding:'14px 18px', marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12, color:'var(--text2)' }}>
            Snapshot dos documentos da tripulação e manutenção da aeronave no momento da missão.
            Validades comparadas com a data fim da missão ({mission.dateEnd || mission.dateStart || '?'}).
          </div>
          <button className="primary" disabled={busy} onClick={takeSnapshot} style={{ fontSize:12 }}>
            📸 Tirar snapshot agora
          </button>
        </div>
      </div>

      {loading ? <div style={{ color:'var(--text3)' }}>Carregando…</div> : snaps.length === 0 ? (
        <div className="card" style={{ padding:30, textAlign:'center', color:'var(--text3)' }}>
          Nenhum snapshot ainda. Clique em "Tirar snapshot agora" para capturar o estado atual dos documentos.
        </div>
      ) : (
        <>
          {blockers.length > 0 && (
            <div className="card" style={{ padding:'14px 18px', marginBottom:12, borderLeft:'4px solid var(--red)' }}>
              <div style={{ fontWeight:600, color:'var(--red)', marginBottom:8 }}>🚨 Bloqueia ou vencido ({blockers.length})</div>
              <DocList items={blockers} />
            </div>
          )}
          {warnings.length > 0 && (
            <div className="card" style={{ padding:'14px 18px', marginBottom:12, borderLeft:'4px solid var(--amber)' }}>
              <div style={{ fontWeight:600, color:'var(--amber)', marginBottom:8 }}>⚠️ Vencendo em até 30 dias ({warnings.length})</div>
              <DocList items={warnings} />
            </div>
          )}
          {oks.length > 0 && (
            <div className="card" style={{ padding:'14px 18px', marginBottom:12 }}>
              <div style={{ fontWeight:600, color:'var(--green)', marginBottom:8 }}>✓ OK ({oks.length})</div>
              <DocList items={oks} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function DocList({ items }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
      <tbody>
        {items.map(s => {
          const sm = DOC_STATUS_META[s.status] || DOC_STATUS_META.ok;
          return (
            <tr key={s.id} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'7px 10px', fontWeight:500 }}>{s.doc_label}</td>
              <td style={{ padding:'7px 10px', color:'var(--text3)', fontSize:11 }}>{s.doc_type}</td>
              <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:11 }}>{s.expires_at || '—'}</td>
              <td style={{ padding:'7px 10px', textAlign:'right' }}>
                {s.days_to_expire !== null && (
                  <span style={{ color: sm.color, fontSize:11, fontWeight:600 }}>
                    {s.days_to_expire < 0 ? `${Math.abs(s.days_to_expire)}d vencido` : `${s.days_to_expire}d`}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
