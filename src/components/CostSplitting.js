import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { getUser } from '../store';

// ── Helpers ───────────────────────────────────────────────────
function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtH(min) {
  if (!min) return '0h00';
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h${String(m).padStart(2,'0')}`;
}
function periodLabel(p) {
  if (p === 'month') return 'Este mês';
  if (p === 'quarter') return 'Trimestre';
  if (p === 'year') return 'Este ano';
  return 'Personalizado';
}
function getPeriodDates(period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === 'month') return {
    start: new Date(y, m, 1).toISOString().slice(0,10),
    end:   new Date(y, m+1, 0).toISOString().slice(0,10),
  };
  if (period === 'quarter') {
    const q = Math.floor(m / 3);
    return {
      start: new Date(y, q*3, 1).toISOString().slice(0,10),
      end:   new Date(y, q*3+3, 0).toISOString().slice(0,10),
    };
  }
  if (period === 'year') return {
    start: `${y}-01-01`,
    end:   `${y}-12-31`,
  };
  return { start: '', end: '' };
}

const SPLIT_LABELS = {
  equal:               { label: 'Fixo — divide igual', color: 'var(--blue)',   icon: '⚖️' },
  proportional_hours:  { label: 'Variável — por horas', color: 'var(--amber)', icon: '⏱' },
  direct:              { label: 'Direto',               color: 'var(--purple)', icon: '👤' },
  exempt:              { label: 'Isento do rateio',     color: 'var(--text3)',  icon: '🚫' },
};

// ── Store calls ───────────────────────────────────────────────
async function getCoOwners(aircraftId) {
  const { data, error } = await supabase
    .from('aircraft_co_owners')
    .select('*')
    .eq('aircraft_id', aircraftId)
    .is('left_at', null)
    .order('share_pct', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getCostsForPeriod(aircraftId, start, end) {
  const { data, error } = await supabase
    .from('costs')
    .select('*')
    .eq('aircraft_id', aircraftId)
    .gte('reference_date', start)
    .lte('reference_date', end)
    .neq('split_rule', 'exempt')
    .order('reference_date');
  if (error) throw error;
  return data || [];
}

async function getFlightsForPeriod(aircraftId, start, end) {
  const { data, error } = await supabase
    .from('flights')
    .select('id, date, flight_time_minutes, pilot_name, co_owner_id')
    .eq('aircraft_id', aircraftId)
    .gte('date', start)
    .lte('date', end)
    .order('date');
  if (error) throw error;
  return data || [];
}

async function updateCostSplitRule(costId, splitRule) {
  const { error } = await supabase
    .from('costs')
    .update({ split_rule: splitRule })
    .eq('id', costId);
  if (error) throw error;
}

async function saveSplitRecord(splits) {
  if (!splits.length) return;
  const { error } = await supabase.from('cost_splits').insert(splits);
  if (error) throw error;
}

// ── Main calculation engine ───────────────────────────────────
function calculateSplits(costs, flights, owners) {
  if (!owners.length) return {};

  // Hours per owner in period
  const hoursByOwner = {};
  owners.forEach(o => { hoursByOwner[o.id] = 0; });
  let totalMinutes = 0;
  flights.forEach(f => {
    totalMinutes += f.flight_time_minutes || 0;
    if (f.co_owner_id && hoursByOwner[f.co_owner_id] !== undefined) {
      hoursByOwner[f.co_owner_id] += f.flight_time_minutes || 0;
    }
  });

  // Result: { ownerId: { fixed, variable, total, hours } }
  const result = {};
  owners.forEach(o => {
    result[o.id] = {
      owner: o,
      fixed: 0,
      variable: 0,
      total: 0,
      hours: hoursByOwner[o.id] || 0,
      items: [],
    };
  });

  costs.forEach(cost => {
    const amount = parseFloat(cost.amount_brl) || 0;
    const rule = cost.split_rule || 'equal';

    if (rule === 'equal') {
      // Divide equally among all owners
      owners.forEach(o => {
        const share = (o.share_pct / 100) * amount;
        result[o.id].fixed += share;
        result[o.id].items.push({
          costId: cost.id,
          description: cost.description,
          category: cost.category,
          totalAmount: amount,
          ownerAmount: share,
          rule: 'equal',
          sharePct: o.share_pct,
          date: cost.reference_date,
        });
      });

    } else if (rule === 'proportional_hours') {
      // Proportional to hours flown
      if (totalMinutes === 0) {
        // No flights in period — fallback to equal split
        owners.forEach(o => {
          const share = (o.share_pct / 100) * amount;
          result[o.id].variable += share;
          result[o.id].items.push({
            costId: cost.id,
            description: cost.description,
            category: cost.category,
            totalAmount: amount,
            ownerAmount: share,
            rule: 'equal_fallback',
            sharePct: o.share_pct,
            note: 'Sem voos no período — rateio igual',
            date: cost.reference_date,
          });
        });
      } else {
        owners.forEach(o => {
          const ownerMinutes = hoursByOwner[o.id] || 0;
          const pct = ownerMinutes / totalMinutes;
          const share = pct * amount;
          result[o.id].variable += share;
          result[o.id].items.push({
            costId: cost.id,
            description: cost.description,
            category: cost.category,
            totalAmount: amount,
            ownerAmount: share,
            rule: 'proportional_hours',
            hoursPct: (pct * 100).toFixed(1),
            ownerMinutes,
            totalMinutes,
            date: cost.reference_date,
          });
        });
      }

    } else if (rule === 'direct') {
      const targetName = cost.direct_owner_name;
      const target = owners.find(o =>
        o.display_name === targetName || o.id === cost.direct_owner_name
      );
      if (target) {
        result[target.id].variable += amount;
        result[target.id].items.push({
          costId: cost.id,
          description: cost.description,
          category: cost.category,
          totalAmount: amount,
          ownerAmount: amount,
          rule: 'direct',
          date: cost.reference_date,
        });
      }
    }
  });

  // Calculate totals
  owners.forEach(o => {
    result[o.id].total = result[o.id].fixed + result[o.id].variable;
  });

  return result;
}

// ── Component ─────────────────────────────────────────────────
export default function CostSplitting({ aircraft }) {
  const [owners,     setOwners]     = useState([]);
  const [costs,      setCosts]      = useState([]);
  const [flights,    setFlights]    = useState([]);
  const [splits,     setSplits]     = useState({});
  const [period,     setPeriod]     = useState('month');
  const [customStart,setCustomStart]= useState('');
  const [customEnd,  setCustomEnd]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeOwner,setActiveOwner]= useState(null); // expanded detail
  const [editCost,   setEditCost]   = useState(null);
  const [saving,     setSaving]     = useState(false);

  const dates = period === 'custom'
    ? { start: customStart, end: customEnd }
    : getPeriodDates(period);

  const load = useCallback(async () => {
    if (!aircraft?.id || !dates.start || !dates.end) return;
    setLoading(true); setError('');
    try {
      const [ow, cs, fl] = await Promise.all([
        getCoOwners(aircraft.id),
        getCostsForPeriod(aircraft.id, dates.start, dates.end),
        getFlightsForPeriod(aircraft.id, dates.start, dates.end),
      ]);
      setOwners(ow);
      setCosts(cs);
      setFlights(fl);
      setSplits(calculateSplits(cs, fl, ow));
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [aircraft?.id, dates.start, dates.end]);

  useEffect(() => { load(); }, [load]);

  async function handleRuleChange(costId, rule) {
    setSaving(true);
    try {
      await updateCostSplitRule(costId, rule);
      setCosts(prev => prev.map(c => c.id === costId ? { ...c, split_rule: rule } : c));
      setSplits(calculateSplits(
        costs.map(c => c.id === costId ? { ...c, split_rule: rule } : c),
        flights, owners
      ));
    } catch(e) { setError(e.message); }
    setSaving(false);
    setEditCost(null);
  }

  const totalCosts   = costs.reduce((s,c) => s + parseFloat(c.amount_brl||0), 0);
  const totalHours   = flights.reduce((s,f) => s + (f.flight_time_minutes||0), 0);
  const splitEntries = Object.values(splits);

  // ── No co-owners ─────────────────────────────────────────
  // Estado para o formulario de adicionar socio
  const [showAddOwner, setShowAddOwner] = React.useState(false);
  const [newOwnerName, setNewOwnerName] = React.useState('');
  const [newOwnerEmail, setNewOwnerEmail] = React.useState('');
  const [newOwnerPct, setNewOwnerPct] = React.useState('');
  const [newOwnerRole, setNewOwnerRole] = React.useState('owner');
  const [newOwnerDate, setNewOwnerDate] = React.useState(new Date().toISOString().slice(0,10));
  const [addingOwner, setAddingOwner] = React.useState(false);

  async function handleAddOwner() {
    if (!newOwnerName || !newOwnerPct) return;
    setAddingOwner(true);
    try {
      const user = await getUser();
      const { error } = await supabase.from('aircraft_co_owners').insert({
        aircraft_id: aircraft.id,
        display_name: newOwnerName,
        email: newOwnerEmail || null,
        share_pct: parseFloat(newOwnerPct),
        role: newOwnerRole || 'owner',
        joined_at: newOwnerDate || new Date().toISOString().slice(0,10),
      });
      if (error) throw error;
      setNewOwnerName(''); setNewOwnerEmail(''); setNewOwnerPct('');
      setShowAddOwner(false);
      load();
    } catch(e) { setError(e.message); }
    setAddingOwner(false);
  }

  if (!loading && owners.length === 0) return (
    <div style={{ padding:'32px 24px' }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🤝</div>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>Nenhum sócio cadastrado</div>
        <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.7 }}>
          Adicione os sócios para começar o rateio de custos da {aircraft?.registration}.
        </div>
      </div>
      {!showAddOwner ? (
        <div style={{ textAlign:'center' }}>
          <button onClick={() => setShowAddOwner(true)} style={{ padding:'10px 24px', background:'var(--blue)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}>
            + Adicionar primeiro sócio
          </button>
        </div>
      ) : (
        <div style={{ maxWidth:420, margin:'0 auto', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:24 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:20 }}>Novo sócio / co-proprietário</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600, textTransform:'uppercase' }}>Nome completo *</label>
              <input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Nome do sócio" style={{ width:'100%', padding:'9px 12px', background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text1)', fontSize:13 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600, textTransform:'uppercase' }}>E-mail (opcional)</label>
              <input value={newOwnerEmail} onChange={e=>setNewOwnerEmail(e.target.value)} placeholder="email@exemplo.com" type="email" style={{ width:'100%', padding:'9px 12px', background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text1)', fontSize:13 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600, textTransform:'uppercase' }}>Cota de propriedade (%) *</label>
              <input value={newOwnerPct} onChange={e=>setNewOwnerPct(e.target.value)} placeholder="Ex: 50" type="number" min="1" max="100" style={{ width:'100%', padding:'9px 12px', background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text1)', fontSize:13 }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600, textTransform:'uppercase' }}>Papel</label>
                <select value={newOwnerRole} onChange={e=>setNewOwnerRole(e.target.value)} style={{ width:'100%', padding:'9px 12px', background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text1)', fontSize:13 }}>
                  <option value="owner">Proprietário</option>
                  <option value="co_owner">Co-proprietário</option>
                  <option value="manager">Gestor</option>
                  <option value="authorized_pilot">Piloto autorizado</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600, textTransform:'uppercase' }}>Sócio desde</label>
                <input value={newOwnerDate} onChange={e=>setNewOwnerDate(e.target.value)} type="date" style={{ width:'100%', padding:'9px 12px', background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text1)', fontSize:13 }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button onClick={handleAddOwner} disabled={addingOwner || !newOwnerName || !newOwnerPct} style={{ flex:1, padding:'10px', background:'var(--blue)', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', opacity:(!newOwnerName||!newOwnerPct)?0.5:1 }}>
                {addingOwner ? 'Salvando...' : 'Salvar sócio'}
              </button>
              <button onClick={() => setShowAddOwner(false)} style={{ padding:'10px 16px', background:'transparent', color:'var(--text3)', border:'1px solid var(--border)', borderRadius:9, fontSize:13, cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding:'20px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:20, marginBottom:4 }}>
          Rateio de custos — {aircraft?.registration}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:12, color:'var(--text3)' }}>
          {owners.length} sócios · Custo fixo por cota · Variável por horas voadas
        </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Period selector */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20, alignItems:'center' }}>
        {['month','quarter','year','custom'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${period===p?'var(--blue)':'var(--border)'}`, background:period===p?'var(--blue-dim)':'transparent', color:period===p?'var(--blue)':'var(--text3)', fontSize:12, cursor:'pointer', fontWeight:period===p?600:400 }}>
            {periodLabel(p)}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ fontSize:12, padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text1)' }} />
            <span style={{ color:'var(--text3)', fontSize:12 }}>até</span>
            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ fontSize:12, padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text1)' }} />
          </>
        )}
        {dates.start && <span style={{ fontSize:11, color:'var(--text3)', marginLeft:4 }}>{dates.start} → {dates.end}</span>}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Calculando...</div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Total de custos', value: fmtBRL(totalCosts), color:'var(--text1)' },
              { label:'Horas voadas', value: fmtH(totalHours), color:'var(--blue)' },
              { label:'Lançamentos', value: costs.length, color:'var(--text3)' },
            ].map((s,i) => (
              <div key={i} style={{ padding:'12px 16px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:600, fontFamily:'var(--font-mono)', color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Owner cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
            {splitEntries.map(({ owner, fixed, variable, total, hours, items }) => {
              const isActive = activeOwner === owner.id;
              const ownerPct = totalHours > 0 ? ((hours / totalHours) * 100).toFixed(0) : 0;
              return (
                <div key={owner.id} style={{ borderRadius:14, border:`1.5px solid ${isActive?'var(--blue)':'var(--border)'}`, overflow:'hidden', background:'var(--bg1)', transition:'border-color .2s' }}>
                  {/* Owner header */}
                  <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', background: isActive ? 'var(--blue-dim)' : 'transparent' }}
                    onClick={() => setActiveOwner(isActive ? null : owner.id)}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:600, color:'var(--text1)', flexShrink:0 }}>
                      {owner.display_name.charAt(0)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{owner.display_name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, display:'flex', gap:10 }}>
                        <span>{owner.share_pct}% · {owner.role==='owner'?'Proprietário':owner.role==='manager'?'Gestor':owner.role==='authorized_pilot'?'Piloto Autorizado':'Co-proprietário'}</span>
                        <span>·</span>
                        <span>{fmtH(hours)} voadas ({ownerPct}% do total)</span>
                      </div>
                    </div>
                    {/* Total a pagar */}
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:20, fontWeight:700, fontFamily:'var(--font-mono)', color: total > 0 ? 'var(--text1)' : 'var(--text3)' }}>
                        {fmtBRL(total)}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                        fixo {fmtBRL(fixed)} · variável {fmtBRL(variable)}
                      </div>
                    </div>
                    <div style={{ color: isActive ? 'var(--blue)' : 'var(--text3)', fontSize:16 }}>
                      {isActive ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Breakdown */}
                  {isActive && (
                    <div style={{ borderTop:'1px solid var(--border)' }}>
                      {/* Fixed vs Variable bar */}
                      <div style={{ padding:'12px 18px', background:'var(--bg2)', display:'flex', gap:16, flexWrap:'wrap' }}>
                        {[
                          { label:'Custos fixos (cota)', value: fixed, color:'var(--blue)', pct: total>0?(fixed/total*100).toFixed(0):0 },
                          { label:'Custos variáveis (horas)', value: variable, color:'var(--amber)', pct: total>0?(variable/total*100).toFixed(0):0 },
                        ].map((b,i) => (
                          <div key={i} style={{ flex:1, minWidth:160 }}>
                            <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>{b.label}</div>
                            <div style={{ height:6, background:'var(--bg3)', borderRadius:3, marginBottom:4, overflow:'hidden' }}>
                              <div style={{ width:`${b.pct}%`, height:'100%', background:b.color, borderRadius:3, transition:'width .3s' }} />
                            </div>
                            <div style={{ fontSize:13, fontWeight:600, fontFamily:'var(--font-mono)', color:b.color }}>{fmtBRL(b.value)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Item list */}
                      <div style={{ padding:'4px 0' }}>
                        {items.filter(item => item.ownerAmount > 0.01).map((item, i) => {
                          const splitInfo = SPLIT_LABELS[item.rule] || SPLIT_LABELS[item.rule?.replace('_fallback','')] || {};
                          return (
                            <div key={i} style={{ padding:'8px 18px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--border)', fontSize:12 }}>
                              <span style={{ fontSize:14, flexShrink:0 }}>{splitInfo.icon}</span>
                              <div style={{ flex:1 }}>
                                <span style={{ color:'var(--text1)' }}>{item.description}</span>
                                <span style={{ marginLeft:8, fontSize:10, color:'var(--text3)' }}>{item.date}</span>
                                {item.note && <span style={{ marginLeft:8, fontSize:10, color:'var(--amber)' }}>({item.note})</span>}
                              </div>
                              <div style={{ textAlign:'right', flexShrink:0 }}>
                                <div style={{ fontFamily:'var(--font-mono)', fontWeight:500, color:'var(--text1)' }}>{fmtBRL(item.ownerAmount)}</div>
                                <div style={{ fontSize:10, color:'var(--text3)' }}>
                                  {item.rule === 'proportional_hours'
                                    ? `${fmtH(item.ownerMinutes)} de ${fmtH(item.totalMinutes)} (${item.hoursPct}%)`
                                    : item.sharePct ? `${item.sharePct}% da cota`
                                    : item.rule === 'direct' ? 'direto' : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Costs with split rules */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>
              Lançamentos do período
              <span style={{ fontSize:11, fontWeight:400, color:'var(--text3)', marginLeft:8 }}>clique para alterar a regra de rateio</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {costs.map(cost => {
                const rule = cost.split_rule || 'equal';
                const info = SPLIT_LABELS[rule] || {};
                const isEditing = editCost === cost.id;
                return (
                  <div key={cost.id} style={{ padding:'10px 14px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{info.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:500 }}>{cost.description}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{cost.reference_date} · {cost.category}</div>
                    </div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:500, flexShrink:0, marginRight:8 }}>
                      {fmtBRL(parseFloat(cost.amount_brl))}
                    </div>
                    {isEditing ? (
                      <div style={{ display:'flex', gap:4, flexShrink:0, flexWrap:'wrap', width:'100%', marginTop:4 }}>
                        {Object.entries(SPLIT_LABELS).map(([key, val]) => (
                          <button key={key} onClick={() => handleRuleChange(cost.id, key)} disabled={saving}
                            style={{ padding:'4px 8px', fontSize:10, borderRadius:6, border:`1px solid ${rule===key?val.color:'var(--border)'}`, background:rule===key?'var(--bg3)':'transparent', color:val.color, cursor:'pointer', whiteSpace:'nowrap' }}>
                            {val.icon} {key === 'equal' ? 'Igual' : key === 'proportional_hours' ? 'Horas' : key === 'direct' ? 'Direto' : 'Isento'}
                          </button>
                        ))}
                        <button onClick={() => setEditCost(null)} style={{ padding:'4px 8px', fontSize:10, borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text3)', cursor:'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditCost(cost.id)}
                        style={{ padding:'4px 10px', fontSize:10, borderRadius:6, border:`1px solid ${info.color}33`, background:'transparent', color:info.color, cursor:'pointer', flexShrink:0, fontWeight:500 }}>
                        {info.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hours per pilot */}
          {flights.length > 0 && (
            <div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Horas voadas por sócio no período</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {owners.map(o => {
                  const mins = (splits[o.id]?.hours) || 0;
                  const pct = totalHours > 0 ? (mins / totalHours * 100) : 0;
                  return (
                    <div key={o.id} style={{ flex:'1 1 140px', padding:'12px 14px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{o.display_name.split(' ')[0]}</div>
                      <div style={{ fontSize:20, fontWeight:700, fontFamily:'var(--font-mono)', color:'var(--blue)', marginBottom:4 }}>{fmtH(mins)}</div>
                      <div style={{ height:4, background:'var(--bg3)', borderRadius:2, overflow:'hidden', marginBottom:4 }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:'var(--blue)', borderRadius:2 }} />
                      </div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>{pct.toFixed(0)}% do total</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
