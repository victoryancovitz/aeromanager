import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const fmtBrl = v => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');

const OVERHAUL_ITEMS = [
  { id: 'engine1',   label: 'Motor #1',      defaultTbo: 2000, defaultCost: 400000 },
  { id: 'engine2',   label: 'Motor #2',      defaultTbo: 2000, defaultCost: 400000 },
  { id: 'prop1',     label: 'Hélice #1',     defaultTbo: 2000, defaultCost:  45000 },
  { id: 'prop2',     label: 'Hélice #2',     defaultTbo: 2000, defaultCost:  45000 },
  { id: 'apu',       label: 'APU',           defaultTbo:  500, defaultCost: 120000 },
  { id: 'landing',   label: 'Trem de pouso', defaultTbo: 6000, defaultCost: 200000 },
  { id: 'avionics',  label: 'Aviônica (rev)',defaultTbo: 8760, defaultCost:  80000 },
];

const COST_GROUPS = {
  direct_variable: { label: 'Direto variável',   color: '#4d9de0', desc: 'Varia com cada voo: combustível, taxas, handling' },
  direct_fixed:    { label: 'Direto fixo',        color: '#3dbf8a', desc: 'Associado à aeronave mas fixo: seguro, hangar' },
  indirect_op:     { label: 'Indireto operacional',color: '#e8a84a', desc: 'Suporte à operação: tripulação fixa, treinamento' },
  maintenance_prog:{ label: 'MX programada',      color: '#9b7fe8', desc: 'Inspeções, SBs, ADs programados' },
  maintenance_unp: { label: 'MX não programada',  color: '#e05c5c', desc: 'Reparos, AOG, componentes inesperados' },
  reserve_oh:      { label: 'Reserva overhaul',   color: '#f4a460', desc: 'Acumulação para TBO: motor, hélice, APU, trem' },
  admin:           { label: 'Administrativo',     color: '#888',    desc: 'Gestão, software, licenças, depreciação' },
};

export default function Pricing({ aircraft = [], costs = [], flights = [] }) {
  const [selectedAcId, setSelectedAcId] = useState(aircraft[0]?.id || '');
  const [tab, setTab] = useState('pricing');

  // Pricing inputs
  const [availableHours, setAvailableHours] = useState(300);
  const [margin, setMargin]                 = useState(20);
  const [deadheadPct, setDeadheadPct]       = useState(15);

  // Overhaul reserve inputs
  const [ohItems, setOhItems] = useState(() =>
    OVERHAUL_ITEMS.map(i => ({ ...i, tbo: i.defaultTbo, cost: i.defaultCost, active: i.id.startsWith('engine') || i.id === 'prop1' }))
  );

  const ac = aircraft.find(a => a.id === selectedAcId);
  const acFlights = useMemo(() => flights.filter(f => f.aircraftId === selectedAcId), [flights, selectedAcId]);
  const acCosts   = useMemo(() => costs.filter(c => c.aircraftId === selectedAcId), [costs, selectedAcId]);

  // Cost classification
  const costAnalysis = useMemo(() => {
    const CAT_MAP = {
      fuel: 'direct_variable', airport_fees: 'direct_variable', nav_fees: 'direct_variable',
      handling: 'direct_variable', catering: 'direct_variable', overflight: 'direct_variable',
      insurance: 'direct_fixed', hangar: 'direct_fixed',
      crew: 'indirect_op', crew_variable: 'direct_variable', training: 'indirect_op',
      scheduled_mx: 'maintenance_prog', avionics_mx: 'maintenance_prog', airframe_mx: 'maintenance_prog',
      unscheduled_mx: 'maintenance_unp',
      engine_reserve: 'reserve_oh', prop_reserve: 'reserve_oh', apu_reserve: 'reserve_oh',
      subscriptions: 'admin', licenses: 'admin', admin: 'admin', financing: 'admin', depreciation: 'admin',
      other: 'direct_variable',
    };
    const groups = {};
    Object.keys(COST_GROUPS).forEach(k => { groups[k] = 0; });
    acCosts.forEach(c => {
      const g = CAT_MAP[c.category] || 'direct_variable';
      groups[g] += parseFloat(c.amountBrl || 0);
    });
    return groups;
  }, [acCosts]);

  const totalCost = Object.values(costAnalysis).reduce((s, v) => s + v, 0);
  const totalHours = useMemo(() => acFlights.reduce((s, f) => s + (f.flightTimeMinutes || 0) / 60, 0), [acFlights]);
  const monthlyFixed = parseFloat(ac?.monthlyFixed || 0);

  // Pricing calculation
  const pricing = useMemo(() => {
    const annualFixed    = monthlyFixed * 12;
    const variablePerHr  = totalHours > 0 ? (costAnalysis.direct_variable + costAnalysis.maintenance_unp) / totalHours : 0;
    const fixedPerHr     = availableHours > 0 ? (annualFixed + costAnalysis.direct_fixed + costAnalysis.indirect_op + costAnalysis.admin + costAnalysis.maintenance_prog) / availableHours : 0;
    const ohPerHr        = ohItems.filter(i => i.active).reduce((s, i) => s + (i.cost / i.tbo), 0);
    const costPerHr      = variablePerHr + fixedPerHr + ohPerHr;
    const deadheadAdj    = costPerHr / (1 - deadheadPct / 100);
    const pricePerHr     = deadheadAdj * (1 + margin / 100);
    return { variablePerHr, fixedPerHr, ohPerHr, costPerHr, deadheadAdj, pricePerHr };
  }, [costAnalysis, monthlyFixed, totalHours, availableHours, margin, deadheadPct, ohItems]);

  // Overhaul reserve per hour
  const ohReservePerHr = ohItems.filter(i => i.active).reduce((s, i) => s + i.cost / i.tbo, 0);

  const pieData = Object.entries(COST_GROUPS)
    .map(([k, g]) => ({ name: g.label, value: Math.round(costAnalysis[k] || 0), color: g.color }))
    .filter(d => d.value > 0);

  const barData = Object.entries(COST_GROUPS).map(([k, g]) => ({
    name: g.label.split(' ').slice(0, 2).join(' '),
    value: Math.round(costAnalysis[k] || 0),
    color: g.color,
  })).filter(d => d.value > 0);

  const TABS = [
    { id: 'pricing',  label: 'Precificação' },
    { id: 'reserves', label: 'Reservas Overhaul' },
    { id: 'analysis', label: 'Análise de custos' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 4 }}>Precificação & Custos</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Precificação de fretamento, reservas de overhaul e classificação completa de custos.</div>

      {/* Aircraft selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Aeronave:</label>
        <select value={selectedAcId} onChange={e => setSelectedAcId(e.target.value)} style={{ minWidth: 200 }}>
          {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: tab === t.id ? 'var(--bg1)' : 'transparent', color: tab === t.id ? 'var(--text1)' : 'var(--text3)', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,.15)' : '' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PRECIFICAÇÃO ──────────────────────────────────── */}
      {tab === 'pricing' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Parâmetros operacionais</div>
              <div style={{ marginBottom: 12 }}>
                <label>Horas disponíveis/ano para frete</label>
                <input type="number" value={availableHours} onChange={e => setAvailableHours(parseInt(e.target.value) || 1)} min={1} max={2000} />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Horas que a aeronave estará disponível para vender. Mais horas = menor custo fixo por hora.</div>
              </div>
              <div className="g2">
                <div>
                  <label>Margem de lucro (%)</label>
                  <input type="number" value={margin} onChange={e => setMargin(parseInt(e.target.value) || 0)} min={0} max={100} />
                </div>
                <div>
                  <label>Deadhead / posicionamento (%)</label>
                  <input type="number" value={deadheadPct} onChange={e => setDeadheadPct(parseInt(e.target.value) || 0)} min={0} max={50} />
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>% dos voos sem receita para posicionamento</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Resumo de custos históricos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Total histórico', value: fmtBrl(totalCost), color: 'var(--text1)' },
                  { label: 'Horas operadas', value: `${totalHours.toFixed(0)}h`, color: 'var(--text1)' },
                  { label: 'Custo real / hora', value: totalHours > 0 ? fmtBrl(totalCost / totalHours) : '—', color: 'var(--blue)' },
                  { label: 'Fixo mensal cadastrado', value: fmtBrl(monthlyFixed), color: 'var(--amber)' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing result */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <div style={{ padding: '18px 20px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, borderTop: '3px solid var(--blue)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Custo direto / hora</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--blue)', marginBottom: 4 }}>{fmtBrl(pricing.variablePerHr)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Combustível, taxas, handling — varia por voo</div>
            </div>
            <div style={{ padding: '18px 20px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, borderTop: '3px solid var(--green)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Custo fixo rateado / hora</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--green)', marginBottom: 4 }}>{fmtBrl(pricing.fixedPerHr)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Hangar, seguro, tripulação, admin ÷ {availableHours}h</div>
            </div>
            <div style={{ padding: '18px 20px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, borderTop: '3px solid var(--amber)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Reserva overhaul / hora</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--amber)', marginBottom: 4 }}>{fmtBrl(pricing.ohPerHr)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>TBO motor, hélice, APU, trem de pouso</div>
            </div>
          </div>

          <div style={{ padding: '20px 24px', background: 'var(--blue-dim)', border: '2px solid var(--blue-mid)', borderRadius: 14, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Custo total / hora</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--blue)' }}>{fmtBrl(pricing.costPerHr)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Após deadhead ({deadheadPct}%)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--blue)' }}>{fmtBrl(pricing.deadheadAdj)}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--blue-mid)', paddingLeft: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Preço sugerido / hora</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: 'var(--blue)', fontWeight: 500 }}>{fmtBrl(pricing.pricePerHr)}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>com {margin}% de margem</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Ponto de equilíbrio</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--blue)' }}>{availableHours}h/ano</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>para cobrir todos os fixos</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── RESERVAS OVERHAUL ─────────────────────────────── */}
      {tab === 'reserves' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
            Para cada componente com vida útil, defina o TBO e o custo estimado do overhaul. O sistema calcula quanto você deve reservar por hora de voo.
          </div>
          <div className="card" style={{ overflow: 'hidden', padding: 0, marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['Ativo', 'Componente', 'TBO (horas)', 'Custo overhaul (R$)', 'Reserva / hora', 'Horas atuais', 'Reserva acumulada'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ohItems.map((item, i) => {
                  const reservePerHr = item.tbo > 0 ? item.cost / item.tbo : 0;
                  const currentHours = parseFloat(ac?.totalEngineHours || 0);
                  const accumulated  = reservePerHr * currentHours;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.active ? 1 : 0.4 }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={item.active} onChange={e => setOhItems(prev => prev.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.label}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={item.tbo} onChange={e => setOhItems(prev => prev.map((x, j) => j === i ? { ...x, tbo: parseInt(e.target.value) || 0 } : x))} style={{ width: 100, padding: '4px 8px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={item.cost} onChange={e => setOhItems(prev => prev.map((x, j) => j === i ? { ...x, cost: parseInt(e.target.value) || 0 } : x))} style={{ width: 130, padding: '4px 8px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--amber)', fontWeight: 600 }}>{fmtBrl(reservePerHr)}/h</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{currentHours.toFixed(0)}h</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{fmtBrl(accumulated)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)' }}>
                  <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12 }}>Total ativo</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--amber)', fontWeight: 700 }}>{fmtBrl(ohReservePerHr)}/h</td>
                  <td></td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700 }}>
                    {fmtBrl(ohItems.filter(i => i.active).reduce((s, i) => s + (i.cost / i.tbo) * parseFloat(ac?.totalEngineHours || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--amber-dim)', border: '1px solid var(--amber-mid)', borderRadius: 12, fontSize: 12, color: 'var(--amber)' }}>
            <strong>Importante:</strong> A reserva acumulada é um valor contábil — representa o quanto deveria estar separado. Para efetivamente reservar, crie lançamentos de custo na categoria "Reserva Motor (TBO)" / "Reserva Hélice (TBO)" a cada hora voada.
          </div>
        </>
      )}

      {/* ── ANÁLISE DE CUSTOS ─────────────────────────────── */}
      {tab === 'analysis' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Distribuição por tipo</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => [fmtBrl(v), '']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Por grupo (R$)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => [fmtBrl(v), '']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} cursor={{ fill: 'var(--bg3)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['Classificação', 'Descrição', 'Total (R$)', '% do total', 'R$/hora'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(COST_GROUPS).map(([k, g]) => {
                  const val = costAnalysis[k] || 0;
                  const pct = totalCost > 0 ? (val / totalCost * 100) : 0;
                  const cph = totalHours > 0 ? val / totalHours : 0;
                  return (
                    <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{g.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text2)', fontSize: 11 }}>{g.desc}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', color: val > 0 ? 'var(--text1)' : 'var(--text3)', fontWeight: val > 0 ? 500 : 400 }}>{fmtBrl(val)}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: g.color, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', minWidth: 32 }}>{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)', fontSize: 11 }}>{cph > 0 ? fmtBrl(cph) : '—'}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)' }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 600 }}>Total</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--blue)' }}>{fmtBrl(totalCost)}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>100%</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--blue)', fontWeight: 600 }}>{totalHours > 0 ? fmtBrl(totalCost / totalHours) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
