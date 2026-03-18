import React, { useState, useEffect, useMemo } from 'react';
import { AcIcon, ArcGauge, ProgressBar } from './Instruments';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

const CAT_LABEL = { fuel:'Combustível', scheduled_mx:'MX prog.', unscheduled_mx:'MX corretiva', engine_reserve:'Reserva motor', insurance:'Seguro', hangar:'Hangar', crew:'Tripulação', airport_fees:'Taxas', nav_fees:'Navegação', other:'Outros' };
const BAR_HEX = ['#4d9de0','#3dbf8a','#e8a84a','#9b7fe8','#e05c5c','#3dc4c0'];

function fmtHM(min) {
  if (!min) return '0:00';
  return `${Math.floor(min/60)}:${String(min%60).padStart(2,'0')}`;
}

function EngineBar({ label, used, tbo, color }) {
  const pct = tbo > 0 ? Math.min(used / tbo, 1) : 0;
  const left = Math.max(0, tbo - used);
  const c = pct > .9 ? 'var(--red)' : pct > .75 ? 'var(--amber)' : color || 'var(--green)';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:5 }}>
        <span style={{ color:'var(--text2)', fontWeight:500 }}>{label}</span>
        <span style={{ fontFamily:'var(--font-mono)', color:c, fontSize:12 }}>
          {used.toFixed(0)}h <span style={{ color:'var(--text3)' }}>/ {tbo}h TBO</span>
        </span>
      </div>
      <div style={{ height:8, background:'var(--bg3)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${pct*100}%`, height:'100%', background:c, borderRadius:4, transition:'width .4s' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)', marginTop:3 }}>
        <span>{Math.round(pct*100)}% utilizado</span>
        <span style={{ color:c }}>{left.toFixed(0)}h restantes</span>
      </div>
    </div>
  );
}

export default function AircraftDetail({ ac, flights = [], costs = [], maintenance = [], crew = [], onBack, setPage }) {
  const [tab, setTab] = useState('overview');

  const acFlights = useMemo(() => flights.filter(f => f.aircraftId === ac.id).sort((a,b) => b.date.localeCompare(a.date)), [flights, ac.id]);
  const acCosts   = useMemo(() => costs.filter(c => c.aircraftId === ac.id), [costs, ac.id]);
  const acMx      = useMemo(() => maintenance.filter(m => m.aircraftId === ac.id).map(m => {
    const currentH = parseFloat(ac.baseAirframeHours||0) + parseFloat(ac.totalFlightHours||0);
    let status = m.status;
    if (m.nextDueHours) { const r = parseFloat(m.nextDueHours)-currentH; status = r<=0?'overdue':r<=20?'due_soon':'current'; }
    if (m.nextDueDate)  { const d = Math.ceil((new Date(m.nextDueDate)-new Date())/86400000); if(d<=0)status='overdue'; else if(d<=30&&status!=='overdue')status='due_soon'; }
    if (m.deferredUntilDate || m.deferredUntilHours) {
      const dateOk  = !m.deferredUntilDate  || new Date(m.deferredUntilDate) > new Date();
      const hoursOk = !m.deferredUntilHours || parseFloat(m.deferredUntilHours) > currentH;
      if (dateOk && hoursOk) status = 'deferred';
    }
    return { ...m, status };
  }).sort((a,b) => { const o={overdue:0,due_soon:1,deferred:2,current:3}; return (o[a.status]??3)-(o[b.status]??3); }), [maintenance, ac]);

  const totalHours = useMemo(() => acFlights.reduce((s,f)=>s+(f.flightTimeMinutes||0),0)/60, [acFlights]);
  const totalCost  = useMemo(() => acCosts.reduce((s,c)=>s+parseFloat(c.amountBrl||0),0), [acCosts]);
  const totalNm    = useMemo(() => acFlights.reduce((s,f)=>s+parseFloat(f.distanceNm||0),0), [acFlights]);
  const cph        = totalHours > 0 ? totalCost / totalHours : 0;

  // Monthly cost trend — last 6 months
  const monthlyTrend = useMemo(() => {
    const map = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0,7);
      const label = d.toLocaleDateString('pt-BR', { month:'short' });
      map[key] = { label, cost: 0, hours: 0 };
    }
    acCosts.forEach(c => { const k = (c.referenceDate||'').slice(0,7); if (map[k]) map[k].cost += parseFloat(c.amountBrl||0); });
    acFlights.forEach(f => { const k = f.date.slice(0,7); if (map[k]) map[k].hours += (f.flightTimeMinutes||0)/60; });
    return Object.values(map).map(v => ({ ...v, cost: Math.round(v.cost), hours: parseFloat(v.hours.toFixed(1)) }));
  }, [acCosts, acFlights]);

  // Cost by category
  const catData = useMemo(() => {
    const map = {};
    acCosts.forEach(c => { map[c.category] = (map[c.category]||0) + parseFloat(c.amountBrl||0); });
    return Object.entries(map).map(([k,v]) => ({ name: CAT_LABEL[k]||k, value: Math.round(v) })).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [acCosts]);

  const tboUsed = parseFloat(ac.totalEngineHours||0);
  const tboMax  = parseFloat(ac.engineTboHours||2000);
  const isMulti = ac.type === 'multi_engine';
  const cellTotal = parseFloat(ac.baseAirframeHours||0) + totalHours;

  const alertCount = acMx.filter(m => m.status === 'overdue' || m.status === 'due_soon').length;

  const sc = { overdue: { color:'var(--red)', bg:'var(--red-dim)', label:'VENCIDO' }, due_soon: { color:'var(--amber)', bg:'var(--amber-dim)', label:'PRÓXIMO' }, deferred: { color:'var(--purple)', bg:'var(--purple-dim)', label:'DIFERIDO' }, current: { color:'var(--green)', bg:'transparent', label:'Em dia' } };

  const TABS = [
    { id:'overview', label:'Visão geral' },
    { id:'engines',  label: isMulti ? 'Motores' : 'Motor' },
    { id:'mx',       label:`MX ${alertCount > 0 ? `(${alertCount})` : ''}` },
    { id:'flights',  label:'Voos' },
    { id:'costs',    label:'Custos' },
  ];

  return (
    <div style={{ padding:24, maxWidth:1000 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <button className="ghost" onClick={onBack} style={{ fontSize:12 }}>← Frota</button>
        <AcIcon type={ac.type} size={40} />
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:24, fontWeight:400 }}>{ac.registration}</div>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:1 }}>{ac.manufacturer} {ac.model} · {ac.year} · {ac.homeBase}</div>
        </div>
        {alertCount > 0 && (
          <div style={{ padding:'6px 12px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:12, color:'var(--amber)', fontWeight:500 }}>
            ⚠ {alertCount} alerta{alertCount>1?'s':''} MX
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg2)', borderRadius:10, padding:4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', background: tab===t.id?'var(--bg1)':'transparent', color: tab===t.id?'var(--text1)':'var(--text3)', boxShadow: tab===t.id?'0 1px 3px rgba(0,0,0,.15)':'' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Horas célula', value:`${cellTotal.toFixed(0)}h`, sub:`+${totalHours.toFixed(0)}h operadas` },
              { label:'Ciclos',       value:ac.totalCycles||0, sub:'pousos totais' },
              { label:'Custo / hora', value: cph>0?`R$ ${Math.round(cph).toLocaleString('pt-BR')}`:'—', sub:'histórico real' },
              { label:'Total de voos', value: acFlights.length, sub:`${Math.round(totalNm).toLocaleString('pt-BR')} nm voadas` },
            ].map(k => (
              <div key={k.label} style={{ padding:'14px 16px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:12 }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600, marginBottom:6 }}>{k.label}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:22, color:'var(--text1)', fontWeight:400 }}>{k.value}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div className="section-title">Custo mensal (R$)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyTrend} margin={{ top:4, right:4, bottom:0, left:0 }}>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text1)' }} formatter={v=>[`R$ ${v.toLocaleString('pt-BR')}`,'']} cursor={{ fill:'var(--bg3)' }} />
                  <Bar dataKey="cost" radius={[4,4,0,0]} fill="var(--blue)" fillOpacity={.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div className="section-title">Custo por categoria</div>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={catData} layout="vertical" margin={{ left:0, right:8, top:4, bottom:0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text1)' }} formatter={v=>[`R$ ${v.toLocaleString('pt-BR')}`,'']} cursor={{ fill:'var(--bg3)' }} />
                    <Bar dataKey="value" radius={[0,4,4,0]}>
                      {catData.map((_,i) => <Cell key={i} fill={BAR_HEX[i%BAR_HEX.length]} fillOpacity={.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', paddingTop:50 }}>Sem dados</div>}
            </div>
          </div>

          {/* Recent flights + top MX */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div className="section-title" style={{ margin:0 }}>Últimos voos</div>
                <button className="ghost" style={{ fontSize:11 }} onClick={() => setTab('flights')}>ver todos →</button>
              </div>
              {acFlights.slice(0,5).map(f => (
                <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{f.departureIcao} → {f.destinationIcao}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  </div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text2)' }}>{fmtHM(f.flightTimeMinutes)}</div>
                  <span className={`tag tag-${f.flightConditions==='ifr'?'ifr':'vfr'}`} style={{ fontSize:9 }}>{(f.flightConditions||'VFR').toUpperCase()}</span>
                </div>
              ))}
              {acFlights.length === 0 && <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', paddingTop:20 }}>Nenhum voo registrado</div>}
            </div>

            <div className="card" style={{ padding:'14px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div className="section-title" style={{ margin:0 }}>Manutenção</div>
                <button className="ghost" style={{ fontSize:11 }} onClick={() => setTab('mx')}>ver todos →</button>
              </div>
              {acMx.slice(0,5).map(m => {
                const s = sc[m.status] || sc.current;
                return (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                    <div style={{ flex:1, fontSize:12 }}>{m.name}</div>
                    <span style={{ fontSize:9, fontWeight:600, color:s.color, padding:'1px 6px', background:s.bg, borderRadius:6 }}>{s.label}</span>
                  </div>
                );
              })}
              {acMx.length === 0 && <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', paddingTop:20 }}>Sem itens de MX</div>}
            </div>
          </div>
        </>
      )}

      {/* ── ENGINES ──────────────────────────────────────── */}
      {tab === 'engines' && (
        <div style={{ display:'grid', gridTemplateColumns: isMulti ? '1fr 1fr' : '1fr', gap:16 }}>
          {/* Motor 1 / único */}
          <div className="card" style={{ padding:'18px 22px' }}>
            <div className="section-title">{isMulti ? 'Motor #1' : 'Motor'}</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:16, fontWeight:400, marginBottom:16, color:'var(--text2)' }}>{ac.engineModel || 'Modelo não informado'}</div>
            <EngineBar label="Horas motor" used={tboUsed} tbo={tboMax} />
            {ac.propModel && (
              <EngineBar label="Hélice" used={parseFloat(ac.totalEngineHours||0)} tbo={parseFloat(ac.propTboHours||2000)} color="var(--teal)" />
            )}
            <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { label:'Horas totais', value:`${tboUsed.toFixed(0)}h` },
                { label:'TBO', value:`${tboMax}h` },
                { label:'Restantes', value:`${Math.max(0,tboMax-tboUsed).toFixed(0)}h` },
                { label:'% Utilizado', value:`${Math.round(tboUsed/tboMax*100)}%` },
              ].map(s => (
                <div key={s.label} style={{ padding:'10px 12px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:16 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Motor 2 — só para bimotor */}
          {isMulti && (
            <div className="card" style={{ padding:'18px 22px' }}>
              <div className="section-title">Motor #2</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:16, fontWeight:400, marginBottom:16, color:'var(--text2)' }}>{ac.engineModel || 'Modelo não informado'}</div>
              <EngineBar label="Horas motor" used={tboUsed} tbo={tboMax} />
              {ac.propModel && (
                <EngineBar label="Hélice" used={parseFloat(ac.totalEngineHours||0)} tbo={parseFloat(ac.propTboHours||2000)} color="var(--teal)" />
              )}
              <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:'Horas totais', value:`${tboUsed.toFixed(0)}h` },
                  { label:'TBO', value:`${tboMax}h` },
                  { label:'Restantes', value:`${Math.max(0,tboMax-tboUsed).toFixed(0)}h` },
                  { label:'% Utilizado', value:`${Math.round(tboUsed/tboMax*100)}%` },
                ].map(s => (
                  <div key={s.label} style={{ padding:'10px 12px', background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:16 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APU — só para jatos e turboélices */}
          {ac.apuModel && (
            <div className="card" style={{ padding:'18px 22px', gridColumn: isMulti ? 'span 2' : 'span 1', border:'1px solid var(--amber-mid)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div className="section-title" style={{ margin:0 }}>APU</div>
                <span style={{ fontSize:10, color:'var(--amber)', background:'var(--amber-dim)', padding:'2px 8px', borderRadius:6, fontWeight:600 }}>Auxiliary Power Unit</span>
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:15, fontWeight:400, marginBottom:14, color:'var(--text2)' }}>{ac.apuModel}</div>
              {ac.apuTboHours && (
                <EngineBar label="Horas APU" used={parseFloat(ac.apuTotalHours||0)} tbo={parseFloat(ac.apuTboHours)} color="var(--amber)" />
              )}
              <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                {[
                  { label:'Horas totais', value:`${parseFloat(ac.apuTotalHours||0).toFixed(0)}h` },
                  { label:'TBO APU', value: ac.apuTboHours ? `${ac.apuTboHours}h` : 'N/A' },
                  { label:'Restantes', value: ac.apuTboHours ? `${Math.max(0, parseFloat(ac.apuTboHours) - parseFloat(ac.apuTotalHours||0)).toFixed(0)}h` : '—' },
                  { label:'Ciclos APU', value: ac.apuCycles || '—' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'10px 12px', background:'var(--amber-dim)', borderRadius:8, border:'1px solid var(--amber-mid)' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:16 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Célula */}
          <div className="card" style={{ padding:'18px 22px', gridColumn: isMulti ? 'span 2' : 'span 1' }}>
            <div className="section-title">Célula (Airframe)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                { label:'Horas base', value:`${parseFloat(ac.baseAirframeHours||0).toFixed(0)}h` },
                { label:'Horas operadas', value:`${totalHours.toFixed(0)}h` },
                { label:'Horas totais', value:`${cellTotal.toFixed(0)}h` },
                { label:'Ciclos totais', value:`${ac.totalCycles||0}` },
              ].map(s => (
                <div key={s.label} style={{ padding:'12px 14px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:20 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MAINTENANCE ──────────────────────────────────── */}
      {tab === 'mx' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Vencidos',  count: acMx.filter(m=>m.status==='overdue').length,  color:'var(--red)',   bg:'var(--red-dim)' },
              { label:'Próximos',  count: acMx.filter(m=>m.status==='due_soon').length,  color:'var(--amber)', bg:'var(--amber-dim)' },
              { label:'Diferidos', count: acMx.filter(m=>m.status==='deferred').length,  color:'var(--purple)',bg:'var(--purple-dim)' },
              { label:'Em dia',    count: acMx.filter(m=>m.status==='current').length,   color:'var(--green)', bg:'var(--green-dim)' },
            ].map(s => (
              <div key={s.label} style={{ padding:'12px 16px', background:s.bg, border:`1px solid ${s.color}44`, borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:28, color:s.color, fontWeight:400 }}>{s.count}</div>
                <div style={{ fontSize:11, color:s.color, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {acMx.map(m => {
            const s = sc[m.status] || sc.current;
            const currentH = parseFloat(ac.baseAirframeHours||0) + totalHours;
            const hLeft = m.nextDueHours ? parseFloat(m.nextDueHours) - currentH : null;
            const dLeft = m.nextDueDate ? Math.ceil((new Date(m.nextDueDate)-new Date())/86400000) : null;
            return (
              <div key={m.id} style={{ padding:'12px 16px', marginBottom:8, borderRadius:10, background:s.bg, border:`1px solid ${s.color}33`, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text1)' }}>{m.name}</div>
                  <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>
                    {m.itemType === 'overhaul' ? 'TBO' : m.itemType === 'inspection' ? 'Inspeção' : m.itemType === 'ad' ? 'AD' : 'Componente'}
                    {hLeft !== null && ` · ${hLeft > 0 ? `${hLeft.toFixed(0)}h restantes` : `${Math.abs(hLeft).toFixed(0)}h vencido`}`}
                    {dLeft !== null && ` · ${dLeft > 0 ? `${dLeft}d restantes` : `${Math.abs(dLeft)}d vencido`}`}
                  </div>
                </div>
                {m.estimatedCostBrl > 0 && (
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text2)' }}>
                    R$ {parseFloat(m.estimatedCostBrl).toLocaleString('pt-BR')}
                  </div>
                )}
                <span style={{ fontSize:9, fontWeight:700, color:s.color, padding:'2px 8px', background:s.bg, border:`1px solid ${s.color}55`, borderRadius:8 }}>{s.label}</span>
              </div>
            );
          })}
          {acMx.length === 0 && <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'40px 0' }}>Nenhum item de manutenção cadastrado</div>}
        </div>
      )}

      {/* ── FLIGHTS ──────────────────────────────────────── */}
      {tab === 'flights' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Total voos', value: acFlights.length },
              { label:'Horas totais', value: fmtHM(acFlights.reduce((s,f)=>s+(f.flightTimeMinutes||0),0)) },
              { label:'Noturno', value: fmtHM(acFlights.reduce((s,f)=>s+(f.flightTimeNight||0),0)) },
              { label:'IFR', value: fmtHM(acFlights.reduce((s,f)=>s+(f.flightTimeIfr||0),0)) },
            ].map(k => (
              <div key={k.label} style={{ padding:'12px 14px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:10 }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{k.label}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:20 }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflow:'hidden', padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'var(--bg2)' }}>
                {['Data','Rota','Total','Diurno','Noturno','IFR','Ciclos','Condição'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text3)', borderBottom:'1px solid var(--border)', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {acFlights.map(f => (
                  <tr key={f.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)', fontSize:11 }}>{new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding:'8px 12px', fontWeight:500 }}>{f.departureIcao} → {f.destinationIcao}</td>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)' }}>{fmtHM(f.flightTimeMinutes)}</td>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{fmtHM(f.flightTimeDay)}</td>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{fmtHM(f.flightTimeNight)}</td>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{fmtHM(f.flightTimeIfr)}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>{f.cycles||1}</td>
                    <td style={{ padding:'8px 12px' }}><span className={`tag tag-${f.flightConditions==='ifr'?'ifr':'vfr'}`} style={{ fontSize:9 }}>{(f.flightConditions||'VFR').toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {acFlights.length === 0 && <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'40px 0' }}>Nenhum voo registrado para esta aeronave</div>}
          </div>
        </div>
      )}

      {/* ── COSTS ────────────────────────────────────────── */}
      {tab === 'costs' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Total histórico', value:`R$ ${Math.round(totalCost).toLocaleString('pt-BR')}` },
              { label:'Custo / hora', value: cph>0?`R$ ${Math.round(cph).toLocaleString('pt-BR')}`:'—' },
              { label:'Custo / NM', value: totalNm>0?`R$ ${(totalCost/totalNm).toFixed(2)}`:'—' },
            ].map(k => (
              <div key={k.label} style={{ padding:'14px 16px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:10 }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{k.label}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:22, color:'var(--blue)' }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div className="section-title">Evolução mensal</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={monthlyTrend} margin={{ top:4, right:4, bottom:0, left:0 }}>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text1)' }} formatter={v=>[`R$ ${v.toLocaleString('pt-BR')}`,'']} />
                  <Line type="monotone" dataKey="cost" stroke="var(--blue)" strokeWidth={2} dot={{ r:3, fill:'var(--blue)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding:'14px 18px' }}>
              <div className="section-title">Por categoria</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={catData} layout="vertical" margin={{ left:0, right:8, top:4, bottom:0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={85} tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} formatter={v=>[`R$ ${v.toLocaleString('pt-BR')}`,'']} cursor={{ fill:'var(--bg3)' }} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {catData.map((_,i) => <Cell key={i} fill={BAR_HEX[i%BAR_HEX.length]} fillOpacity={.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ overflow:'hidden', padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'var(--bg2)' }}>
                {['Data','Categoria','Valor','Descrição','Fornecedor'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text3)', borderBottom:'1px solid var(--border)', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {acCosts.sort((a,b)=>(b.referenceDate||'').localeCompare(a.referenceDate||'')).slice(0,20).map(c => (
                  <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)', fontSize:11 }}>{c.referenceDate ? new Date(c.referenceDate+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td style={{ padding:'8px 12px' }}><span style={{ fontSize:11, color:'var(--blue)', fontWeight:500 }}>{CAT_LABEL[c.category]||c.category}</span></td>
                    <td style={{ padding:'8px 12px', fontFamily:'var(--font-mono)', color:'var(--blue)', fontWeight:500 }}>R$ {parseFloat(c.amountBrl||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    <td style={{ padding:'8px 12px', color:'var(--text2)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.description||'—'}</td>
                    <td style={{ padding:'8px 12px', color:'var(--text3)' }}>{c.vendor||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {acCosts.length === 0 && <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'40px 0' }}>Nenhum custo lançado para esta aeronave</div>}
          </div>
        </div>
      )}
    </div>
  );
}
