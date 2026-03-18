import React, { useState, useMemo, useEffect } from 'react';
import { getLastFuelPrice } from '../store';
import { getAirportByIcao } from '../airportsData';
import IcaoInput from './IcaoInput';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Haversine distance in nm
function distNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // nm
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fmtHM(hrs) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h${String(m).padStart(2,'0')}`;
}

// Speed refs per aircraft type (ktas, fuel flow L/h)
const TYPE_PERF = {
  single_engine: { speeds: [
    { label:'MRC', ktas:105, ff:18, desc:'Máximo alcance' },
    { label:'LRC', ktas:115, ff:20, desc:'Long range cruise' },
    { label:'65%', ktas:122, ff:24, desc:'Cruzeiro econômico' },
    { label:'75%', ktas:130, ff:28, desc:'Cruzeiro normal' },
  ], usable_fuel: 150, reserve_fuel: 30 },
  multi_engine: { speeds: [
    { label:'MRC', ktas:155, ff:60, desc:'Máximo alcance' },
    { label:'LRC', ktas:170, ff:66, desc:'Long range cruise' },
    { label:'65%', ktas:185, ff:76, desc:'Cruzeiro econômico' },
    { label:'75%', ktas:200, ff:88, desc:'Cruzeiro normal' },
  ], usable_fuel: 400, reserve_fuel: 80 },
  turboprop: { speeds: [
    { label:'MRC', ktas:220, ff:180, desc:'Máximo alcance' },
    { label:'LRC', ktas:245, ff:200, desc:'Long range cruise' },
    { label:'Normal', ktas:270, ff:240, desc:'Cruzeiro normal' },
    { label:'High spd', ktas:290, ff:290, desc:'Alta velocidade' },
  ], usable_fuel: 1600, reserve_fuel: 300 },
  jet: { speeds: [
    { label:'MRC', ktas:380, ff:850, desc:'Máximo alcance' },
    { label:'LRC', ktas:430, ff:950, desc:'Long range cruise' },
    { label:'Normal', ktas:470, ff:1100, desc:'Cruzeiro normal' },
    { label:'High spd', ktas:500, ff:1350, desc:'Alta velocidade' },
  ], usable_fuel: 12000, reserve_fuel: 2000 },
  experimental: { speeds: [
    { label:'MRC', ktas:85,  ff:14, desc:'Máximo alcance' },
    { label:'LRC', ktas:95,  ff:16, desc:'Long range cruise' },
    { label:'75%', ktas:105, ff:20, desc:'Cruzeiro normal' },
  ], usable_fuel: 100, reserve_fuel: 20 },
};

export default function RangeCalculator({ aircraft = [] }) {
  const [selectedId, setSelectedId]   = useState(aircraft[0]?.id || '');
  const [depIcao, setDepIcao]         = useState('');
  const [dstIcao, setDstIcao]         = useState('');
  const [altIcao, setAltIcao]         = useState('');
  const [speedMode, setSpeedMode]     = useState('LRC');
  const [fuelPrice, setFuelPrice]     = useState(8.5);
  const [wind, setWind]               = useState(0);        // kt headwind(+) or tailwind(-)
  const [paxWeight, setPaxWeight]     = useState(0);        // extra weight kg
  const [fuelOnboard, setFuelOnboard] = useState(null);     // null = full tanks
  const [lastFuelPx, setLastFuelPx]   = useState(null);

  const ac = aircraft.find(a => a.id === selectedId);
  const acType = ac?.type || 'single_engine';
  const perf = TYPE_PERF[acType] || TYPE_PERF.single_engine;

  // Use aircraft POH data if available, else generic
  const speeds = useMemo(() => {
    if (ac?.performanceProfiles?.length > 0) {
      return ac.performanceProfiles.map(p => ({
        label: p.name || p.speed + 'kt',
        ktas: parseFloat(p.speed) || 150,
        ff: parseFloat(p.fuelFlow) || 50,
        desc: p.altitude ? `FL${Math.round(p.altitude/100)}` : '',
      }));
    }
    return perf.speeds;
  }, [ac, perf]);

  const usableFuel = fuelOnboard !== null ? fuelOnboard : (parseFloat(ac?.fuelCapacityLiters || perf.usable_fuel));
  const reserveFuel = perf.reserve_fuel;
  const tripFuel = usableFuel - reserveFuel;

  useEffect(() => {
    if (ac?.homeBase) {
      getLastFuelPrice(ac.homeBase, ac.fuelType || 'avgas_100ll').then(p => {
        if (p) { setFuelPrice(p); setLastFuelPx(p); }
      }).catch(() => {});
    }
  }, [selectedId, ac]);

  // Airport positions
  const dep = getAirportByIcao(depIcao);
  const dst = getAirportByIcao(dstIcao);
  const alt = getAirportByIcao(altIcao);

  const routeNm = dep && dst ? Math.round(distNm(dep.lat, dep.lng, dst.lat, dst.lng)) : null;
  const altNm   = dst && alt ? Math.round(distNm(dst.lat, dst.lng, alt.lat, alt.lng)) : null;

  // Selected speed
  const selSpeed = speeds.find(s => s.label === speedMode) || speeds[1] || speeds[0];
  const gs = selSpeed.ktas - wind; // ground speed

  // Main calculation
  const calc = useMemo(() => {
    if (!selSpeed || tripFuel <= 0) return null;
    const endurance = tripFuel / selSpeed.ff; // hours
    const maxRange   = Math.round(endurance * gs);

    const results = speeds.map(s => {
      const gsS = s.ktas - wind;
      const endurS = tripFuel / s.ff;
      const rangeS = Math.round(endurS * gsS);
      const timeS  = routeNm ? routeNm / gsS : null;
      const fuelS  = timeS ? Math.round(timeS * s.ff) : null;
      const fuelCostS = fuelS ? fuelS * fuelPrice : null;
      const feasible = routeNm ? rangeS >= routeNm : true;
      return { ...s, gs: gsS, endurance: endurS, range: rangeS, time: timeS, fuelNeeded: fuelS, fuelCost: fuelCostS, feasible };
    });

    // Range profile curve
    const curve = [];
    for (let h = 0; h <= Math.max(...speeds.map(s => tripFuel / s.ff)) * 1.1; h += 0.25) {
      const pt = { hours: parseFloat(h.toFixed(2)) };
      speeds.forEach(s => {
        const gsS = s.ktas - wind;
        const fuelUsed = h * s.ff;
        if (fuelUsed <= tripFuel) pt[s.label] = Math.round(h * gsS);
      });
      curve.push(pt);
    }

    return { endurance: endurance.toFixed(1), maxRange, results, curve };
  }, [selSpeed, tripFuel, speeds, wind, routeNm, fuelPrice, gs]);

  const selResult = calc?.results.find(r => r.label === speedMode);

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 4 }}>Calculadora de Alcance</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Estimativa de combustível, autonomia e tempo de voo com base no POH.</div>

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div className="section-title">Rota</div>
          <div className="g2" style={{ marginBottom: 12 }}>
            <IcaoInput label="Origem" value={depIcao} onChange={setDepIcao} placeholder="SBGR" />
            <IcaoInput label="Destino" value={dstIcao} onChange={setDstIcao} placeholder="SBBR" />
          </div>
          <div className="g2">
            <IcaoInput label="Alternado" value={altIcao} onChange={setAltIcao} placeholder="SBSP" />
            <div>
              <label>Vento (kt) <span style={{ fontSize:10, color:'var(--text3)' }}>+ cabeça / - cauda</span></label>
              <input type="number" value={wind} onChange={e => setWind(parseInt(e.target.value)||0)} min={-200} max={200} />
            </div>
          </div>
          {routeNm && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--blue-dim)', borderRadius: 8, fontSize: 12, color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>
              {depIcao} → {dstIcao}: {routeNm} nm
              {altNm && ` · Alternado: ${altNm} nm`}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div className="section-title">Aeronave e Combustível</div>
          <div className="g2" style={{ marginBottom: 12 }}>
            <div>
              <label>Aeronave</label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <option value="">Selecionar...</option>
                {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
              </select>
            </div>
            <div>
              <label>Regime de cruzeiro</label>
              <select value={speedMode} onChange={e => setSpeedMode(e.target.value)}>
                {speeds.map(s => <option key={s.label} value={s.label}>{s.label} — {s.ktas}kt</option>)}
              </select>
            </div>
          </div>
          <div className="g2">
            <div>
              <label>Combustível a bordo (L) <span style={{ fontSize:10, color:'var(--text3)' }}>vazio = tanques cheios</span></label>
              <input type="number" value={fuelOnboard ?? ''} onChange={e => setFuelOnboard(e.target.value ? parseInt(e.target.value) : null)} placeholder={usableFuel.toString()} />
            </div>
            <div>
              <label>Preço combustível (R$/L){lastFuelPx && <span style={{ fontSize:10, color:'var(--text3)' }}> — último: R${lastFuelPx.toFixed(2)}</span>}</label>
              <input type="number" step="0.01" value={fuelPrice} onChange={e => setFuelPrice(parseFloat(e.target.value)||8.5)} />
            </div>
          </div>
        </div>
      </div>

      {calc && (
        <>
          {/* Result cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Combustível de viagem', value: `${tripFuel.toFixed(0)} L`, sub: `${reserveFuel} L reserva`, color: 'var(--amber)' },
              { label: 'Autonomia máxima', value: `${calc.endurance}h`, sub: `${selSpeed.label} — ${calc.maxRange} nm`, color: 'var(--blue)' },
              ...(selResult && routeNm ? [
                { label: 'Tempo de voo (estimado)', value: fmtHM(selResult.time), sub: `${routeNm} nm a ${Math.round(gs)} kt GS`, color: selResult.feasible ? 'var(--green)' : 'var(--red)' },
                { label: 'Combustível necessário', value: `${selResult.fuelNeeded} L`, sub: `R$ ${Math.round(selResult.fuelCost).toLocaleString('pt-BR')}`, color: selResult.feasible ? 'var(--text1)' : 'var(--red)' },
              ] : [
                { label: 'Velocidade de cruzeiro', value: `${selSpeed.ktas} kt`, sub: `GS: ${gs} kt com vento`, color: 'var(--text1)' },
                { label: 'Consumo', value: `${selSpeed.ff} L/h`, sub: selSpeed.desc, color: 'var(--amber)' },
              ]),
            ].map(k => (
              <div key={k.label} style={{ padding: '12px 14px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Feasibility alert */}
          {selResult && routeNm && !selResult.feasible && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              ⚠ Alcance insuficiente! {routeNm} nm requeridos, {selResult.range} nm disponíveis em {selResult.label}.
              Considere reabastecimento intermediário ou regime de menor consumo.
            </div>
          )}

          {/* Speed comparison table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: 'var(--bg2)' }}>
                  {['Regime', 'KTAS', 'GS', routeNm?'Tempo':'Endurance', routeNm?'Comb.':'Alcance', routeNm?'Custo':'', 'Viável?'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {calc.results.map(r => {
                    const isSel = r.label === speedMode;
                    return (
                      <tr key={r.label} onClick={() => setSpeedMode(r.label)}
                        style={{ borderBottom: '1px solid var(--border)', background: isSel ? 'var(--blue-dim)' : 'transparent', cursor: 'pointer' }}>
                        <td style={{ padding: '8px 10px', fontWeight: isSel ? 600 : 400, color: isSel ? 'var(--blue)' : 'var(--text1)' }}>{r.label}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{r.ktas}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{Math.round(r.gs)}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                          {routeNm ? (r.time ? fmtHM(r.time) : '—') : `${r.endurance.toFixed(1)}h`}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                          {routeNm ? (r.fuelNeeded ? `${r.fuelNeeded}L` : '—') : `${r.range} nm`}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: 'var(--blue)', fontSize: 11 }}>
                          {routeNm && r.fuelCost ? `R$ ${Math.round(r.fuelCost).toLocaleString('pt-BR')}` : ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {routeNm ? (r.feasible ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span> : <span style={{ color: 'var(--red)', fontWeight: 700 }}>✗</span>) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Range profile chart */}
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Perfil de alcance vs. tempo</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={calc.curve} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="hours" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                    label={{ value: 'horas', position: 'insideBottomRight', offset: -5, style: { fill: 'var(--text3)', fontSize: 10 } }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v, n) => [`${v} nm`, n]} />
                  {speeds.map((s, i) => (
                    <Line key={s.label} type="monotone" dataKey={s.label}
                      stroke={['#4d9de0','#3dbf8a','#e8a84a','#9b7fe8'][i % 4]}
                      strokeWidth={s.label === speedMode ? 2.5 : 1.5}
                      dot={false} connectNulls={false} />
                  ))}
                  {routeNm && <ReferenceLine y={routeNm} stroke="var(--red)" strokeDasharray="3 3"
                    label={{ value: `${routeNm}nm destino`, fill: 'var(--red)', fontSize: 10, position: 'right' }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fuel planning summary */}
          {routeNm && selResult?.feasible && (
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="section-title">Planejamento de combustível</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {[
                  { label: 'Trip fuel', value: `${selResult.fuelNeeded} L`, color: 'var(--blue)' },
                  { label: 'Reserva legal', value: `${reserveFuel} L`, color: 'var(--amber)' },
                  { label: 'Alternado est.', value: altNm && selResult ? `${Math.round(altNm / selResult.gs * selResult.ff)} L` : '—', color: 'var(--text2)' },
                  { label: 'Total mínimo', value: `${selResult.fuelNeeded + reserveFuel} L`, color: 'var(--text1)' },
                  { label: 'Combustível a bordo', value: `${tripFuel + reserveFuel} L`, color: usableFuel >= selResult.fuelNeeded + reserveFuel ? 'var(--green)' : 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedId && (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>✈</div>
          <div>Selecione uma aeronave para calcular alcance e combustível</div>
        </div>
      )}
    </div>
  );
}
