import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { getUser, getAircraft } from '../store';

const ALERT_TYPES = {
  doc_expiry:      { icon:'📄', label:'Documento vencendo',     color:'var(--red)'    },
  mx_due:          { icon:'🔧', label:'Manutenção pendente',    color:'var(--amber)'  },
  hours_goal:      { icon:'🎯', label:'Meta de horas',          color:'var(--green)'  },
  cost_threshold:  { icon:'💰', label:'Limite de custo',        color:'var(--blue)'   },
  custom:          { icon:'🔔', label:'Alerta personalizado',   color:'var(--purple)' },
};

const UNIT_LABELS = { days:'dias antes', hours:'horas', brl:'R$' };

async function getAlerts() {
  const user = await getUser(); if (!user) return [];
  const { data } = await supabase.from('custom_alerts').select('*').eq('user_id', user.id).order('alert_type').order('name');
  return data || [];
}
async function saveAlert(a) {
  const user = await getUser(); if (!user) throw new Error('Não autenticado');
  const row = {
    user_id: user.id, aircraft_id: a.aircraft_id || null,
    name: a.name, alert_type: a.alert_type,
    trigger_field: a.trigger_field || null,
    trigger_value: parseFloat(a.trigger_value) || null,
    trigger_unit: a.trigger_unit || 'days',
    target_type: a.target_type || null,
    channel: a.channel || 'in_app',
    is_active: a.is_active !== false,
    notes: a.notes || null,
  };
  if (a.id) { const {data,error} = await supabase.from('custom_alerts').update(row).eq('id',a.id).select().single(); if(error) throw error; return data; }
  else       { const {data,error} = await supabase.from('custom_alerts').insert(row).select().single(); if(error) throw error; return data; }
}
async function toggleAlert(id, is_active) {
  const { error } = await supabase.from('custom_alerts').update({ is_active }).eq('id', id);
  if (error) throw error;
}
async function deleteAlert(id) {
  const { error } = await supabase.from('custom_alerts').delete().eq('id', id);
  if (error) throw error;
}

const EMPTY = { name:'', alert_type:'doc_expiry', aircraft_id:'', trigger_field:'expiry_date', trigger_value:'30', trigger_unit:'days', channel:'in_app', is_active:true, notes:'' };

const ALERT_PRESETS = [
  { name:'CVA vencendo em 60 dias',           alert_type:'doc_expiry',     trigger_field:'expiry_date',        trigger_value:'60',    trigger_unit:'days', channel:'in_app' },
  { name:'Seguro vencendo em 30 dias',         alert_type:'doc_expiry',     trigger_field:'expiry_date',        trigger_value:'30',    trigger_unit:'days', channel:'in_app' },
  { name:'Inspeção 100h — 10h antes',          alert_type:'mx_due',         trigger_field:'next_due_hours',     trigger_value:'10',    trigger_unit:'hours', channel:'in_app' },
  { name:'Meta 100h voadas no ano',            alert_type:'hours_goal',     trigger_field:'total_flight_hours', trigger_value:'100',   trigger_unit:'hours', channel:'in_app' },
  { name:'Custo mensal > R$5.000',             alert_type:'cost_threshold', trigger_field:'amount_brl',         trigger_value:'5000',  trigger_unit:'brl',  channel:'in_app' },
  { name:'TBO Motor — 200h restantes',         alert_type:'mx_due',         trigger_field:'next_due_hours',     trigger_value:'200',   trigger_unit:'hours', channel:'in_app' },
];

export default function CustomAlerts({ onClose }) {
  const [alerts,   setAlerts]   = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [al, ac] = await Promise.all([getAlerts(), getAircraft()]);
    setAlerts(al); setAircraft(ac||[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function startNew(preset) { setForm({ ...EMPTY, ...preset }); setEditing('new'); }
  function startEdit(a) { setForm({ ...a, trigger_value: String(a.trigger_value||''), aircraft_id: a.aircraft_id||'' }); setEditing(a.id); }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('');
    try { await saveAlert(form); await load(); setEditing(null); }
    catch(e) { setError(e.message); }
    setSaving(false);
  }

  async function handleToggle(id, cur) {
    try { await toggleAlert(id, !cur); await load(); } catch(e) { setError(e.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover alerta?')) return;
    try { await deleteAlert(id); await load(); } catch(e) { setError(e.message); }
  }

  // Describe the alert in plain language
  function describe(a) {
    const meta = ALERT_TYPES[a.alert_type];
    const unit = UNIT_LABELS[a.trigger_unit] || a.trigger_unit;
    if (a.alert_type === 'doc_expiry')     return `Avisar ${a.trigger_value} ${unit} do vencimento do documento`;
    if (a.alert_type === 'mx_due')         return `Avisar quando restar ${a.trigger_value} ${unit} para a manutenção`;
    if (a.alert_type === 'hours_goal')     return `Avisar ao atingir ${a.trigger_value} ${unit} de voo`;
    if (a.alert_type === 'cost_threshold') return `Avisar quando custo mensal ultrapassar R$${parseFloat(a.trigger_value||0).toLocaleString('pt-BR')}`;
    return a.notes || 'Alerta personalizado';
  }

  // ── Form View ──────────────────────────────────────────────
  if (editing !== null) return (
    <div style={{ padding:'20px 24px', maxWidth:580 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>{editing==='new' ? 'Novo alerta' : 'Editar alerta'}</div>
      </div>
      {error && <div style={{ marginBottom:12, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}
      <form onSubmit={handleSave}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
          <div style={{ marginBottom:12 }}>
            <label>Nome do alerta *</label>
            <input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="CVA vencendo em 60 dias" autoFocus />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div><label>Tipo</label>
              <select value={form.alert_type} onChange={e=>set('alert_type',e.target.value)}>
                {Object.entries(ALERT_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div><label>Aeronave</label>
              <select value={form.aircraft_id} onChange={e=>set('aircraft_id',e.target.value)}>
                <option value="">Todas as aeronaves</option>
                {aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div><label>Valor de disparo</label>
              <input type="number" value={form.trigger_value} onChange={e=>set('trigger_value',e.target.value)} placeholder="30" style={{ fontFamily:'var(--font-mono)' }} />
            </div>
            <div><label>Unidade</label>
              <select value={form.trigger_unit} onChange={e=>set('trigger_unit',e.target.value)}>
                <option value="days">Dias (antes do vencimento)</option>
                <option value="hours">Horas (meta / limite)</option>
                <option value="brl">Reais (limite de custo)</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label>Canal</label>
            <select value={form.channel} onChange={e=>set('channel',e.target.value)}>
              <option value="in_app">No app (sino de notificações)</option>
              <option value="email">E-mail</option>
              <option value="both">Ambos</option>
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" id="active" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)} />
            <label htmlFor="active" style={{ fontSize:12, cursor:'pointer', marginBottom:0 }}>Alerta ativo</label>
          </div>
        </div>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <label>Observações (opcional)</label>
          <textarea rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Notas sobre este alerta..." />
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" className="primary" disabled={saving} style={{ flex:1 }}>
            {saving ? 'Salvando...' : '✓ Salvar alerta'}
          </button>
          <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  // ── List View ──────────────────────────────────────────────
  const active   = alerts.filter(a => a.is_active);
  const inactive = alerts.filter(a => !a.is_active);

  return (
    <div style={{ padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:20 }}>Alertas Personalizados</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
            {active.length} ativo{active.length!==1?'s':''} · {inactive.length} inativo{inactive.length!==1?'s':''}
          </div>
        </div>
        <button className="primary" onClick={() => startNew({})}>+ Novo alerta</button>
      </div>

      {error && <div style={{ marginBottom:12, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}

      {/* Presets */}
      {alerts.length === 0 && !loading && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.06em' }}>Sugestões rápidas</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {ALERT_PRESETS.map((p, i) => (
              <div key={i} onClick={() => startNew(p)}
                style={{ padding:'10px 14px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.background='var(--blue-dim)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg2)';}}>
                <div style={{ fontSize:12, fontWeight:500, marginBottom:2 }}>{ALERT_TYPES[p.alert_type]?.icon} {p.name}</div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>{ALERT_TYPES[p.alert_type]?.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Carregando...</div>
      ) : alerts.length === 0 ? (
        <div style={{ padding:'30px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔔</div>
          Use as sugestões acima ou crie um alerta personalizado.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[...active, ...inactive].map(a => {
            const meta = ALERT_TYPES[a.alert_type] || ALERT_TYPES.custom;
            const ac   = aircraft.find(x => x.id === a.aircraft_id);
            return (
              <div key={a.id} style={{ padding:'12px 16px', borderRadius:12, background:'var(--bg1)', border:`1px solid var(--border)`, display:'flex', alignItems:'center', gap:12, opacity: a.is_active ? 1 : 0.5 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{meta.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{a.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <span>{describe(a)}</span>
                    {ac && <span style={{ fontFamily:'var(--font-mono)', fontWeight:500 }}>{ac.registration}</span>}
                    <span>{a.channel === 'in_app' ? '🔔 App' : a.channel === 'email' ? '📧 E-mail' : '🔔📧 Ambos'}</span>
                  </div>
                </div>
                {/* Toggle */}
                <div onClick={() => handleToggle(a.id, a.is_active)}
                  style={{ width:38, height:22, borderRadius:11, background: a.is_active ? 'var(--green)' : 'var(--bg3)', border:`1px solid ${a.is_active?'var(--green-mid)':'var(--border)'}`, cursor:'pointer', position:'relative', flexShrink:0, transition:'background .2s' }}>
                  <div style={{ position:'absolute', top:2, left: a.is_active ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
                <button className="ghost" style={{ fontSize:11, padding:'5px 10px', flexShrink:0 }} onClick={() => startEdit(a)}>Editar</button>
                <button className="ghost" style={{ fontSize:11, padding:'5px 10px', color:'var(--red)', flexShrink:0 }} onClick={() => handleDelete(a.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
