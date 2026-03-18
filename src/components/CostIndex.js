import React, { useState, useEffect, useMemo } from 'react';
import { getLastFuelPrice } from '../store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

// ── POH Speed references per aircraft type ────────────────────
const SPEED_REFS = {
  single_engine: {
    name:'Monomotor genérico',
    speeds: [
      { label:'Vx (melhor subida)',  ktas:72,  power:100, context:'Decolagem/subida' },
      { label:'Vy (melhor razão)',   ktas:79,  power:100, context:'Subida climb' },
      { label:'MRC (max range)',     ktas:105, power:55,  context:'Máximo alcance — menor custo/nm' },
      { label:'LRC (long range)',    ktas:115, power:60,  context:'~99% MRC range, +10% velocidade' },
      { label:'Cruzeiro 65%',       ktas:122, power:65,  context:'Equilíbrio velocidade/consumo' },
      { label:'Cruzeiro 75%',       ktas:130, power:75,  context:'Cruzeiro rápido' },
      { label:'VNO (max estrutural)',ktas:155, power:null, context:'Não exceder em ar turbulento' },
      { label:'Vne (nunca exceder)', ktas:182, power:null, context:'Velocidade limite absoluta' },
    ],
    fuelFlowPerKtas: (ktas) => { const p = Math.min(Math.max((ktas-60)/120, 0.3), 1.0); return 18 + p * 22; },
  },
  multi_engine: {
    name:'Bimotor genérico',
    speeds: [
      { label:'Vmc (controle OEI)',  ktas:78,  power:null, context:'Mínimo com motor parado' },
      { label:'MRC (max range)',     ktas:155, power:55,   context:'Máximo alcance — menor custo/nm' },
      { label:'LRC (long range)',    ktas:170, power:62,   context:'~99% MRC, mais rápido' },
      { label:'Cruzeiro 65%',       ktas:185, power:65,   context:'Cruzeiro econômico' },
      { label:'Cruzeiro 75%',       ktas:200, power:75,   context:'Cruzeiro normal' },
      { label:'High speed cruise',  ktas:220, power:85,   context:'Cruzeiro de alta velocidade' },
      { label:'VNO (max estrutural)',ktas:240, power:null, context:'Não exceder turbulência' },
    ],
    fuelFlowPerKtas: (ktas) => { const p = Math.min(Math.max((ktas-80)/180, 0.4), 1.0); return 55 + p * 40; },
  },
  turboprop: {
    name:'Turboélice genérico',
    speeds: [
      { label:'MRC (max range)',     ktas:220, power:null, context:'Menor custo/nm' },
      { label:'LRC (long range)',    ktas:245, power:null, context:'99% MRC, 10% mais veloz' },
      { label:'Normal cruise',       ktas:270, power:null, context:'Cruzeiro de planilha' },
      { label:'High speed',          ktas:290, power:null, context:'Alta velocidade' },
      { label:'VMO',                 ktas:320, power:null, context:'Velocidade máxima operacional' },
    ],
    fuelFlowPerKtas: (ktas) => { const p = Math.min(Math.max((ktas-180)/160, 0.5), 1.0); return 160 + p * 120; },
  },
  jet: {
    name:'Jato executivo genérico',
    speeds: [
      { label:'MRC (max range)',     ktas:380, power:null, context:'Menor custo/nm em altitude' },
      { label:'LRC (long range)',    ktas:430, power:null, context:'99% do MRC alcance' },
      { label:'Normal cruise',       ktas:470, power:null, context:'Cruzeiro típico FL430' },
      { label:'High speed',          ktas:500, power:null, context:'Max cruise speed' },
      { label:'MMO (max mach)',      ktas:530, power:null, context:'Mach limite (M0.88 típico)' },
    ],
    fuelFlowPerKtas: (ktas) => { const p = Math.min(Math.max((ktas-300)/260, 0.5), 1.0); return 800 + p * 600; },
  },
  experimental: {
    name:'Experimental genérico',
    speeds: [
      { label:'MRC (max range)',     ktas:85,  power:55, context:'Menor custo/nm' },
      { label:'LRC (long range)',    ktas:95,  power:65, context:'99% MRC com +10% vel.' },
      { label:'Cruzeiro 75%',       ktas:105, power:75, context:'Cruzeiro rápido' },
    ],
    fuelFlowPerKtas: (ktas) => 14 + (ktas-60)/80 * 12,
  },
};

function detectType(ac) {
  if (!ac) return 'single_engine';
  if (ac.type === 'jet') return 'jet';
  if (ac.type === 'turboprop') return 'turboprop';
  if (ac.type === 'multi_engine') return 'multi_engine';
  if (ac.type === 'experimental') return 'experimental';
  return 'single_engine';
}

function fmtBrl(v) { return 'R$ ' + Math.round(v||0).toLocaleString('pt-BR'); }

export default function CostIndex({ aircraft=[] }) {
  const [selectedAcId, setSelectedAcId] = useState(aircraft[0]?.id || 'preset');
  const [presetType, setPresetType]     = useState('single_engine');
  const [fuelPrice, setFuelPrice]       = useState(8.50);
  const [crewCostHr, setCrewCostHr]     = useState(200);
  const [maintenanceCostHr, setMxCostHr] = useState(300);
  const [fixedCostHr, setFixedCostHr]   = useState(150);
  const [distance, setDistance]         = useState(400);
  const [altitude, setAltitude]         = useState(8500);
  const [lastFuelPrice, setLastFuelPrice] = useState(null);

  const selectedAc = aircraft.find(a => a.id === selectedAcId);
  const acType = selectedAc ? detectType(selectedAc) : presetType;
  const ref = SPEED_REFS[acType] || SPEED_REFS.single_engine;

  // Use real POH performance profiles if available
  const pohProfiles = selectedAc?.performanceProfiles || [];
  const hasPOH = pohProfiles.length >= 3;

  // Build fuelFlowPerKtas from real POH data via interpolation
  const pohFuelFlow = useMemo(() => {
    if (!hasPOH) return null;
    const sorted = [...pohProfiles].filter(p => p.ktas > 0 && p.fuelLph > 0).sort((a, b) => a.ktas - b.ktas);
    if (sorted.length < 2) return null;
    return (ktas) => {
      if (ktas <= sorted[0].ktas) return sorted[0].fuelLph;
      if (ktas >= sorted[sorted.length - 1].ktas) return sorted[sorted.length - 1].fuelLph;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (ktas >= sorted[i].ktas && ktas <= sorted[i + 1].ktas) {
          const t = (ktas - sorted[i].ktas) / (sorted[i + 1].ktas - sorted[i].ktas);
          return sorted[i].fuelLph + t * (sorted[i + 1].fuelLph - sorted[i].fuelLph);
        }
      }
      return sorted[sorted.length - 1].fuelLph;
    };
  }, [pohProfiles, hasPOH]);

  // Build POH-based speed refs
  const pohSpeedRefs = useMemo(() => {
    if (!hasPOH) return null;
    const sorted = [...pohProfiles].filter(p => p.ktas > 0).sort((a, b) => a.ktas - b.ktas);
    const minKtas = sorted[0].ktas;
    const maxKtas = sorted[sorted.length - 1].ktas;
    // Find MRC (best range = min fuel/nm) and LRC (99% of MRC range)
    let mrcKtas = minKtas, mrcVal = Infinity;
    for (const p of sorted) {
      const fuelPerNm = p.fuelLph / p.ktas;
      if (fuelPerNm < mrcVal) { mrcVal = fuelPerNm; mrcKtas = p.ktas; }
    }
    const lrcKtas = Math.round(mrcKtas * 1.08);
    const speeds = [
      { label: 'MRC (max range)', ktas: mrcKtas, power: null, context: 'Menor consumo/nm — dados POH reais' },
      { label: 'LRC (long range)', ktas: Math.min(lrcKtas, maxKtas), power: null, context: '99% MRC, ~8% mais veloz' },
      ...sorted.filter(p => ![mrcKtas, lrcKtas].includes(p.ktas)).map(p => ({
        label: `${p.altFt ? p.altFt + 'ft' : ''} ${p.power ? p.power + '%' : ''}`.trim() || `${p.ktas}kt`,
        ktas: p.ktas, power: p.power, context: `Perfil POH cadastrado`,
      })),
    ].filter((s, i, arr) => arr.findIndex(x => x.ktas === s.ktas) === i).sort((a, b) => a.ktas - b.ktas);
    return { name: `${selectedAc.registration} — dados POH reais`, speeds, fuelFlowPerKtas: pohFuelFlow };
  }, [pohProfiles, hasPOH, pohFuelFlow, selectedAc]);

  const activeRef = hasPOH && pohSpeedRefs ? pohSpeedRefs : ref;

  useEffect(() => {
    if (selectedAc?.homeBase) {
      getLastFuelPrice(selectedAc.homeBase, selectedAc.fuelType || 'avgas_100ll')
        .then(p => { if(p){ setFuelPrice(p); setLastFuelPrice(p); } }).catch(()=>{});
    }
  }, [selectedAcId, selectedAc]);

  // ── CI = cost of time / cost of fuel (in aircraft-specific units) ─────
  // Formula: CI = (crew_cost + fixed_cost) / (fuel_price × fuel_flow_per_time)
  // Lower CI = optimize for fuel; Higher CI = optimize for time
  const computedCI = useMemo(() => {
    const timeValuePerMin = (crewCostHr + fixedCostHr + maintenanceCostHr) / 60; // R$/min
    const fuelFlowPerMin  = activeRef.fuelFlowPerKtas(activeRef.speeds.find(s=>s.label.includes('LRC'))?.ktas||150) / 60; // L/min at LRC
    const fuelCostPerMin  = fuelFlowPerMin * fuelPrice; // R$/min
    return fuelCostPerMin > 0 ? Math.round((timeValuePerMin / fuelCostPerMin) * 100) : 50;
  }, [crewCostHr, fixedCostHr, maintenanceCostHr, fuelPrice, activeRef]);

  // ── CI-driven speed recommendation ───────────────────────────────────
  // CI=0 → fly MRC; CI=max → fly max speed; interpolate between
  const ciRecommendedSpeed = useMemo(() => {
    const speeds = activeRef.speeds.filter(s => s.power !== null);
    if (speeds.length === 0) return null;
    const ciNorm = Math.min(computedCI / 200, 1); // normalize CI 0-200
    const idx = Math.round(ciNorm * (speeds.length - 1));
    return speeds[Math.min(idx, speeds.length - 1)];
  }, [computedCI, activeRef]);

  const ciLabel = computedCI < 30 ? 'Conservador — economize combustível' :
                  computedCI < 80 ? 'Equilibrado — MRC/LRC recomendado' :
                  computedCI < 150 ? 'Moderado — priorize tempo' : 'Alto — voe na máxima velocidade';

  // ── Speed-cost curve ──────────────────────────────────────────────────
  const curvePts = useMemo(() => {
    const speeds = activeRef.speeds.filter(s => s.power !== null);
    if (speeds.length === 0) return [];
    const minKtas = speeds[0].ktas * 0.85;
    const maxKtas = speeds[speeds.length-1].ktas * 1.05;
    const pts = [];
    for (let ktas = minKtas; ktas <= maxKtas; ktas += Math.max(1, (maxKtas-minKtas)/40)) {
      const ff = activeRef.fuelFlowPerKtas(ktas); // L/hr
      const flightHrs = distance / ktas;
      const fuelCost  = ff * flightHrs * fuelPrice;
      const timeCost  = flightHrs * (crewCostHr + fixedCostHr + maintenanceCostHr);
      const totalCost = fuelCost + timeCost;
      pts.push({ ktas: Math.round(ktas), fuelCost: Math.round(fuelCost), timeCost: Math.round(timeCost), totalCost: Math.round(totalCost) });
    }
    return pts;
  }, [ref, distance, fuelPrice, crewCostHr, fixedCostHr, maintenanceCostHr]);

  const optimalPt = useMemo(() => curvePts.reduce((best, pt) => pt.totalCost < (best?.totalCost ?? Infinity) ? pt : best, null), [curvePts]);

  // ── Table per speed reference ─────────────────────────────────────────
  const speedTable = useMemo(() => activeRef.speeds.filter(s=>s.power!==null).map(s => {
    const ff = activeRef.fuelFlowPerKtas(s.ktas);
    const hrs = distance / s.ktas;
    const fuelCost = ff * hrs * fuelPrice;
    const timeCost = hrs * (crewCostHr + fixedCostHr + maintenanceCostHr);
    const total = fuelCost + timeCost;
    const costPerNm = total / distance;
    return { ...s, ff: ff.toFixed(0), hrs: hrs.toFixed(1), fuelCost: Math.round(fuelCost), timeCost: Math.round(timeCost), total: Math.round(total), costPerNm: costPerNm.toFixed(2) };
  }), [ref, distance, fuelPrice, crewCostHr, fixedCostHr, maintenanceCostHr]);

  const minTotal = Math.min(...speedTable.map(s=>s.total));

  return (
    <div style={{ padding:24, maxWidth:1000 }}>
      <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400, marginBottom:4 }}>Cost Index — Análise de Velocidade</div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4 }}>O CI determina o equilíbrio entre custo de combustível e custo de tempo. CI=0 maximiza alcance; CI alto maximiza velocidade.</div>
      {hasPOH ? (
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:8, fontSize:11, color:'var(--green)', marginBottom:16 }}>
          ✓ Usando dados reais do POH — {pohProfiles.length} perfis de performance cadastrados para {selectedAc?.registration}
        </div>
      ) : (
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:11, color:'var(--amber)', marginBottom:16 }}>
          ⚠ Usando dados genéricos — cadastre perfis de performance no POH da aeronave para dados reais
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <div className="card" style={{ padding:'14px 18px' }}>
          <div className="section-title">Aeronave / Perfil</div>
          <div className="g2" style={{ marginBottom:10 }}>
            <div>
              <label>Aeronave</label>
              <select value={selectedAcId} onChange={e=>setSelectedAcId(e.target.value)}>
                <option value="preset">Usar perfil genérico</option>
                {aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
              </select>
            </div>
            {selectedAcId === 'preset' && (
              <div>
                <label>Tipo</label>
                <select value={presetType} onChange={e=>setPresetType(e.target.value)}>
                  <option value="single_engine">Monomotor pistão</option>
                  <option value="multi_engine">Bimotor pistão</option>
                  <option value="turboprop">Turboélice</option>
                  <option value="jet">Jato executivo</option>
                  <option value="experimental">Experimental</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label>Distância da rota (nm)</label>
            <input type="number" value={distance} onChange={e=>setDistance(Math.max(10,parseInt(e.target.value)||10))} min={10} max={5000} />
          </div>
        </div>

        <div className="card" style={{ padding:'14px 18px' }}>
          <div className="section-title">Custos por hora de voo</div>
          <div className="g2" style={{ marginBottom:10 }}>
            <div>
              <label>Combustível (R$/L){lastFuelPrice&&<span style={{ color:'var(--text3)', fontSize:10 }}> — último: R${lastFuelPrice?.toFixed(2)}</span>}</label>
              <input type="number" step="0.01" value={fuelPrice} onChange={e=>setFuelPrice(parseFloat(e.target.value)||8.5)} />
            </div>
            <div>
              <label>Tripulação (R$/h)</label>
              <input type="number" value={crewCostHr} onChange={e=>setCrewCostHr(parseInt(e.target.value)||0)} />
            </div>
          </div>
          <div className="g2">
            <div>
              <label>Manutenção (R$/h)</label>
              <input type="number" value={maintenanceCostHr} onChange={e=>setMxCostHr(parseInt(e.target.value)||0)} />
            </div>
            <div>
              <label>Fixos rateados (R$/h)</label>
              <input type="number" value={fixedCostHr} onChange={e=>setFixedCostHr(parseInt(e.target.value)||0)} />
            </div>
          </div>
        </div>
      </div>

      {/* CI Badge */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        <div style={{ padding:'16px 18px', background:'var(--blue-dim)', border:'2px solid var(--blue-mid)', borderRadius:12, gridColumn:'span 1' }}>
          <div style={{ fontSize:10, color:'var(--blue)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>CI calculado pela plataforma</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:36, color:'var(--blue)', lineHeight:1 }}>{computedCI}</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>{ciLabel}</div>
        </div>
        {ciRecommendedSpeed && (
          <div style={{ padding:'16px 18px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:12 }}>
            <div style={{ fontSize:10, color:'var(--green)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Regime recomendado (CI)</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:28, color:'var(--green)', lineHeight:1 }}>{ciRecommendedSpeed.ktas} kt</div>
            <div style={{ fontSize:11, color:'var(--text2)', marginTop:6 }}>{ciRecommendedSpeed.label} — {ciRecommendedSpeed.context}</div>
          </div>
        )}
        <div style={{ padding:'16px 18px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Velocidade ótima</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:28, color:'var(--text1)', lineHeight:1 }}>{optimalPt?.ktas || '—'} kt</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>menor custo total para {distance}nm</div>
        </div>
        <div style={{ padding:'16px 18px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Custo total / hora</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:22, color:'var(--text1)', lineHeight:1 }}>{fmtBrl(crewCostHr+fixedCostHr+maintenanceCostHr)}</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>tripulação + MX + fixos</div>
        </div>
      </div>

      {/* Curve chart */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
        <div className="section-title">Curva custo × velocidade — {distance} nm</div>
        <div style={{ fontSize:11, color:'var(--text2)', marginBottom:12 }}>Ponto verde = velocidade de menor custo total. Abaixo desse ponto, o custo de tempo domina; acima, o combustível domina.</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={curvePts} margin={{ top:4, right:20, bottom:0, left:0 }}>
            <XAxis dataKey="ktas" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} label={{ value:'KTAS', position:'insideBottomRight', offset:-5, style:{ fill:'var(--text3)', fontSize:10 } }} />
            <YAxis hide />
            <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }} formatter={(v,n)=>[fmtBrl(v),n]} />
            <Legend wrapperStyle={{ fontSize:11 }} />
            <Line type="monotone" dataKey="fuelCost"  name="Combustível" stroke="#e8a84a" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="timeCost"  name="Tempo (equipe+fixo)" stroke="#9b7fe8" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="totalCost" name="Custo total" stroke="#4d9de0" dot={false} strokeWidth={2.5} />
            {optimalPt && <ReferenceLine x={optimalPt.ktas} stroke="#3dbf8a" strokeDasharray="3 3" label={{ value:`Ótimo ${optimalPt.ktas}kt`, fill:'#3dbf8a', fontSize:10 }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Speed reference table */}
      <div className="card" style={{ overflow:'hidden', padding:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'var(--bg2)' }}>
              {['Regime','Velocidade','Fluxo comb.','Tempo de voo','Custo comb.','Custo tempo','Custo total','R$/nm','Contexto'].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {speedTable.map(s => {
              const isOptimal = s.total === minTotal;
              const isMRC  = s.label.includes('MRC');
              const isLRC  = s.label.includes('LRC');
              return (
                <tr key={s.label} style={{ borderBottom:'1px solid var(--border)', background: isOptimal?'var(--green-dim)':isMRC?'var(--blue-dim)':isLRC?'var(--purple-dim)':'transparent' }}>
                  <td style={{ padding:'9px 12px', fontWeight:600, color: isOptimal?'var(--green)':isMRC?'var(--blue)':isLRC?'var(--purple)':'var(--text1)' }}>
                    {isOptimal && '★ '}{s.label}
                  </td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', fontWeight:600 }}>{s.ktas} kt</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--amber)' }}>{s.ff} L/h</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{s.hrs}h</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--amber)' }}>{fmtBrl(s.fuelCost)}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--purple)' }}>{fmtBrl(s.timeCost)}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', fontWeight:600, color:isOptimal?'var(--green)':'var(--blue)' }}>{fmtBrl(s.total)}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>R$ {s.costPerNm}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text2)', fontSize:11 }}>{s.context}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
