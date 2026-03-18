import React, { useMemo } from 'react';
import { ArcGauge, KpiCard, ProgressBar, AcIcon } from './Instruments';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ComposedChart, Area } from 'recharts';

const CAT_LABEL = { fuel:'Combustível', scheduled_mx:'Manut. prog.', unscheduled_mx:'Manut. corretiva', engine_reserve:'Reserva motor', prop_reserve:'Reserva hélice', insurance:'Seguro', hangar:'Hangar', crew:'Tripulação', airport_fees:'Taxas aeroporto', nav_fees:'Taxas navegação', subscriptions:'Assinaturas', licenses:'Licenças', admin:'Admin', other:'Outros' };
const BAR_COLORS = ['var(--blue)','var(--green)','var(--amber)','var(--purple)','var(--red)','var(--teal)'];
const BAR_HEX = ['#6b9fd4','#7ab89a','#c4945a','#9b8cc4','#c47070','#6aadaa'];

import { Tip } from '../App';
export default function Dashboard({ aircraft = [], flights = [], costs = [], maintenance = [], setPage, onAircraftClick }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);

  // 12-month trend
  const monthlyTrend = useMemo(() => {
    const map = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      map[key] = { label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), cost: 0, hours: 0 };
    }
    costs.filter(c => !c.excludeFromStats).forEach(c => { const k = (c.referenceDate || '').slice(0, 7); if (map[k]) map[k].cost += parseFloat(c.amountBrl || 0); });
    flights.forEach(f => { const k = f.date.slice(0, 7); if (map[k]) map[k].hours += (f.flightTimeMinutes || 0) / 60; });
    return Object.values(map).map(v => ({ ...v, cost: Math.round(v.cost), hours: parseFloat(v.hours.toFixed(1)), cph: v.hours > 0 ? Math.round(v.cost / v.hours) : 0 }));
  }, [costs, flights]);

  const stats = useMemo(() => {
    const mFlights = flights.filter(f => f.date >= monthStart);
    const mCosts   = costs.filter(c => c.referenceDate >= monthStart);
    const totalCost  = mCosts.filter(c => !c.excludeFromStats).reduce((s,c) => s + parseFloat(c.amountBrl||0), 0);
    const totalMins  = mFlights.reduce((s,f) => s + (f.flightTimeMinutes||0), 0);
    const totalHours = totalMins / 60;
    const totalNm    = mFlights.reduce((s,f) => s + parseFloat(f.distanceNm||0), 0);
    const byCat = {};
    const statCosts = costs.filter(c => !c.excludeFromStats);
    statCosts.forEach(c => { byCat[c.category] = (byCat[c.category]||0) + parseFloat(c.amountBrl||0); });
    const catData = Object.entries(byCat).map(([k,v]) => ({ name: CAT_LABEL[k]||k, value: Math.round(v) })).sort((a,b) => b.value-a.value).slice(0,6);
    const alerts = maintenance.filter(m => m.status==='due_soon'||m.status==='overdue');
    return {
      totalCost, totalHours, totalNm,
      costPerHour: totalHours > 0 ? totalCost / totalHours : 0,
      costPerNm:   totalNm   > 0 ? totalCost / totalNm   : 0,
      flightCount: mFlights.length,
      launchCount: mCosts.length,
      catData, alerts,
    };
  }, [flights, costs, maintenance, monthStart]);

  const recent = [...flights].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);

  const t = {
    sub: { fontSize:11, color:'var(--text3)', fontWeight:300 },
    mono: { fontFamily:'var(--font-mono)', fontWeight:400 },
    border: { borderBottom:'1px solid var(--border)' },
  };

  return (
    <div style={{ padding:24, maxWidth:1100 }}>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <div className="alert alert-warn" style={{ marginBottom:20, cursor:'pointer' }} onClick={() => setPage('maintenance')}>
          <span>⚠</span>
          <span><strong>{stats.alerts.length} item(ns)</strong> de manutenção precisam de atenção — {stats.alerts.map(a=>a.name).join(', ')}</span>
          <span style={{ marginLeft:'auto', fontSize:11 }}>Ver →</span>
        </div>
      )}

      {/* Aircraft cards */}
      {aircraft.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div className="section-title">Status das aeronaves</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            {aircraft.map(ac => {
              const tboUsed = parseFloat(ac.totalEngineHours)||0;
              const tboMax  = parseFloat(ac.engineTboHours)||2000;
              const acFlights = flights.filter(f => f.aircraftId===ac.id);
              const acCosts   = costs.filter(c => c.aircraftId===ac.id);
              const acHours   = acFlights.reduce((s,f)=>s+(f.flightTimeMinutes||0),0)/60;
              const acTotal   = acCosts.reduce((s,c)=>s+parseFloat(c.amountBrl||0),0);
              const acCph     = acHours > 0 ? Math.round(acTotal/acHours) : 0;
              const acAlerts  = maintenance.filter(m=>m.aircraftId===ac.id&&(m.status==='due_soon'||m.status==='overdue'));
              const tboRatio  = tboUsed/tboMax;
              const tboColor  = tboRatio > .9 ? 'var(--red)' : tboRatio > .75 ? 'var(--amber)' : 'var(--green)';
              const tboLeft   = Math.max(0, tboMax-tboUsed).toFixed(0);
              const cellTotal = parseFloat(ac.baseAirframeHours||0) + acHours;

              return (
                <div key={ac.id} className="card" style={{ padding:'18px 20px', cursor: onAircraftClick ? 'pointer' : 'default', transition:'box-shadow .15s' }}
                  onClick={() => onAircraftClick && onAircraftClick(ac)}
                  onMouseEnter={e => onAircraftClick && (e.currentTarget.style.boxShadow='0 0 0 2px var(--blue-mid)')}
                  onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
                >
                  {/* Header */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                    <AcIcon type={ac.type} size={38} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'var(--font-serif)', fontSize:17, fontWeight:400, color:'var(--text1)' }}>{ac.registration}</div>
                      <div style={{ ...t.sub, marginTop:1 }}>{ac.manufacturer} {ac.model}</div>
                    </div>
                    <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                      <div className={`dot dot-${acAlerts.length>0?(acAlerts.some(a=>a.status==='overdue')?'red':'amber'):'green'}`} />
                      <span style={{ fontSize:10, color:'var(--text3)', fontWeight:500 }}>
                        {acAlerts.length>0?`${acAlerts.length} alerta${acAlerts.length>1?'s':''}` : 'OK'}
                      </span>
                    </div>
                  </div>

                  {/* Gauges */}
                  <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16, padding:'12px 0', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
                    <ArcGauge value={cellTotal.toFixed(1)} max={Math.max(2000,cellTotal+200)} label="Célula" unit="h" tooltip="Horas totais da célula (airframe) — tempo acumulado de voo da estrutura da aeronave." color="var(--blue)" size={86} />
                    <ArcGauge value={tboUsed.toFixed(1)} max={tboMax} label="Motor" unit="h" tooltip="Horas do motor (TSO — Time Since Overhaul). Usado para calcular quanto resta até o próximo TBO." color={tboColor} warning={.75} danger={.9} size={86} />
                    <ArcGauge value={ac.totalCycles||0} max={Math.max(2000,(ac.totalCycles||0)+200)} label="Ciclos" unit="ldg" tooltip="Ciclos de pouso e decolagem. Componentes com vida limitada por ciclos (LLP) precisam ser substituídos ao atingir o limite." color="var(--purple)" size={86} />
                  </div>

                  {/* Stats row */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div style={{ padding:'10px 12px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:500, marginBottom:4 }}><Tip text="Custo total da aeronave ÷ horas voadas. Inclui combustível, manutenção e custos fixos proporcionais. Exclui valor de aquisição.">Custo / hora</Tip></div>
                      <div style={{ ...t.mono, fontSize:15, color: acCph>0?'var(--blue)':'var(--text3)' }}>
                        {acCph > 0 ? `R$ ${acCph.toLocaleString('pt-BR')}` : '—'}
                      </div>
                    </div>
                    <div style={{ padding:'10px 12px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:500, marginBottom:4 }}><Tip text="TBO (Time Between Overhaul) — horas máximas entre revisões gerais do motor. Ao chegar a zero, manutenção obrigatória.">TBO restante</Tip></div>
                      <div style={{ ...t.mono, fontSize:15, color:tboColor }}>
                        {ac.engineTboHours ? `${tboLeft}h` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* TBO progress */}
                  {ac.engineTboHours && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', ...t.sub, marginBottom:5 }}>
                        <span><Tip text="Percentual de vida útil do motor já consumido (horas TSO ÷ TBO). Verde: confortável. Âmbar: planejar revisão. Vermelho: revisão iminente.">TBO do motor</Tip></span>
                        <span style={{ color:tboColor, fontWeight:500 }}>{Math.round(tboRatio*100)}%</span>
                      </div>
                      <ProgressBar value={tboUsed} max={tboMax} color={tboColor} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ marginBottom:24 }}>
        <div className="section-title">
          Mês atual — {now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}
        </div>
        <div className="g4">
          {[
            { label:'Custo total',   value: `R$ ${Math.round(stats.totalCost).toLocaleString('pt-BR')}`, sub:`${stats.launchCount} lançamento${stats.launchCount!==1?'s':''}`, color:'var(--blue)',   page:'costs',   tooltip:'Total de custos lançados no mês. Não inclui custos de aquisição. Clique para ver os lançamentos.' },
            { label:'Horas voadas',  value: `${stats.totalHours.toFixed(1)}h`, sub:`${stats.flightCount} voo${stats.flightCount!==1?'s':''}`, color:'var(--green)', page:'flights', tooltip:'Total de horas voadas no mês. Clique para ver os voos.' },
            { label:'Custo / hora',  value: stats.costPerHour>0 ? `R$ ${Math.round(stats.costPerHour)}` : '—', sub:'Custo real calculado', color:'var(--amber)',  page:'costs',   tooltip:'Custo total ÷ horas voadas. Mede o custo real por hora de voo. Exclui o valor de aquisição da aeronave. Clique para ver custos.' },
            { label:'Custo / NM',    value: stats.costPerNm>0 ? `R$ ${stats.costPerNm.toFixed(1)}` : '—', sub:`${Math.round(stats.totalNm)} nm voadas`, color:'var(--purple)', page:'flights', tooltip:'Custo total ÷ milhas náuticas voadas. Clique para ver voos.' },
          ].map(k => (
            <div key={k.label}
              onClick={() => k.page && setPage(k.page)}
              title={k.tooltip}
              style={{ padding:'16px 18px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:14, borderTop:`3px solid ${k.color}`, cursor: k.page ? 'pointer' : 'default', transition:'box-shadow .15s' }}
              onMouseEnter={e => { if(k.page) e.currentTarget.style.boxShadow='0 0 0 2px '+k.color+'44'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; }}>
              <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.1em', fontWeight:500, marginBottom:8, display:'flex', alignItems:'center', gap:4 }}>
                {k.label}
                {k.tooltip && <span style={{ fontSize:9, color:'var(--text3)', background:'var(--bg3)', borderRadius:'50%', width:14, height:14, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'help' }}>?</span>}
              </div>
              <div style={{ ...t.mono, fontSize:22, color:k.color, marginBottom:4 }}>{k.value}</div>
              <div style={{ ...t.sub }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 12-month trend */}
      {monthlyTrend.some(m => m.cost > 0 || m.hours > 0) && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div className="section-title" style={{ margin:0 }}>Evolução 12 meses</div>
            <div style={{ display:'flex', gap:16, fontSize:10 }}>
              <span style={{ color:'#6b9fd4' }}>■ Custo (R$)</span>
              <span style={{ color:'#7ab89a' }}>■ Horas voadas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={monthlyTrend} margin={{ top:4, right:20, bottom:0, left:0 }}>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cost" hide />
              <YAxis yAxisId="hours" orientation="right" hide />
              <Tooltip
                contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text1)' }}
                formatter={(v, n) => n === 'cost' ? [`R$ ${v.toLocaleString('pt-BR')}`, 'Custo'] : [`${v}h`, 'Horas']}
              />
              <Area yAxisId="cost" type="monotone" dataKey="cost" fill="#6b9fd433" stroke="#6b9fd4" strokeWidth={2} dot={false} />
              <Bar yAxisId="hours" dataKey="hours" fill="#7ab89a" fillOpacity={0.6} radius={[3,3,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart + Recent flights */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        <div className="card" style={{ padding:'16px 20px' }}>
          <div className="section-title" style={{display:'flex',alignItems:'center',gap:6}}>Custo por categoria (total) <span style={{fontSize:10,color:'var(--text3)',background:'var(--bg3)',borderRadius:'50%',width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'help'}} title="Total acumulado de todos os lançamentos de custo por categoria. Clique nas barras para ir para Custos.">?</span></div>
          {stats.catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.catData} layout="vertical" margin={{ left:0, right:10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize:11, fill:'var(--text3)', fontFamily:'var(--font-body)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, fontSize:12, color:'var(--text1)', fontFamily:'var(--font-body)' }}
                  formatter={v=>[`R$ ${v.toLocaleString('pt-BR')}`, '']}
                  cursor={{ fill:'var(--bg3)' }}
                />
                <Bar dataKey="value" radius={[0,4,4,0]} cursor="pointer"
                  onClick={(data) => setPage && setPage('costs')}>
                  {stats.catData.map((_,i) => <Cell key={i} fill={BAR_HEX[i % BAR_HEX.length]} fillOpacity={.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ ...t.sub, textAlign:'center', padding:'50px 0' }}>Nenhum custo lançado ainda</div>
          )}
        </div>

        <div className="card" style={{ padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div className="section-title" style={{ margin:0 }}>Últimos voos</div>
            <button className="ghost" style={{ fontSize:11 }} onClick={()=>setPage('flights')}>ver todos →</button>
          </div>
          {recent.length === 0 ? (
            <div style={{ ...t.sub, textAlign:'center', padding:'30px 0' }}>Nenhum voo registrado</div>
          ) : recent.map(f => {
            const ac = aircraft.find(a=>a.id===f.aircraftId);
            const h  = Math.floor((f.flightTimeMinutes||0)/60);
            const m  = (f.flightTimeMinutes||0)%60;
            const flightCost = costs.filter(c=>c.flightId===f.id).reduce((s,c)=>s+parseFloat(c.amountBrl||0),0);
            return (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', ...t.border }}>
                <AcIcon type={ac?.type} size={26} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:400, color:'var(--text1)' }}>{f.departureIcao} → {f.destinationIcao}</div>
                  <div style={{ ...t.sub, marginTop:1 }}>
                    {new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR')} · {h}h{m.toString().padStart(2,'0')}min
                  </div>
                </div>
                {flightCost > 0 && (
                  <div style={{ ...t.mono, fontSize:12, color:'var(--blue)' }}>
                    R$ {flightCost.toLocaleString('pt-BR')}
                  </div>
                )}
                <span className={`tag tag-${ac?.type==='single_engine'?'mono':ac?.type==='multi_engine'?'bi':'exp'}`} style={{ fontSize:10 }}>
                  {ac?.registration||'?'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {aircraft.length === 0 && (
        <div className="card" style={{ padding:'60px 20px', textAlign:'center' }}>
          <div style={{ fontSize:42, marginBottom:14, opacity:.5 }}>✈</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:20, fontWeight:400, marginBottom:8, color:'var(--text1)' }}>Bem-vindo ao AeroManager</div>
          <div style={{ ...t.sub, fontSize:13, marginBottom:24 }}>Cadastre sua primeira aeronave para começar</div>
          <button className="primary" onClick={()=>setPage('aircraft')}>Cadastrar aeronave</button>
        </div>
      )}
    </div>
  );
}
