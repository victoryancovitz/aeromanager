import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { getUser } from '../store';

const EMPTY_LOG = { aircraftId:'', date:'', hoursAtCheck:'', qtAdded:'', qtAfter:'', notes:'' };

async function getOilLogs(aircraftId) {
  const user = await getUser();
  if (!user) return [];
  let q = supabase.from('oil_logs').select('*').eq('user_id', user.id).order('date', { ascending: false });
  if (aircraftId) q = q.eq('aircraft_id', aircraftId);
  const { data } = await q;
  return data || [];
}

async function saveOilLog(log) {
  const user = await getUser();
  if (!user) return;
  const row = {
    user_id:      user.id,
    aircraft_id:  log.aircraftId,
    date:         log.date,
    hours_at_check: parseFloat(log.hoursAtCheck) || 0,
    qt_added:     parseFloat(log.qtAdded) || 0,
    qt_after:     parseFloat(log.qtAfter) || null,
    notes:        log.notes || null,
  };
  if (log.id) {
    await supabase.from('oil_logs').update(row).eq('id', log.id);
  } else {
    await supabase.from('oil_logs').insert(row);
  }
}

async function deleteOilLog(id) {
  await supabase.from('oil_logs').delete().eq('id', id);
}

function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 120, h = 36, pad = 4;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return i === values.length - 1 ? <circle key={i} cx={x} cy={y} r="3" fill={color} /> : null;
      })}
    </svg>
  );
}

export default function OilTracking({ aircraft=[] }) {
  const [logs, setLogs]         = useState([]);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_LOG);
  const [filterAc, setFilterAc] = useState(aircraft[0]?.id || '');
  const [loading, setLoading]   = useState(true);
  const [tableReady, setTableReady] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [filterAc]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getOilLogs(filterAc);
      setLogs(data);
    } catch(e) {
      if (e.message?.includes('relation') || e.code === '42P01') setTableReady(false);
    }
    setLoading(false);
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function startNew() { setForm({ ...EMPTY_LOG, aircraftId: filterAc || aircraft[0]?.id || '', date: new Date().toISOString().slice(0,10) }); setEditing('new'); }
  function startEdit(log) { setForm({ id:log.id, aircraftId:log.aircraft_id, date:log.date, hoursAtCheck:log.hours_at_check, qtAdded:log.qt_added, qtAfter:log.qt_after||'', notes:log.notes||'' }); setEditing(log.id); }
  function cancel() { setEditing(null); }

  async function submit(e) {
    e.preventDefault();
    await saveOilLog(form);
    await loadLogs();
    setEditing(null);
  }

  async function remove(id) {
    if (!window.confirm('Remover registro?')) return;
    await deleteOilLog(id);
    await loadLogs();
  }

  const stats = useMemo(() => {
    if (logs.length < 2) return null;
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const consumptions = [];
    for (let i = 1; i < sorted.length; i++) {
      const dh = sorted[i].hours_at_check - sorted[i-1].hours_at_check;
      if (dh > 0) consumptions.push(sorted[i-1].qt_added / dh);
    }
    if (!consumptions.length) return null;
    const avg = consumptions.reduce((s,v) => s+v, 0) / consumptions.length;
    const last = consumptions[consumptions.length - 1];
    const trend = consumptions.length >= 3
      ? ((consumptions.slice(-3).reduce((s,v)=>s+v,0)/3) - (consumptions.slice(0,3).reduce((s,v)=>s+v,0)/3))
      : 0;
    const totalAdded = logs.reduce((s,l) => s + (l.qt_added||0), 0);
    return { avg: avg.toFixed(2), last: last.toFixed(2), trend: trend.toFixed(2), totalAdded, consumptions };
  }, [logs]);

  if (!tableReady) return (
    <div style={{ padding:24 }}>
      <div style={{ padding:'20px 24px', background:'var(--amber-dim)', border:'1px solid var(--amber)', borderRadius:12, fontSize:13, color:'var(--amber)', lineHeight:1.7 }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>Tabela oil_logs não encontrada</div>
        Cole o SQL abaixo no Supabase SQL Editor e recarregue a página:
        <pre style={{ marginTop:10, padding:'10px 14px', background:'#0f1117', borderRadius:8, fontSize:11, color:'#e8eaf0', overflowX:'auto', userSelect:'all' }}>
{`create table oil_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references aircraft(id) on delete cascade,
  date date not null,
  hours_at_check numeric not null,
  qt_added numeric not null,
  qt_after numeric,
  notes text,
  created_at timestamptz default now()
);
alter table oil_logs enable row level security;
create policy "users_own_oil_logs" on oil_logs for all using (auth.uid() = user_id);
create index idx_oil_logs_aircraft on oil_logs(aircraft_id);`}
        </pre>
      </div>
    </div>
  );

  if (editing !== null) return (
    <div style={{ padding:24, maxWidth:540 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={cancel}>← Voltar</button>
        <div style={{ fontSize:16, fontWeight:700 }}>Registro de óleo</div>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Aeronave *</label>
              <select required value={form.aircraftId} onChange={e=>set('aircraftId',e.target.value)}>
                <option value="">Selecione...</option>
                {aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration}</option>)}
              </select>
            </div>
            <div><label>Data *</label>
              <input type="date" required value={form.date} onChange={e=>set('date',e.target.value)} />
            </div>
          </div>
          <div className="g3" style={{ marginBottom:14 }}>
            <div><label>Horímetro (h)</label>
              <input type="number" step="0.1" required value={form.hoursAtCheck} onChange={e=>set('hoursAtCheck',e.target.value)} placeholder="1240.5" />
            </div>
            <div><label>Qt. adicionada (qt)</label>
              <input type="number" step="0.1" required value={form.qtAdded} onChange={e=>set('qtAdded',e.target.value)} placeholder="1.0" />
            </div>
            <div><label>Nível após (qt)</label>
              <input type="number" step="0.1" value={form.qtAfter} onChange={e=>set('qtAfter',e.target.value)} placeholder="8" />
            </div>
          </div>
          <div><label>Observações</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Troca de óleo, marca do óleo, mecânico..." />
          </div>
        </div>
        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar registro</button>
          <button type="button" onClick={cancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Consumo de Óleo</div>
          <div style={{ color:'var(--text2)', fontSize:12, marginTop:2 }}>{logs.length} registro(s)</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {aircraft.length > 1 && (
            <select value={filterAc} onChange={e=>setFilterAc(e.target.value)} style={{ width:200 }}>
              <option value="">Todas as aeronaves</option>
              {aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration}</option>)}
            </select>
          )}
          {aircraft.length > 0 && <button className="primary" onClick={startNew}>+ Registrar óleo</button>}
        </div>
      </div>

      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Consumo médio', value:`${stats.avg} qt/h`, color:'var(--blue)', sub:'histórico completo' },
            { label:'Último intervalo', value:`${stats.last} qt/h`, color: parseFloat(stats.last) > parseFloat(stats.avg)*1.2 ? 'var(--red)' : 'var(--green)', sub: parseFloat(stats.last) > parseFloat(stats.avg)*1.2 ? '⚠ Acima da média' : 'Normal' },
            { label:'Tendência', value: parseFloat(stats.trend) > 0.01 ? `↑ +${stats.trend}` : parseFloat(stats.trend) < -0.01 ? `↓ ${stats.trend}` : '→ Estável', color: parseFloat(stats.trend) > 0.01 ? 'var(--amber)' : parseFloat(stats.trend) < -0.01 ? 'var(--green)' : 'var(--text2)', sub:'últimas 3 medições' },
            { label:'Total adicionado', value:`${stats.totalAdded.toFixed(1)} qt`, color:'var(--purple)', sub:'histórico completo' },
          ].map(s=>(
            <div key={s.label} className="card" style={{ padding:'14px 18px' }}>
              <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6, fontWeight:600 }}>{s.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:"'JetBrains Mono',monospace", marginBottom:2 }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {stats?.consumptions?.length >= 3 && (
        <div className="card" style={{ padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:16 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>Tendência de consumo (qt/h)</div>
            <Sparkline values={stats.consumptions} color={parseFloat(stats.trend) > 0.01 ? 'var(--amber)' : 'var(--green)'} />
          </div>
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>
            {parseFloat(stats.trend) > 0.05
              ? '⚠ Consumo em alta. Aumento acima de 20% em relação à linha de base sugere desgaste do motor — agende inspeção.'
              : parseFloat(stats.trend) < -0.02
              ? '✓ Consumo em queda. Motor funcionando bem.'
              : '✓ Consumo estável. Motor dentro dos parâmetros normais.'}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🛢</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Nenhum registro de óleo</div>
          <div style={{ fontSize:12, marginBottom:16 }}>Registre as adições de óleo a cada verificação para acompanhar a tendência de consumo do motor</div>
          {aircraft.length > 0 && <button className="primary" onClick={startNew}>Registrar primeiro</button>}
        </div>
      ) : (
        <div>
          {logs.map((log, i) => {
            const ac = aircraft.find(a => a.id === log.aircraft_id);
            const prev = logs[i+1];
            const consumption = prev && (log.hours_at_check - prev.hours_at_check) > 0
              ? (log.qt_added / (log.hours_at_check - prev.hours_at_check)).toFixed(2)
              : null;
            return (
              <div key={log.id} className="card" style={{ padding:'12px 18px', marginBottom:8, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background: consumption && parseFloat(consumption) > (parseFloat(stats?.avg||0)*1.2) ? 'var(--amber)' : 'var(--green)', flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{ac?.registration} — {new Date(log.date+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>
                    Horímetro: {log.hours_at_check}h · Adicionado: {log.qt_added} qt{log.qt_after ? ` · Nível após: ${log.qt_after} qt` : ''}
                    {consumption && <span style={{ color:'var(--blue)', marginLeft:8 }}>→ {consumption} qt/h</span>}
                  </div>
                  {log.notes && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{log.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>startEdit(log)}>Editar</button>
                  <button className="danger" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>remove(log.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
