import React, { useState, useEffect, useCallback } from 'react';
import {
  getJourneys, saveMission, saveFlight, saveCost, getCosts,
  linkFlightToMission, cancelMission, deleteMission, deleteFlight,
  getAircraft, getMissions, getFlights, getCrewMembers,
} from '../store';

// ── Status config ──────────────────────────────────────────────
const STATUS_CFG = {
  planned:    { label: 'Planejado',    color: 'var(--blue)',   dim: 'var(--blue-dim)',   mid: 'var(--blue-mid)'   },
  registered: { label: 'Registrado',  color: 'var(--text2)',  dim: 'var(--bg3)',        mid: 'var(--border2)'    },
  in_progress:{ label: 'Em andamento',color: 'var(--amber)',  dim: 'var(--amber-dim)',  mid: 'var(--amber-mid)'  },
  completed:  { label: 'Realizado',   color: 'var(--green)',  dim: 'var(--green-dim)',  mid: 'var(--green-mid)'  },
  cancelled:  { label: 'Cancelado',   color: 'var(--red)',    dim: 'var(--red-dim)',    mid: 'var(--red-mid)'    },
};

const TABS = [
  { id: 'plan',    label: 'Planejamento', icon: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5z' },
  { id: 'preflight', label: 'Pré-voo',   icon: 'M9 11H7a2 2 0 00-2 2v1a2 2 0 002 2h2m8-5h2a2 2 0 012 2v1a2 2 0 01-2 2h-2M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8' },
  { id: 'exec',    label: 'Execução',    icon: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' },
  { id: 'post',   label: 'Pós-voo',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
];

const EMPTY_MISSION = { name:'', type:'round_trip', purpose:'leisure', aircraftId:'', dateStart:'', dateEnd:'', legs:[], passengers:[], notes:'' };
const EMPTY_FLIGHT  = { aircraftId:'', date:'', departureIcao:'', destinationIcao:'', flightTimeMinutes:'', distanceNm:'', fuelAddedLiters:'', fuelPricePerLiter:'', flightConditions:'vfr', cycles:1, logbookNotes:'' };

// ── Helpers ────────────────────────────────────────────────────
function fmtHM(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}`;
}
function fmtBRL(v) {
  if (!v) return '—';
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 })}`;
}
function today() { return new Date().toISOString().slice(0,10); }

// ── Main component ─────────────────────────────────────────────
export default function FlightJourney({ aircraft: propAircraft = [], reload: appReload, setPage }) {
  const [journeys,   setJourneys]   = useState([]);
  const [aircraft,   setAircraft]   = useState(propAircraft);
  const [crew,       setCrew]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null); // journey object
  const [activeTab,  setActiveTab]  = useState('plan');
  const [filter,     setFilter]     = useState('all');
  const [showNew,    setShowNew]    = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Forms
  const [missionForm, setMissionForm] = useState(EMPTY_MISSION);
  const [flightForm,  setFlightForm]  = useState(EMPTY_FLIGHT);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, ac, cr] = await Promise.all([getJourneys(), getAircraft(), getCrewMembers()]);
      setJourneys(j || []);
      setAircraft(ac || propAircraft);
      setCrew(cr || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [propAircraft]);

  useEffect(() => { load(); }, [load]);

  // When a journey is selected, pre-fill its forms
  useEffect(() => {
    if (!selected) return;
    if (selected.missionId) {
      // Pre-fill mission form from journey
      setMissionForm({
        id:         selected.missionId,
        name:       selected.name || '',
        type:       selected.type || 'round_trip',
        purpose:    selected.purpose || 'leisure',
        aircraftId: selected.aircraftId || '',
        dateStart:  selected.dateStart || '',
        dateEnd:    selected.dateEnd || '',
        legs:       selected.legs || [],
        passengers: selected.passengers || [],
        notes:      selected.notes || '',
        status:     selected.status,
        flightId:   selected.flightId,
      });
    }
    if (selected.linkedFlight) {
      const f = selected.linkedFlight;
      setFlightForm({
        id:                f.id,
        aircraftId:        f.aircraftId || selected.aircraftId || '',
        date:              f.date || '',
        departureIcao:     f.departureIcao || '',
        destinationIcao:   f.destinationIcao || '',
        flightTimeMinutes: f.flightTimeMinutes || '',
        flightTimeDay:     f.flightTimeDay || '',
        flightTimeNight:   f.flightTimeNight || '',
        flightTimeIfr:     f.flightTimeIfr || '',
        distanceNm:        f.distanceNm || '',
        cruiseAltitudeFt:  f.cruiseAltitudeFt || '',
        fuelAddedLiters:   f.fuelAddedLiters || '',
        fuelPricePerLiter: f.fuelPricePerLiter || '',
        fuelVendor:        f.fuelVendor || '',
        flightConditions:  f.flightConditions || 'vfr',
        cycles:            f.cycles || 1,
        logbookNotes:      f.logbookNotes || '',
        missionId:         selected.missionId || null,
      });
    } else {
      setFlightForm({
        ...EMPTY_FLIGHT,
        aircraftId: selected.aircraftId || '',
        date:       selected.dateStart || today(),
        departureIcao: selected.legs?.[0]?.departureIcao || '',
        destinationIcao: selected.legs?.[selected.legs.length-1]?.destinationIcao || '',
        missionId:  selected.missionId || null,
      });
    }
  }, [selected]);

  // ── Save mission ──────────────────────────────────────────────
  async function handleSaveMission(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await saveMission(missionForm);
      await load();
      // Re-select updated journey
      const updated = await getJourneys();
      setJourneys(updated);
      const found = updated.find(j => j.missionId === missionForm.id || (j.missionId && j.name === missionForm.name));
      if (found) setSelected(found);
      appReload?.();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  // ── Save flight (execution) ───────────────────────────────────
  async function handleSaveFlight(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const saved = await saveFlight({ ...flightForm, missionId: selected?.missionId || null });
      // If this journey has a mission but no linked flight yet, link them
      if (selected?.missionId && !selected?.flightId) {
        await linkFlightToMission(selected.missionId, saved.id);
      }
      // Auto-create fuel cost if price was filled
      if (flightForm.fuelAddedLiters > 0 && flightForm.fuelPricePerLiter > 0) {
        const fuelTotal = parseFloat(flightForm.fuelAddedLiters) * parseFloat(flightForm.fuelPricePerLiter);
        await saveCost({
          aircraftId:    flightForm.aircraftId,
          flightId:      saved.id,
          missionId:     selected?.missionId || null,
          category:      'fuel',
          costType:      'variable',
          amountBrl:     fuelTotal,
          description:   `Combustível — ${flightForm.departureIcao}→${flightForm.destinationIcao}`,
          referenceDate: flightForm.date,
          vendor:        flightForm.fuelVendor || null,
        });
      }
      await load();
      const updated = await getJourneys();
      setJourneys(updated);
      const found = updated.find(j =>
        (selected?.missionId && j.missionId === selected.missionId) ||
        j.flightId === saved.id
      );
      if (found) { setSelected(found); setActiveTab('post'); }
      appReload?.();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  // ── Create new journey ────────────────────────────────────────
  async function handleCreateNew(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const saved = await saveMission({ ...missionForm, status: 'planned' });
      setShowNew(false);
      setMissionForm(EMPTY_MISSION);
      await load();
      const updated = await getJourneys();
      setJourneys(updated);
      const found = updated.find(j => j.missionId === saved.id);
      if (found) { setSelected(found); setActiveTab('plan'); }
      appReload?.();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  // ── Cancel journey ────────────────────────────────────────────
  async function handleCancel() {
    if (!selected?.missionId) return;
    setSaving(true);
    try {
      await cancelMission(selected.missionId, cancelReason);
      setShowCancel(false);
      setCancelReason('');
      await load();
      appReload?.();
      setSelected(null);
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  // ── Filters ───────────────────────────────────────────────────
  const FILTERS = [
    { id:'all',       label:'Todos' },
    { id:'planned',   label:'Planejados' },
    { id:'completed', label:'Realizados' },
    { id:'registered',label:'Ad-hoc' },
    { id:'cancelled', label:'Cancelados' },
  ];
  const filtered = journeys.filter(j => filter === 'all' || j.status === filter);

  // ── Completeness indicators per tab ──────────────────────────
  function tabDone(tabId) {
    if (!selected) return false;
    if (tabId === 'plan')      return !!selected.missionId && !!selected.name;
    if (tabId === 'preflight') return !!(selected.aircraftId);
    if (tabId === 'exec')      return !!(selected.linkedFlight);
    if (tabId === 'post')      return selected.totalCost > 0;
    return false;
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>✈</div>Carregando jornadas...
    </div>
  );

  // Detail view
  if (selected) {
    const st = STATUS_CFG[selected.status] || STATUS_CFG.registered;
    const ac = aircraft.find(a => a.id === selected.aircraftId);

    return (
      <div style={{ padding:'20px 24px', maxWidth:900 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={() => setSelected(null)}>← Voos</button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:20 }}>{selected.name}</div>
              <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:st.dim, color:st.color, border:`1px solid ${st.mid}` }}>
                {st.label}
              </span>
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
              {ac ? `${ac.registration} — ${ac.manufacturer} ${ac.model}` : ''}
              {selected.dateStart ? ` · ${selected.dateStart}` : ''}
            </div>
          </div>
          {/* Actions */}
          <div style={{ display:'flex', gap:8 }}>
            {selected.status === 'planned' && (
              <button className="danger" style={{ fontSize:11 }} onClick={() => setShowCancel(true)}>
                Cancelar voo
              </button>
            )}
          </div>
        </div>

        {error && <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}<button className="ghost" style={{ marginLeft:8, fontSize:11 }} onClick={() => setError('')}>✕</button></div>}

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:`1px solid var(--border)`, paddingBottom:0 }}>
          {TABS.map(tab => {
            const done = tabDone(tab.id);
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'8px 8px 0 0', border:'none', borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent', background: active ? 'var(--blue-dim)' : 'transparent', color: active ? 'var(--blue)' : done ? 'var(--green)' : 'var(--text3)', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .12s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d={tab.icon}/></svg>
                {tab.label}
                {done && !active && <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', flexShrink:0 }} />}
              </button>
            );
          })}
        </div>

        {/* ── TAB: Planejamento ─────────────────────────────── */}
        {activeTab === 'plan' && (
          <form onSubmit={handleSaveMission}>
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Missão</div>
              <div style={{ marginBottom:12 }}>
                <label>Nome da missão</label>
                <input value={missionForm.name} onChange={e => setMissionForm(f=>({...f,name:e.target.value}))} placeholder="Ex: SBBR → SBSP → SBBR" required />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label>Aeronave</label>
                  <select value={missionForm.aircraftId} onChange={e=>setMissionForm(f=>({...f,aircraftId:e.target.value}))}>
                    <option value="">Selecione...</option>
                    {aircraft.map(a=><option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
                  </select>
                </div>
                <div>
                  <label>Data início</label>
                  <input type="date" value={missionForm.dateStart} onChange={e=>setMissionForm(f=>({...f,dateStart:e.target.value}))} />
                </div>
                <div>
                  <label>Data fim</label>
                  <input type="date" value={missionForm.dateEnd} onChange={e=>setMissionForm(f=>({...f,dateEnd:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label>Tipo</label>
                  <select value={missionForm.type} onChange={e=>setMissionForm(f=>({...f,type:e.target.value}))}>
                    {[['round_trip','Bate e volta'],['multi_leg','Multi-leg'],['ferry','Posicionamento'],['international','Internacional'],['maintenance','Manutenção']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label>Propósito</label>
                  <select value={missionForm.purpose} onChange={e=>setMissionForm(f=>({...f,purpose:e.target.value}))}>
                    {[['leisure','Lazer / Passeio'],['business','Negócios'],['transport','Transporte'],['training','Instrução'],['professional','Profissional']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label>Notas / briefing</label>
                <textarea rows={2} value={missionForm.notes} onChange={e=>setMissionForm(f=>({...f,notes:e.target.value}))} placeholder="Observações da missão..." />
              </div>
            </div>

            {/* Legs */}
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Pernas do voo</div>
              {(missionForm.legs||[]).map((leg, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                  <span style={{ color:'var(--text3)', minWidth:20 }}>{i+1}.</span>
                  <span style={{ fontFamily:'var(--font-mono)', flex:1 }}>{leg.departureIcao} → {leg.destinationIcao}</span>
                  <span style={{ color:'var(--text3)', fontSize:11 }}>{leg.date || ''}</span>
                  <button type="button" className="ghost" style={{ fontSize:10, padding:'2px 6px' }}
                    onClick={() => setMissionForm(f=>({...f,legs:f.legs.filter((_,j)=>j!==i)}))}>✕</button>
                </div>
              ))}
              <LegAdder onAdd={leg => setMissionForm(f=>({...f,legs:[...(f.legs||[]),{seq:(f.legs||[]).length+1,...leg}]}))} prevDestination={(missionForm.legs||[]).at(-1)?.destinationIcao||''} />
            </div>

            {/* Passengers */}
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Passageiros / tripulação</div>
              {(missionForm.passengers||[]).map((p, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                  <span style={{ flex:1 }}>{p.name}</span>
                  <span style={{ color:'var(--text3)', fontSize:11 }}>{p.role === 'captain' ? 'Comandante' : p.role === 'fo' ? 'Co-piloto' : 'Passageiro'}</span>
                  <button type="button" className="ghost" style={{ fontSize:10, padding:'2px 6px' }}
                    onClick={() => setMissionForm(f=>({...f,passengers:f.passengers.filter((_,j)=>j!==i)}))}>✕</button>
                </div>
              ))}
              <PaxAdder crew={crew} onAdd={pax => setMissionForm(f=>({...f,passengers:[...(f.passengers||[]),pax]}))} />
            </div>

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="submit" className="primary" disabled={saving} style={{ flex:1 }}>
                {saving ? 'Salvando...' : '✓ Salvar planejamento'}
              </button>
              <button type="button" onClick={() => setActiveTab('exec')} style={{ fontSize:12 }}>
                Ir para execução →
              </button>
            </div>
          </form>
        )}

        {/* ── TAB: Pré-voo ──────────────────────────────────── */}
        {activeTab === 'preflight' && (
          <div>
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>Aeronave</div>
              {ac ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, fontSize:12 }}>
                  <div><div style={{ color:'var(--text3)', fontSize:10, marginBottom:3 }}>REGISTRO</div><div style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{ac.registration}</div></div>
                  <div><div style={{ color:'var(--text3)', fontSize:10, marginBottom:3 }}>MODELO</div><div>{ac.manufacturer} {ac.model}</div></div>
                  <div><div style={{ color:'var(--text3)', fontSize:10, marginBottom:3 }}>HORAS TOTAIS</div><div style={{ fontFamily:'var(--font-mono)' }}>{ac.totalFlightHours?.toFixed(1) || '—'}h</div></div>
                  <div><div style={{ color:'var(--text3)', fontSize:10, marginBottom:3 }}>MOTOR</div><div>{ac.engineModel || '—'}</div></div>
                  <div><div style={{ color:'var(--text3)', fontSize:10, marginBottom:3 }}>TBO MOTOR</div><div style={{ fontFamily:'var(--font-mono)' }}>{ac.engineTboHours || '—'}h</div></div>
                  <div><div style={{ color:'var(--text3)', fontSize:10, marginBottom:3 }}>COMBUSTÍVEL</div><div>{ac.fuelType === 'jet_a1' ? 'Jet A-1' : 'Avgas 100LL'}</div></div>
                </div>
              ) : (
                <div style={{ color:'var(--amber)', fontSize:12 }}>⚠ Aeronave não selecionada no planejamento.</div>
              )}
            </div>

            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Tripulação escalada</div>
              {(missionForm.passengers||selected.passengers||[]).filter(p => p.role !== 'pax').length === 0 ? (
                <div style={{ color:'var(--text3)', fontSize:12 }}>Nenhuma tripulação no planejamento. <button className="ghost" style={{ fontSize:12 }} onClick={() => setActiveTab('plan')}>Adicionar no planejamento →</button></div>
              ) : (
                (missionForm.passengers||selected.passengers||[]).filter(p => p.role !== 'pax').map((p,i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                    <div style={{ flex:1 }}>{p.name}</div>
                    <div style={{ color:'var(--text3)' }}>{p.role === 'captain' ? 'Comandante' : 'Co-piloto'}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button className="primary" onClick={() => setActiveTab('exec')} style={{ flex:1 }}>
                Pré-voo OK — ir para execução →
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: Execução ─────────────────────────────────── */}
        {activeTab === 'exec' && (
          <form onSubmit={handleSaveFlight}>
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Dados do voo</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label>Aeronave</label>
                  <select value={flightForm.aircraftId} onChange={e=>setFlightForm(f=>({...f,aircraftId:e.target.value}))}>
                    <option value="">Selecione...</option>
                    {aircraft.map(a=><option key={a.id} value={a.id}>{a.registration}</option>)}
                  </select>
                </div>
                <div>
                  <label>Data</label>
                  <input type="date" value={flightForm.date} onChange={e=>setFlightForm(f=>({...f,date:e.target.value}))} required />
                </div>
                <div>
                  <label>Condições</label>
                  <select value={flightForm.flightConditions} onChange={e=>setFlightForm(f=>({...f,flightConditions:e.target.value}))}>
                    <option value="vfr">VFR</option>
                    <option value="ifr">IFR</option>
                    <option value="mvfr">MVFR</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div><label>Saída (ICAO)</label><input value={flightForm.departureIcao} onChange={e=>setFlightForm(f=>({...f,departureIcao:e.target.value.toUpperCase()}))} placeholder="SBBR" maxLength={4} style={{ fontFamily:'var(--font-mono)', textTransform:'uppercase' }} /></div>
                <div><label>Destino (ICAO)</label><input value={flightForm.destinationIcao} onChange={e=>setFlightForm(f=>({...f,destinationIcao:e.target.value.toUpperCase()}))} placeholder="SBSP" maxLength={4} style={{ fontFamily:'var(--font-mono)', textTransform:'uppercase' }} /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div><label>Tempo de voo (min)</label><input type="number" value={flightForm.flightTimeMinutes} onChange={e=>setFlightForm(f=>({...f,flightTimeMinutes:e.target.value}))} placeholder="90" /></div>
                <div><label>Distância (NM)</label><input type="number" value={flightForm.distanceNm} onChange={e=>setFlightForm(f=>({...f,distanceNm:e.target.value}))} placeholder="350" /></div>
                <div><label>Ciclos</label><input type="number" value={flightForm.cycles} onChange={e=>setFlightForm(f=>({...f,cycles:parseInt(e.target.value)||1}))} min={1} /></div>
              </div>
            </div>

            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
                Combustível <span style={{ color:'var(--text3)', fontWeight:400, fontSize:10 }}>(se abastecido — custo criado automaticamente)</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div><label>Litros abastecidos</label><input type="number" step="0.1" value={flightForm.fuelAddedLiters} onChange={e=>setFlightForm(f=>({...f,fuelAddedLiters:e.target.value}))} placeholder="0" /></div>
                <div><label>R$/litro</label><input type="number" step="0.01" value={flightForm.fuelPricePerLiter} onChange={e=>setFlightForm(f=>({...f,fuelPricePerLiter:e.target.value}))} placeholder="0.00" /></div>
                <div><label>Fornecedor</label><input value={flightForm.fuelVendor||''} onChange={e=>setFlightForm(f=>({...f,fuelVendor:e.target.value}))} placeholder="FBO / posto" /></div>
              </div>
              {flightForm.fuelAddedLiters > 0 && flightForm.fuelPricePerLiter > 0 && (
                <div style={{ marginTop:10, padding:'8px 12px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:8, fontSize:12, color:'var(--green)' }}>
                  ✓ Custo de combustível: {fmtBRL(parseFloat(flightForm.fuelAddedLiters)*parseFloat(flightForm.fuelPricePerLiter))} — será criado automaticamente ao salvar
                </div>
              )}
            </div>

            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Notas de bordo</div>
              <textarea rows={3} value={flightForm.logbookNotes} onChange={e=>setFlightForm(f=>({...f,logbookNotes:e.target.value}))} placeholder="Observações, intercorrências, condições meteorológicas..." />
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button type="submit" className="primary" disabled={saving} style={{ flex:1 }}>
                {saving ? 'Salvando...' : '✓ Registrar voo'}
              </button>
              <button type="button" style={{ fontSize:12 }} onClick={() => setActiveTab('post')}>
                Ir para pós-voo →
              </button>
            </div>
          </form>
        )}

        {/* ── TAB: Pós-voo ──────────────────────────────────── */}
        {activeTab === 'post' && (
          <PostFlightTab journey={selected} aircraft={ac} onNavigate={setPage} onReload={load} />
        )}

        {/* Cancel modal */}
        {showCancel && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, padding:28, maxWidth:440, width:'100%' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:18, marginBottom:12 }}>Cancelar voo?</div>
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>O planejamento será mantido, mas o status mudará para Cancelado.</div>
              <label style={{ fontSize:12, display:'block', marginBottom:6 }}>Motivo (opcional)</label>
              <input value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Ex: Condições meteorológicas, manutenção..." style={{ marginBottom:16 }} />
              <div style={{ display:'flex', gap:10 }}>
                <button className="danger" onClick={handleCancel} disabled={saving} style={{ flex:1 }}>Confirmar cancelamento</button>
                <button onClick={() => setShowCancel(false)}>Voltar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <div style={{ padding:'20px 24px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22 }}>Voos</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{journeys.length} registros</div>
        </div>
        <button className="primary" onClick={() => { setMissionForm({...EMPTY_MISSION, dateStart:today(), aircraftId:aircraft[0]?.id||''}); setShowNew(true); }}>
          + Novo voo
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ padding:'5px 13px', borderRadius:20, border:`0.5px solid ${filter===f.id?'var(--border2)':'var(--border)'}`, background: filter===f.id?'var(--bg3)':'transparent', color: filter===f.id?'var(--text1)':'var(--text3)', fontSize:11.5, fontWeight:500, cursor:'pointer' }}>
            {f.label} <span style={{ opacity:.6, fontSize:10 }}>
              {f.id==='all' ? journeys.length : journeys.filter(j=>j.status===f.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>✈</div>
          Nenhum voo encontrado. Crie o primeiro usando o botão acima.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(j => {
            const st = STATUS_CFG[j.status] || STATUS_CFG.registered;
            const ac = aircraft.find(a => a.id === j.aircraftId);
            const totalMins = (j.legFlights||[]).reduce((s,f)=>s+(f?.flightTimeMinutes||0),0);
            return (
              <div key={j.id} onClick={() => { setSelected(j); setActiveTab('plan'); }}
                style={{ background:'var(--bg1)', border:`1px solid var(--border)`, borderRadius:12, padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:16, transition:'all .12s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>

                {/* Status dot */}
                <div style={{ width:8, height:8, borderRadius:'50%', background:st.color, flexShrink:0 }} />

                {/* Main info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                    <div style={{ fontWeight:500, fontSize:13, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:300 }}>{j.name}</div>
                    <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:st.dim, color:st.color, border:`1px solid ${st.mid}`, flexShrink:0 }}>{st.label}</span>
                    {j.type === 'adhoc' && <span style={{ fontSize:10, color:'var(--text3)', flexShrink:0 }}>Ad-hoc</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)', display:'flex', gap:12, flexWrap:'wrap' }}>
                    {ac && <span>{ac.registration}</span>}
                    {j.dateStart && <span>{j.dateStart}</span>}
                    {totalMins > 0 && <span>{fmtHM(totalMins)}</span>}
                    {j.legs?.length > 0 && <span>{j.legs.length} perna{j.legs.length>1?'s':''}</span>}
                  </div>
                </div>

                {/* Cost */}
                {j.totalCost > 0 && (
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{fmtBRL(j.totalCost)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>custo total</div>
                  </div>
                )}

                {/* Completeness pills */}
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  {['plan','exec','post'].map(t => {
                    const done = t==='plan'?!!j.missionId : t==='exec'?!!j.linkedFlight : j.totalCost>0;
                    return <div key={t} style={{ width:6, height:6, borderRadius:'50%', background:done?'var(--green)':'var(--bg3)', border:`1px solid ${done?'var(--green-mid)':'var(--border)'}` }} />;
                  })}
                </div>

                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text3)"><path d="M10 17l5-5-5-5v10z"/></svg>
              </div>
            );
          })}
        </div>
      )}

      {/* New journey modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 20px', overflowY:'auto' }}>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, padding:28, maxWidth:560, width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>Novo voo</div>
              <button className="ghost" onClick={() => setShowNew(false)}>✕</button>
            </div>
            {error && <div style={{ marginBottom:12, padding:'8px 12px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}
            <form onSubmit={handleCreateNew}>
              <div style={{ marginBottom:12 }}>
                <label>Nome / rota</label>
                <input required value={missionForm.name} onChange={e=>setMissionForm(f=>({...f,name:e.target.value}))} placeholder="Ex: SP → BH → SP ou só 'Viagem Brasília'" autoFocus />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label>Aeronave</label>
                  <select value={missionForm.aircraftId} onChange={e=>setMissionForm(f=>({...f,aircraftId:e.target.value}))}>
                    <option value="">Selecione...</option>
                    {aircraft.map(a=><option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
                  </select>
                </div>
                <div>
                  <label>Data</label>
                  <input type="date" value={missionForm.dateStart} onChange={e=>setMissionForm(f=>({...f,dateStart:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="submit" className="primary" disabled={saving} style={{ flex:1 }}>
                  {saving ? 'Criando...' : 'Criar e planejar →'}
                </button>
                <button type="button" onClick={() => setShowNew(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function LegAdder({ onAdd, prevDestination }) {
  const [leg, setLeg] = useState({ departureIcao: prevDestination||'', destinationIcao:'', date:'' });
  useEffect(() => { setLeg(l => ({ ...l, departureIcao: prevDestination||'' })); }, [prevDestination]);
  function add() {
    if (!leg.departureIcao || !leg.destinationIcao) return;
    onAdd(leg);
    setLeg({ departureIcao: leg.destinationIcao, destinationIcao:'', date:'' });
  }
  return (
    <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'flex-end' }}>
      <div style={{ flex:1 }}>
        <label style={{ fontSize:10 }}>Saída</label>
        <input value={leg.departureIcao} onChange={e=>setLeg(l=>({...l,departureIcao:e.target.value.toUpperCase()}))} placeholder="SBBR" maxLength={4} style={{ fontFamily:'var(--font-mono)', textTransform:'uppercase', fontSize:12 }} />
      </div>
      <div style={{ flex:1 }}>
        <label style={{ fontSize:10 }}>Destino</label>
        <input value={leg.destinationIcao} onChange={e=>setLeg(l=>({...l,destinationIcao:e.target.value.toUpperCase()}))} placeholder="SBSP" maxLength={4} style={{ fontFamily:'var(--font-mono)', textTransform:'uppercase', fontSize:12 }} />
      </div>
      <div style={{ flex:1 }}>
        <label style={{ fontSize:10 }}>Data</label>
        <input type="date" value={leg.date} onChange={e=>setLeg(l=>({...l,date:e.target.value}))} style={{ fontSize:12 }} />
      </div>
      <button type="button" onClick={add} style={{ padding:'6px 14px', fontSize:11, flexShrink:0, marginBottom:1 }}>+ Perna</button>
    </div>
  );
}

function PaxAdder({ crew, onAdd }) {
  const [pax, setPax] = useState({ name:'', role:'pax', doc:'' });
  function add() {
    if (!pax.name) return;
    onAdd(pax);
    setPax({ name:'', role:'pax', doc:'' });
  }
  return (
    <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'flex-end' }}>
      <div style={{ flex:2 }}>
        <label style={{ fontSize:10 }}>Nome</label>
        {crew.length > 0 ? (
          <select value={pax.name} onChange={e=>{
            const m = crew.find(c=>c.full_name===e.target.value);
            setPax(p=>({...p,name:e.target.value,role:m?.role||p.role}));
          }}>
            <option value="">Selecione ou digite...</option>
            {crew.map(m=><option key={m.id} value={m.full_name}>{m.full_name}</option>)}
          </select>
        ) : (
          <input value={pax.name} onChange={e=>setPax(p=>({...p,name:e.target.value}))} placeholder="Nome completo" style={{ fontSize:12 }} />
        )}
      </div>
      <div style={{ flex:1 }}>
        <label style={{ fontSize:10 }}>Função</label>
        <select value={pax.role} onChange={e=>setPax(p=>({...p,role:e.target.value}))} style={{ fontSize:12 }}>
          <option value="captain">Comandante</option>
          <option value="fo">Co-piloto</option>
          <option value="pax">Passageiro</option>
        </select>
      </div>
      <button type="button" onClick={add} style={{ padding:'6px 14px', fontSize:11, flexShrink:0, marginBottom:1 }}>+ Adicionar</button>
    </div>
  );
}

function PostFlightTab({ journey, aircraft: ac, onNavigate, onReload }) {
  const [costs, setCosts]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!journey) return;
    const ids = [journey.flightId, ...(journey.legFlights||[]).map(f=>f?.id)].filter(Boolean);
    if (ids.length === 0) { setLoading(false); return; }
    // Load costs linked to this journey's flights or mission
    import('../store').then(({ getCosts }) => {
      getCosts().then(all => {
        const relevant = all.filter(c =>
          (c.flightId && ids.includes(c.flightId)) ||
          (c.missionId && c.missionId === journey.missionId)
        );
        setCosts(relevant);
        setLoading(false);
      });
    });
  }, [journey]);

  const flight = journey?.linkedFlight;
  const totalMins = (journey?.legFlights||[]).reduce((s,f)=>s+(f?.flightTimeMinutes||0),0);
  const totalNm   = (journey?.legFlights||[]).reduce((s,f)=>s+parseFloat(f?.distanceNm||0),0);
  const totalCost = costs.reduce((s,c)=>s+parseFloat(c.amountBrl||0),0);

  if (loading) return <div style={{ padding:30, textAlign:'center', color:'var(--text3)', fontSize:12 }}>Carregando...</div>;

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          ['Tempo de voo', fmtHM(totalMins)],
          ['Distância', totalNm > 0 ? `${Math.round(totalNm)} NM` : '—'],
          ['Custo total', fmtBRL(totalCost)],
          ['Custo/hora', totalMins>0&&totalCost>0 ? fmtBRL(totalCost/(totalMins/60)) : '—'],
        ].map(([l,v]) => (
          <div key={l} style={{ background:'var(--bg2)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
            <div style={{ fontSize:18, fontWeight:500, fontFamily:'var(--font-mono)', color:'var(--text1)' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Costs */}
      <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Custos do voo</div>
          <button className="ghost" style={{ fontSize:11 }} onClick={() => onNavigate?.('costs')}>Ver todos os custos →</button>
        </div>
        {costs.length === 0 ? (
          <div style={{ color:'var(--text3)', fontSize:12, padding:'8px 0' }}>Nenhum custo registrado. <button className="ghost" style={{ fontSize:12 }} onClick={() => onNavigate?.('costs')}>Lançar custo →</button></div>
        ) : (
          costs.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
              <div style={{ flex:1, color:'var(--text2)' }}>{c.description || c.category}</div>
              <div style={{ fontFamily:'var(--font-mono)', color:'var(--text1)' }}>{fmtBRL(c.amountBrl)}</div>
            </div>
          ))
        )}
      </div>

      {/* Quick links */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="ghost" style={{ fontSize:12 }} onClick={() => onNavigate?.('logbook')}>
          Diário de Bordo ANAC →
        </button>
        <button className="ghost" style={{ fontSize:12 }} onClick={() => onNavigate?.('engineevents')}>
          Histórico de Motor →
        </button>
        <button className="ghost" style={{ fontSize:12 }} onClick={() => onNavigate?.('costs')}>
          Lançar custo →
        </button>
      </div>
    </div>
  );
}
