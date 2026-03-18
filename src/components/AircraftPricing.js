import React, { useState, useEffect, useMemo } from 'react';
import { getFlights, getCosts, getAircraft } from '../store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

function fmtBrl(v, decimals = 0) {
  return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const COST_GROUPS = {
  direct_variable: { label: 'Direto variável',  color: '#4d9de0', desc: 'Combustível, taxas, handling, catering' },
  maintenance:     { label: 'Manutenção',        color: '#e8a84a', desc: 'MX programada, corretiva, reservas TBO' },
  fixed:           { label: 'Fixo operacional',  color: '#3dbf8a', desc: 'Seguro, hangar, tripulação fixa, treinamento' },
  admin:           { label: 'Administrativo',    color: '#9b7fe8', desc: 'Licenças, software, financiamento, depreciação' },
};

const CAT_TO_GROUP = {
  fuel:'direct_variable', airport_fees:'direct_variable', nav_fees:'direct_variable',
  handling:'direct_variable', catering:'direct_variable', overflight:'direct_variable',
  scheduled_mx:'maintenance', unscheduled_mx:'maintenance', engine_reserve:'maintenance',
  prop_reserve:'maintenance', apu_reserve:'maintenance', avionics_mx:'maintenance', airframe_mx:'maintenance',
  insurance:'fixed', hangar:'fixed', crew:'fixed', crew_variable:'fixed', training:'fixed',
  subscriptions:'admin', licenses:'admin', admin:'admin', financing:'admin', depreciation:'admin',
  other:'direct_variable',
};

export default function AircraftPricing({ aircraft = [] }) {
  const [selectedId, setSelectedId] = useState(aircraft[0]?.id || '');
  const [flights, setFlights]       = useState([]);
  const [costs, setCosts]           = useState([]);
  const [loading, setLoading]       = useState(true);

  // Pricing inputs
  const [targetHours, setTargetHours]   = useState(100);   // disponível/mês
  const [margin, setMargin]             = useState(20);     // % lucro
  const [occupancy, setOccupancy]       = useState(70);    // % taxa ocupação
  const [charterHours, setCharterHours] = useState(50);    // horas charteradas/mês

  useEffect(() => {
    Promise.all([getFlights(), getCosts()]).then(([fl, co]) => {
      setFlights(fl); setCosts(co); setLoading(false);
    });
  }, []);

  const ac = aircraft.find(a => a.id === selectedId);

  // Cost breakdown by group
  const costBreakdown = useMemo(() => {
    if (!selectedId) return {};
    const acCosts = costs.filter(c => c.aircraftId === selectedId);
    const acFlights = flights.filter(f => f.aircraftId === selectedId);
    const totalHours = acFlights.reduce((s, f) => s + (f.flightTimeMinutes || 0), 0) / 60 || 1;

    const byGroup = { direct_variable: 0, maintenance: 0, fixed: 0, admin: 0 };
    acCosts.forEach(c => {
      const g = CAT_TO_GROUP[c.category] || 'direct_variable';
      byGroup[g] = (byGroup[g] || 0) + parseFloat(c.amountBrl || 0);
    });

    const totalCost = Object.values(byGroup).reduce((s, v) => s + v, 0);
    const cph = totalHours > 0 ? totalCost / totalHours : 0;

    // Per-hour breakdown
    const perHour = {};
    Object.entries(byGroup).forEach(([k, v]) => { perHour[k] = totalHours > 0 ? v / totalHours : 0; });

    return { byGroup, totalCost, totalHours, cph, perHour };
  }, [costs, flights, selectedId]);

  // Pricing calculation
  const pricing = useMemo(() => {
    const { cph = 0, perHour = {} } = costBreakdown;
    if (cph === 0) return null;

    const directVar  = perHour.direct_variable || 0;
    const mxPh       = perHour.maintenance || 0;
    const fixedPh    = perHour.fixed || 0;
    const adminPh    = perHour.admin || 0;

    // Fixed costs distributed by available hours
    const fixedMonthly = (fixedPh + adminPh) * targetHours;
    const fixedPerCharterHour = charterHours > 0 ? fixedMonthly / charterHours : 0;

    // Variable per hour
    const variablePerHour = directVar + mxPh;

    // Total cost per charter hour
    const costPerCharterHour = variablePerHour + fixedPerCharterHour;

    // Pricing with margin
    const pricePerHour = costPerCharterHour * (1 + margin / 100);

    // Break-even analysis
    const breakEvenHours = fixedMonthly / (pricePerHour - variablePerHour);

    // Monthly projections
    const monthlyRevenue = charterHours * pricePerHour * (occupancy / 100);
    const monthlyCost    = (variablePerHour * charterHours * (occupancy / 100)) + fixedMonthly;
    const monthlyProfit  = monthlyRevenue - monthlyCost;

    // Overhaul/TBO reserve
    const tboHours = parseFloat(ac?.engineTboHours || 2000);
    const ovhCost  = tboHours * (mxPh + perHour.direct_variable * 0.1); // rough estimate

    // Break-even curve (varying charter hours 10-200)
    const breakEvenCurve = [];
    for (let h = 10; h <= 200; h += 10) {
      const rev  = h * pricePerHour * (occupancy / 100);
      const cost = (variablePerHour * h * (occupancy / 100)) + fixedMonthly;
      breakEvenCurve.push({ hours: h, revenue: Math.round(rev), cost: Math.round(cost), profit: Math.round(rev - cost) });
    }

    return {
      directVar, mxPh, fixedPh, adminPh,
      fixedMonthly, fixedPerCharterHour,
      variablePerHour, costPerCharterHour,
      pricePerHour, breakEvenHours,
      monthlyRevenue, monthlyCost, monthlyProfit,
      ovhCost, breakEvenCurve,
    };
  }, [costBreakdown, targetHours, margin, occupancy, charterHours, ac]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Carregando...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 4 }}>Precificação de Aeronave</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
        Calculadora de charter, break-even e reserva de overhaul com base nos custos reais registrados.
      </div>

      {/* Aircraft selector */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          <div>
            <label>Aeronave</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Selecionar...</option>
              {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
            </select>
          </div>
          <div>
            <label>Horas disponíveis/mês</label>
            <input type="number" value={targetHours} onChange={e => setTargetHours(parseInt(e.target.value) || 1)} min={1} max={720} />
          </div>
          <div>
            <label>Horas charteradas/mês</label>
            <input type="number" value={charterHours} onChange={e => setCharterHours(parseInt(e.target.value) || 1)} min={1} />
          </div>
          <div>
            <label>Taxa de ocupação (%)</label>
            <input type="number" value={occupancy} onChange={e => setOccupancy(Math.min(100, parseInt(e.target.value) || 0))} min={0} max={100} />
          </div>
          <div>
            <label>Margem de lucro (%)</label>
            <input type="number" value={margin} onChange={e => setMargin(parseInt(e.target.value) || 0)} min={0} max={200} />
          </div>
        </div>
      </div>

      {!selectedId || !pricing ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>💰</div>
          <div>Selecione uma aeronave com custos registrados para calcular a precificação</div>
        </div>
      ) : (
        <>
          {/* Cost breakdown KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {Object.entries(COST_GROUPS).map(([k, g]) => (
              <div key={k} style={{ padding: '12px 14px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, borderTop: `3px solid ${g.color}` }}>
                <div style={{ fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>{g.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: g.color }}>
                  {fmtBrl(pricing[k === 'direct_variable' ? 'directVar' : k === 'maintenance' ? 'mxPh' : k === 'fixed' ? 'fixedPh' : 'adminPh'])}/h
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{g.desc}</div>
              </div>
            ))}
          </div>

          {/* Pricing cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '18px 20px', background: 'var(--bg1)', border: '2px solid var(--blue-mid)', borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Preço de charter recomendado</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: 'var(--blue)' }}>{fmtBrl(pricing.pricePerHour)}/h</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Custo: {fmtBrl(pricing.costPerCharterHour)}/h + {margin}% margem
              </div>
            </div>
            <div style={{ padding: '18px 20px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Break-even mensal</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: pricing.monthlyProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pricing.breakEvenHours.toFixed(1)}h
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>mínimo de horas para cobrir custos fixos</div>
            </div>
            <div style={{ padding: '18px 20px', background: pricing.monthlyProfit >= 0 ? 'var(--green-dim)' : 'var(--red-dim)', border: `1px solid ${pricing.monthlyProfit >= 0 ? 'var(--green-mid)' : 'var(--red-mid)'}`, borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: pricing.monthlyProfit >= 0 ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Resultado mensal projetado</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: pricing.monthlyProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pricing.monthlyProfit >= 0 ? '+' : ''}{fmtBrl(pricing.monthlyProfit)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Receita: {fmtBrl(pricing.monthlyRevenue)} · Custo: {fmtBrl(pricing.monthlyCost)}
              </div>
            </div>
          </div>

          {/* Break-even chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Break-even — receita × custo</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
                Ponto de equilíbrio a {pricing.breakEvenHours.toFixed(1)}h/mês com {occupancy}% ocupação
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={pricing.breakEvenCurve} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="hours" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} label={{ value: 'h/mês', position: 'insideBottomRight', offset: -5, style: { fill: 'var(--text3)', fontSize: 10 } }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={v => [fmtBrl(v), '']} />
                  <Line type="monotone" dataKey="revenue" name="Receita" stroke="var(--blue)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cost"    name="Custo"   stroke="var(--red)"  strokeWidth={2} dot={false} />
                  {pricing.breakEvenHours > 10 && pricing.breakEvenHours < 200 && (
                    <ReferenceLine x={Math.round(pricing.breakEvenHours / 10) * 10} stroke="var(--green)" strokeDasharray="3 3" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Composição do custo/hora</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart layout="vertical"
                  data={[
                    { name: 'Direto variável', value: Math.round(pricing.directVar) },
                    { name: 'Manutenção',      value: Math.round(pricing.mxPh) },
                    { name: 'Fixo rateado',    value: Math.round(pricing.fixedPerCharterHour) },
                    { name: 'Admin rateado',   value: Math.round((pricing.adminPh * targetHours) / charterHours) },
                  ]}
                  margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={v => [fmtBrl(v) + '/h', '']} cursor={{ fill: 'var(--bg3)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {['#4d9de0', '#e8a84a', '#3dbf8a', '#9b7fe8'].map((c, i) => <Cell key={i} fill={c} fillOpacity={.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overhaul reserve */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="section-title">Reserva de Overhaul / TBO</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Reserva MX/hora atual', value: fmtBrl(pricing.mxPh) + '/h' },
                { label: 'TBO do motor', value: `${ac?.engineTboHours || '—'} h` },
                { label: 'Horas até TBO', value: `${Math.max(0, (parseFloat(ac?.engineTboHours || 0) - parseFloat(ac?.totalEngineHours || 0))).toFixed(0)}h` },
                { label: 'Reserve acumulado', value: fmtBrl(pricing.mxPh * (pricing.totalHours || 0)) },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--amber)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', padding: '8px 12px', background: 'var(--amber-dim)', borderRadius: 8, border: '1px solid var(--amber-mid)' }}>
              ⚠ Para cobrir o overhaul completo do motor, a reserva ideal é de R$ {fmtBrl(parseFloat(ac?.engineTboHours || 2000) * pricing.mxPh)} (TBO × custo/h de MX).
              Com a taxa atual você acumula isso em {ac?.engineTboHours || 2000} horas de operação.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
