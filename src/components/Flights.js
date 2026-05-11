// Flights.js — v5.40
import React, { useState, useEffect } from 'react';
import { saveFlight, deleteFlight, getFlightCrew, saveFlightCrewMember, deleteFlightCrewMember, generateCrewCostsForFlight } from '../store';
import { supabase } from '../supabase';
import { AcIcon } from './Instruments';
import { useMultiSelect } from '../hooks/useMultiSelect';
import IcaoInput from './IcaoInput';
import FBOModal from './FBOModal';
import LogbookImportWizard from './LogbookImportWizard';

const EMPTY = {
  aircraftId:'', departureIcao:'', destinationIcao:'', alternateIcao:'',
  date:new Date().toISOString().slice(0,10), takeoffUtc:'', landingUtc:'',
  flightTimeMinutes:0, distanceNm:'', fuelAddedLiters:'', fuelPricePerLiter:'',
  cruiseAltitudeFt:'', flightConditions:'vfr', purpose:'leisure', cycles:1,
  logbookNotes:'', autoLaunchCost: true,
  blockOutTime:'', blockInTime:'', blockTimeMinutes:0,
  destinationFbo:'', crewNotes:'',
};

const ROLE_LABEL = {
  pic: 'PIC (Comandante)', sic: 'SIC (Co-piloto)',
  flight_attendant: 'Comissária(o)', mechanic: 'Mecânico',
  passenger: 'Passageiro', other: 'Outro',
};

function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '—';
  return parseFloat(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function calcBlockMins(out, inT, date) {
  if (!out || !inT) return 0;
  const d = (new Date(`${date}T${inT}:00Z`) - new Date(`${date}T${out}:00Z`)) / 60000;
  return d > 0 ? Math.round(d) : 0;
}

export default function Flights({ flights=[], aircraft=[], costs=[], reload, setPage, setPreselFlight }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showLogbookImport, setShowLogbookImport] = useState(false);
  const [timeError, setTimeError] = useState('');
  const [fboAirport, setFboAirport] = useState(null);
  const ms = useMultiSelect(flights);

  function calcMins(t, l) {
    if (!t || !l) return 0;
    const d = (new Date(`${form.date}T${l}:00Z`) - new Date(`${form.date}T${t}:00Z`)) / 60000;
    return d > 0 ? Math.round(d) : 0;
  }

  function set(k, v) {
    setForm(f => {
      const n = {...f, [k]:v};
      if (k==='takeoffUtc' || k==='landingUtc') {
        const dep = k==='takeoffUtc' ? v : f.takeoffUtc;
        const arr = k==='landingUtc' ? v : f.landingUtc;
        if (dep && arr) {
          const mins = calcMins(dep, arr);
          if (mins <= 0) { setTimeError('⚠ Pouso não pode ser antes da decolagem'); n.flightTimeMinutes = 0; }
          else { setTimeError(''); n.flightTimeMinutes = mins; }
        }
      }
      if (k==='blockOutTime' || k==='blockInTime') {
        const bOut = k==='blockOutTime' ? v : f.blockOutTime;
        const bIn  = k==='blockInTime'  ? v : f.blockInTime;
        if (bOut && bIn) n.blockTimeMinutes = calcBlockMins(bOut, bIn, f.date);
      }
      return n;
    });
  }

  function startNew() { setForm({...EMPTY, aircraftId: aircraft[0]?.id||''}); setEditing('new'); setTimeError(''); }
  function startEdit(f) { setForm({...f, autoLaunchCost: false}); setEditing(f.id); setTimeError(''); }
  function cancel() { setEditing(null); setTimeError(''); }

  async function submit(e) {
    e.preventDefault();
    if (timeError) return;
    const saved = await saveFlight({...form, fuelAddedLiters:parseFloat(form.fuelAddedLiters)||0, fuelPricePerLiter:parseFloat(form.fuelPricePerLiter)||0});
    reload(); setEditing(null);
    const fuelCost = (parseFloat(form.fuelAddedLiters)||0)*(parseFloat(form.fuelPricePerLiter)||0);
    if (form.autoLaunchCost && fuelCost > 0) { setPreselFlight(saved); setPage('costs'); }
    else if (!form.autoLaunchCost && window.confirm('Voo salvo! Deseja lançar os custos agora?')) { setPreselFlight(saved); setPage('costs'); }
  }

  async function remove(id) { if(window.confirm('Remover voo?')){ await deleteFlight(id); reload(); } }

  async function bulkDelete() {
    const n = ms.count;
    if (!window.confirm(`Remover ${n} voo${n>1?'s':''}?`)) return;
    setDeleting(true);
    for (const id of ms.selectedIds) await deleteFlight(id);
    ms.clear(); reload(); setDeleting(false);
  }

  const filtered = [...flights].filter(f => {
    if (!search) return true;
    const ac = aircraft.find(a=>a.id===f.aircraftId);
    return [f.departureIcao,f.destinationIcao,f.date,ac?.registration||''].join(' ').toLowerCase().includes(search.toLowerCase());
  }).sort((a,b) => b.date.localeCompare(a.date));

  if (editing !== null) {
    const h = Math.floor(form.flightTimeMinutes/60), m = form.flightTimeMinutes%60;
    const fuelCost = (parseFloat(form.fuelAddedLiters)||0)*(parseFloat(form.fuelPricePerLiter)||0);
    return (
      <div style={{ padding:24, maxWidth:680 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={cancel}>← Voltar</button>
          <div style={{ fontSize:16, fontWeight:700 }}>{editing==='new'?'Registrar voo':'Editar voo'}</div>
        </div>
        <form onSubmit={submit}>
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Dados do voo</div>
            <div className="g3" style={{ marginBottom:14 }}>
              <div><label>Aeronave *</label>
                <select required value={form.aircraftId} onChange={e=>set('aircraftId',e.target.value)}>
                  <option value="">Selecione...</option>
                  {aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
                </select>
              </div>
              <div><label>Data *</label><input type="date" required value={form.date} onChange={e=>set('date',e.target.value)} /></div>
              <div><label>Ciclos</label><input type="number" min="0" value={form.cycles} onChange={e=>set('cycles',parseInt(e.target.value)||1)} /></div>
            </div>
            <div className="g3" style={{ marginBottom:14 }}>
              <div><IcaoInput label="Origem (ICAO) *" required value={form.departureIcao} onChange={v=>set('departureIcao',v)} placeholder="SBBR" /></div>
              <div>
                <IcaoInput label="Destino (ICAO) *" required value={form.destinationIcao}
                  onChange={(v) => set('destinationIcao', v)}
                  placeholder="SBGR"
                />
                {form.destinationIcao && form.destinationIcao.length >= 3 && (
                  <button type="button" onClick={async () => {
                    const icao = form.destinationIcao.toUpperCase();
                    const { data } = await supabase.from('airports_db').select('id, icao, iata, name, city, state, type, lat, lng').eq('icao', icao).maybeSingle();
                    setFboAirport(data || { icao, name: icao });
                  }}
                    style={{ marginTop:4, fontSize:11, padding:'3px 10px', background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:6, cursor:'pointer', color:'var(--accent)', display:'flex', alignItems:'center', gap:4 }}>
                    ⛽ FBO &amp; Combustível
                  </button>
                )}
              </div>
              <div><label>Alternado</label><input value={form.alternateIcao} onChange={e=>set('alternateIcao',e.target.value.toUpperCase())} placeholder="SBSP" maxLength={4} /></div>
            </div>
            <div className="g4" style={{ marginBottom:timeError?4:14 }}>
              <div><label>Block Out (UTC)</label><input type="time" value={form.blockOutTime} onChange={e=>set('blockOutTime',e.target.value)} title="Saída do calço — início do consumo de combustível em solo" /></div>
              <div><label>Decolagem (UTC)</label><input type="time" value={form.takeoffUtc} onChange={e=>set('takeoffUtc',e.target.value)} /></div>
              <div><label>Pouso (UTC)</label><input type="time" value={form.landingUtc} onChange={e=>set('landingUtc',e.target.value)} style={{ borderColor:timeError?'#ef4444':undefined }} /></div>
              <div><label>Block In (UTC)</label><input type="time" value={form.blockInTime} onChange={e=>set('blockInTime',e.target.value)} title="Entrada no calço" /></div>
            </div>
            <div className="g3" style={{ marginBottom:timeError?4:14 }}>
              <div><label>Tempo de voo</label><input readOnly value={form.flightTimeMinutes>0?`${h}h ${m.toString().padStart(2,'0')}min`:'—'} style={{ color:'#4a9eff', fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }} /></div>
              <div><label>Tempo de bloco</label><input readOnly value={form.blockTimeMinutes>0?`${Math.floor(form.blockTimeMinutes/60)}h ${(form.blockTimeMinutes%60).toString().padStart(2,'0')}min`:'—'} style={{ color:'#a78bfa', fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }} /></div>
              <div><label>FBO destino</label><input value={form.destinationFbo||''} onChange={e=>set('destinationFbo',e.target.value)} placeholder="Signature, Atlantic..." /></div>
            </div>
            {timeError && <div style={{ color:'#ef4444', fontSize:12, marginBottom:10 }}>{timeError}</div>}
            <div className="g4" style={{ marginBottom:0 }}>
              <div><label>Condição</label><select value={form.flightConditions} onChange={e=>set('flightConditions',e.target.value)}><option value="vfr">VMC/VFR</option><option value="ifr">IMC/IFR</option><option value="mixed">Misto</option></select></div>
              <div><label>Finalidade</label><select value={form.purpose} onChange={e=>set('purpose',e.target.value)}><option value="leisure">Lazer</option><option value="training">Instrução</option><option value="transport">Transporte</option><option value="professional">Profissional</option></select></div>
              <div><label>Alt. cruzeiro (ft)</label><input type="number" value={form.cruiseAltitudeFt} onChange={e=>set('cruiseAltitudeFt',e.target.value)} placeholder="8500" /></div>
              <div><label>Distância (nm)</label><input type="number" step="0.1" value={form.distanceNm} onChange={e=>set('distanceNm',e.target.value)} placeholder="520" /></div>
            </div>
          </div>
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Combustível</div>
            <div className="g3">
              <div><label>Litros abastecidos</label><input type="number" step="0.1" value={form.fuelAddedLiters} onChange={e=>set('fuelAddedLiters',e.target.value)} placeholder="80" /></div>
              <div><label>Preço por litro (R$)</label><input type="number" step="0.01" value={form.fuelPricePerLiter} onChange={e=>set('fuelPricePerLiter',e.target.value)} placeholder="8.50" /></div>
              <div><label>Custo combustível</label><input readOnly value={fuelCost>0?`R$ ${fuelCost.toFixed(2).replace('.',',')}`:'—'} style={{ color:'#f5a623', fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }} /></div>
            </div>
            {fuelCost>0 && <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:13, color:'var(--text2)', cursor:'pointer' }}><input type="checkbox" checked={form.autoLaunchCost} onChange={e=>set('autoLaunchCost',e.target.checked)} /> Lançar combustível como custo automaticamente ao salvar</label>}
          </div>
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Diário de bordo</div>
            <textarea placeholder="Condições meteorológicas, observações, passageiros, intercorrências..." value={form.logbookNotes} onChange={e=>set('logbookNotes',e.target.value)} />
          </div>

          {editing && editing !== 'new' ? (
            <FlightCrewSection flightId={editing} flightDate={form.date} aircraftId={form.aircraftId} crewNotes={form.crewNotes} onCrewNotesChange={v=>set('crewNotes',v)} />
          ) : (
            <div className="card" style={{ padding:'14px 20px', marginBottom:14 }}>
              <div className="section-title" style={{ marginBottom:6 }}>Tripulação deste voo</div>
              <p style={{ color:'var(--text3)', fontSize:12, margin:0 }}>Salve o voo primeiro para adicionar tripulantes, diárias e per diems.</p>
            </div>
          )}
          <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
            <button type="submit" className="primary" disabled={!!timeError}>Salvar voo</button>
            <button type="button" onClick={cancel}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding:24 }}>
      {ms.count>0 && (
        <div className="bulk-bar">
          <input type="checkbox" checked={ms.allSelected} onChange={ms.toggleAll} style={{ width:15, height:15 }} />
          <span>{ms.count} voo{ms.count>1?'s':''} selecionado{ms.count>1?'s':''}</span>
          <button className="destructive" onClick={bulkDelete} disabled={deleting} style={{ fontSize:12, padding:'5px 14px' }}>{deleting?'Removendo...':`🗑 Remover ${ms.count} voo${ms.count>1?'s':''}`}</button>
          <button className="ghost" onClick={ms.clear} style={{ fontSize:12 }}>Cancelar</button>
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Registro de Voos</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{flights.length} voo(s) registrado(s)</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input placeholder="Buscar rota, matrícula..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:200 }} />
          <button onClick={()=>setShowLogbookImport(true)} title="Importar voos de foto do diário de bordo"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:8, background:'transparent', border:'1px solid var(--blue)', color:'var(--blue)', cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap', transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--blue)';e.currentTarget.style.color='#fff'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--blue)'}}>
            📖 Importar
          </button>
          {aircraft.length>0 && <button className="primary" onClick={startNew}>+ Registrar voo</button>}
        </div>
      </div>
      {filtered.length===0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
          <div style={{ fontWeight:600 }}>Nenhum voo registrado</div>
          {aircraft.length===0?<div style={{ marginTop:8, fontSize:12 }}>Cadastre uma aeronave primeiro</div>:<button className="primary" style={{ marginTop:16 }} onClick={startNew}>Registrar primeiro voo</button>}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden', padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                <th style={{ padding:'9px 14px', width:36 }}><input type="checkbox" checked={ms.allSelected} onChange={ms.toggleAll} style={{ width:14, height:14 }} /></th>
                {['Data','Aeronave','Rota','Duração','Alt.','Combustível','Condição','Custo','Notas',''].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:600, color:'var(--text3)', borderBottom:'1px solid var(--border)', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f=>{
                const ac=aircraft.find(a=>a.id===f.aircraftId);
                const hh=Math.floor((f.flightTimeMinutes||0)/60), mm=(f.flightTimeMinutes||0)%60;
                const fc=costs.filter(c=>c.flightId===f.id).reduce((s,c)=>s+parseFloat(c.amountBrl||0),0);
                const isSel=ms.isSelected(f.id);
                return (
                  <tr key={f.id} className={isSel?'row-selected':''} onClick={()=>startEdit(f)} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                    <td style={{ padding:'9px 14px', width:36 }} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={isSel} onChange={()=>ms.toggle(f.id)} style={{ width:14, height:14 }} /></td>
                    <td style={{ padding:'9px 12px', whiteSpace:'nowrap', fontFamily:'var(--font-mono)', fontSize:12 }}>{new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding:'9px 12px' }}><span className={`tag tag-${ac?.type==='single_engine'?'mono':ac?.type==='multi_engine'?'bi':'exp'}`}>{ac?.registration||'?'}</span></td>
                    <td style={{ padding:'9px 12px', fontWeight:500 }}>{f.departureIcao} → {f.destinationIcao}</td>
                    <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)' }}>{hh}h{mm.toString().padStart(2,'0')}</td>
                    <td style={{ padding:'9px 12px', color:'var(--text3)' }}>{f.cruiseAltitudeFt?`${f.cruiseAltitudeFt}ft`:'—'}</td>
                    <td style={{ padding:'9px 12px', color:'var(--text2)' }}>{f.fuelAddedLiters>0?`${f.fuelAddedLiters}L`:'—'}</td>
                    <td style={{ padding:'9px 12px' }}><span className={`tag tag-${f.flightConditions==='ifr'?'ifr':'vfr'}`}>{(f.flightConditions||'vfr').toUpperCase()}</span></td>
                    <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--blue)', fontWeight:500 }}>{fc>0?`R$${fc.toLocaleString('pt-BR')}`:'—'}</td>
                    <td style={{ padding:'9px 12px', color:'var(--text3)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.logbookNotes||'—'}</td>
                    <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }} onClick={e=>e.stopPropagation()}>
                      <button style={{ fontSize:11, padding:'3px 8px', marginRight:6 }} onClick={()=>startEdit(f)}>Editar</button>
                      <button className="danger" style={{ fontSize:11, padding:'3px 8px' }} onClick={()=>remove(f.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showLogbookImport && <LogbookImportWizard aircraft={aircraft} onClose={()=>setShowLogbookImport(false)} onImported={()=>{setShowLogbookImport(false);reload();}} />}
      {fboAirport && (
        <FBOModal airport={fboAirport} onClose={() => setFboAirport(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tripulação deste voo
// ─────────────────────────────────────────────────────────────────────────────
function FlightCrewSection({ flightId, flightDate, aircraftId, crewNotes, onCrewNotesChange }) {
  const [crewList, setCrewList] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const EMPTY_FC = {
    crew_member_id: '', name_adhoc: '', role: 'pic',
    cost_mode: 'per_day',
    flight_days: 1, ground_days: 0,
    rate_flight_applied: '', rate_ground_applied: '',
    per_diem_applied: '',
    currency: 'BRL',
    total_agreed_amount: '',
    notes: '',
  };
  const [form, setForm] = useState(EMPTY_FC);

  async function load() {
    setLoading(true); setError('');
    try {
      const [fc, mb] = await Promise.all([
        getFlightCrew(flightId),
        supabase.from('crew_members').select('*').eq('is_active', true).order('full_name'),
      ]);
      setCrewList(fc);
      setMembers(mb.data || []);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { if (flightId) load(); }, [flightId]);

  function onSelectMember(id) {
    if (!id) { setForm(f => ({...f, crew_member_id:'', rate_flight_applied:'', rate_ground_applied:'', per_diem_applied:'', currency:'BRL'})); return; }
    const m = members.find(x => x.id === id);
    if (!m) return;
    // Sugere rates do tripulante. Default: BRL se houver, senão USD.
    const useUsd = (!m.daily_rate_brl && m.daily_rate_usd) || (!m.per_diem_domestic_brl && m.per_diem_international_usd);
    setForm(f => ({
      ...f,
      crew_member_id: id,
      name_adhoc: '',
      role: m.role || 'pic',
      currency: useUsd ? 'USD' : 'BRL',
      rate_flight_applied: useUsd ? (m.daily_rate_usd || '') : (m.daily_rate_brl || ''),
      rate_ground_applied: useUsd ? (m.daily_rate_ground_usd || '') : (m.daily_rate_ground_brl || ''),
      per_diem_applied: useUsd ? (m.per_diem_international_usd || '') : (m.per_diem_domestic_brl || ''),
    }));
  }

  function previewTotal(f) {
    const fd = parseInt(f.flight_days || 0) || 0;
    const gd = parseInt(f.ground_days || 0) || 0;
    const rf = parseFloat(f.rate_flight_applied || 0) || 0;
    const rg = parseFloat(f.rate_ground_applied || 0) || 0;
    const pd = parseFloat(f.per_diem_applied || 0) || 0;
    const ag = parseFloat(f.total_agreed_amount || 0) || 0;
    const totalDays = fd + gd;
    const base = f.cost_mode === 'total_agreed' ? ag : (rf * fd + rg * gd);
    return Math.round((base + pd * totalDays) * 100) / 100;
  }

  async function addCrew(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!form.crew_member_id && !form.name_adhoc.trim()) {
      setError('Selecione um tripulante ou informe um nome ad-hoc.'); return;
    }
    try {
      await saveFlightCrewMember({
        flight_id: flightId,
        crew_member_id: form.crew_member_id || null,
        name_adhoc: form.crew_member_id ? null : form.name_adhoc.trim(),
        role: form.role,
        cost_mode: form.cost_mode,
        flight_days: parseInt(form.flight_days) || 0,
        ground_days: parseInt(form.ground_days) || 0,
        rate_flight_applied: form.cost_mode === 'per_day' && form.rate_flight_applied !== '' ? parseFloat(form.rate_flight_applied) : null,
        rate_ground_applied: form.cost_mode === 'per_day' && form.rate_ground_applied !== '' ? parseFloat(form.rate_ground_applied) : null,
        per_diem_applied: form.per_diem_applied !== '' ? parseFloat(form.per_diem_applied) : null,
        total_agreed_amount: form.cost_mode === 'total_agreed' && form.total_agreed_amount !== '' ? parseFloat(form.total_agreed_amount) : null,
        currency: form.currency || 'BRL',
        notes: form.notes.trim() || null,
      });
      setForm(EMPTY_FC);
      setShowAdd(false);
      await load();
    } catch(err) { setError(err.message); }
  }

  async function removeCrew(id) {
    if (!window.confirm('Remover este tripulante do voo?')) return;
    setError(''); setInfo('');
    try { await deleteFlightCrewMember(id); await load(); }
    catch(err) { setError(err.message); }
  }

  async function generateCosts() {
    if (!window.confirm('Gerar lançamentos de custo em Custos? Lançamentos auto-gerados anteriores deste voo serão substituídos.')) return;
    setGenBusy(true); setError(''); setInfo('');
    try {
      const n = await generateCrewCostsForFlight({ flightId, aircraftId, flightDate });
      setInfo(`✓ ${n} lançamento(s) de custo criado(s) na categoria 'crew'.`);
    } catch(err) { setError(err.message); }
    setGenBusy(false);
  }

  const totalBRL = crewList.reduce((s, c) => {
    const cost = parseFloat(c.total_cost || 0);
    const fx = c.currency === 'USD' ? 5.0 : 1.0;
    return s + cost * fx;
  }, 0);

  const isAgreed = form.cost_mode === 'total_agreed';
  const tPreview = previewTotal(form);

  return (
    <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div className="section-title" style={{ margin:0 }}>
          Tripulação deste voo
          {!loading && crewList.length > 0 && (
            <span style={{ marginLeft:10, fontWeight:400, fontSize:11, color:'var(--text3)' }}>
              {crewList.length} pessoa(s) · custo total ~ R$ {totalBRL.toLocaleString('pt-BR',{maximumFractionDigits:0})}
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {crewList.length > 0 && (
            <button type="button" onClick={generateCosts} disabled={genBusy} style={{ fontSize:12 }}>
              💰 {genBusy?'Gerando…':'Gerar lançamentos de custo'}
            </button>
          )}
          {!showAdd && <button type="button" className="secondary" onClick={() => setShowAdd(true)} style={{ fontSize:12 }}>+ Adicionar</button>}
        </div>
      </div>

      {error && (
        <div style={{ padding:'8px 12px', marginBottom:10, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:12 }}>{error}</div>
      )}
      {info && (
        <div style={{ padding:'8px 12px', marginBottom:10, background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.3)', borderRadius:6, color:'var(--green)', fontSize:12 }}>{info}</div>
      )}

      {loading ? (
        <div style={{ color:'var(--text3)', fontSize:12, padding:'10px 0' }}>Carregando…</div>
      ) : crewList.length === 0 && !showAdd ? (
        <div style={{ color:'var(--text3)', fontSize:12, padding:'14px 0', textAlign:'center' }}>
          Nenhum tripulante cadastrado neste voo.
        </div>
      ) : crewList.length > 0 && (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom: showAdd ? 12 : 0 }}>
          <thead>
            <tr style={{ background:'var(--bg2)' }}>
              {['Nome','Função','Modo','D.voo','D.solo','Rate voo','Rate solo','Per diem','Combinado','Moeda','Total','Notas',''].map(h => (
                <th key={h} style={{ padding:'7px 8px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crewList.map(c => (
              <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 8px', fontWeight:500 }}>{c.crew_member?.full_name || c.name_adhoc || '—'}</td>
                <td style={{ padding:'8px 8px' }}><span className="tag tag-mono">{ROLE_LABEL[c.role] || c.role}</span></td>
                <td style={{ padding:'8px 8px' }}>
                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'var(--bg1)', color: c.cost_mode==='total_agreed'?'var(--purple)':'var(--blue)', fontWeight:600 }}>
                    {c.cost_mode==='total_agreed' ? 'Combinado' : 'Por dia'}
                  </span>
                </td>
                <td style={{ padding:'8px 8px', textAlign:'right', fontFamily:'var(--font-mono)' }}>{c.flight_days ?? '—'}</td>
                <td style={{ padding:'8px 8px', textAlign:'right', fontFamily:'var(--font-mono)' }}>{c.ground_days ?? '—'}</td>
                <td style={{ padding:'8px 8px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmtMoney(c.rate_flight_applied)}</td>
                <td style={{ padding:'8px 8px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmtMoney(c.rate_ground_applied)}</td>
                <td style={{ padding:'8px 8px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmtMoney(c.per_diem_applied)}</td>
                <td style={{ padding:'8px 8px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmtMoney(c.total_agreed_amount)}</td>
                <td style={{ padding:'8px 8px', textAlign:'center' }}>{c.currency || 'BRL'}</td>
                <td style={{ padding:'8px 8px', textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--blue)', fontWeight:600 }}>
                  {c.currency==='USD'?'$':'R$'} {parseFloat(c.total_cost||0).toLocaleString('pt-BR',{maximumFractionDigits:0})}
                </td>
                <td style={{ padding:'8px 8px', color:'var(--text3)', fontSize:11, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.notes || '—'}</td>
                <td style={{ padding:'8px 8px', textAlign:'right' }}>
                  <button type="button" className="danger" onClick={() => removeCrew(c.id)} style={{ fontSize:10, padding:'3px 8px' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd && (
        <form onSubmit={addCrew} style={{ marginTop:8, padding:14, background:'var(--bg0)', border:'1px solid var(--blue)', borderRadius:8 }}>
          <div className="section-title" style={{ color:'var(--blue)', marginBottom:10 }}>Adicionar tripulante</div>
          <div className="g3" style={{ marginBottom:10 }}>
            <div><label>Tripulante cadastrado</label>
              <select value={form.crew_member_id} onChange={e=>onSelectMember(e.target.value)}>
                <option value="">— ou informe ad-hoc abaixo —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name} {m.anac_code?`(${m.anac_code})`:''}</option>)}
              </select>
            </div>
            <div><label>Ou nome ad-hoc</label><input value={form.name_adhoc} onChange={e=>setForm(f=>({...f, name_adhoc:e.target.value, crew_member_id:''}))} placeholder="Nome do tripulante" disabled={!!form.crew_member_id} /></div>
            <div><label>Função *</label>
              <select required value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
                {Object.entries(ROLE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="g3" style={{ marginBottom:10 }}>
            <div><label>Modo de cobrança</label>
              <select value={form.cost_mode} onChange={e=>setForm(f=>({...f, cost_mode:e.target.value}))}>
                <option value="per_day">Por dia (rate × dias)</option>
                <option value="total_agreed">Valor combinado (total fechado)</option>
              </select>
            </div>
            <div><label>Moeda</label>
              <select value={form.currency} onChange={e=>setForm(f=>({...f, currency:e.target.value}))}>
                <option value="BRL">BRL (R$)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div style={{ alignSelf:'end', textAlign:'right' }}>
              <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>Total estimado</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--blue)', fontFamily:'var(--font-mono)' }}>
                {form.currency==='USD'?'$':'R$'} {tPreview.toLocaleString('pt-BR',{maximumFractionDigits:0})}
              </div>
            </div>
          </div>

          <div className="g4" style={{ marginBottom:10 }}>
            <div><label>Dias de voo</label><input type="number" min="0" step="1" value={form.flight_days} onChange={e=>setForm(f=>({...f, flight_days:e.target.value}))} /></div>
            <div><label>Dias em solo</label><input type="number" min="0" step="1" value={form.ground_days} onChange={e=>setForm(f=>({...f, ground_days:e.target.value}))} /></div>
            <div><label>Per diem (por dia)</label><input type="number" step="0.01" value={form.per_diem_applied} onChange={e=>setForm(f=>({...f, per_diem_applied:e.target.value}))} placeholder="0.00" /></div>
            <div style={{ alignSelf:'end', fontSize:11, color:'var(--text3)' }}>
              {form.flight_days || 0}+{form.ground_days || 0} = <strong style={{ color:'var(--text2)' }}>{(parseInt(form.flight_days||0)||0)+(parseInt(form.ground_days||0)||0)}d</strong>
            </div>
          </div>

          {!isAgreed ? (
            <div className="g3" style={{ marginBottom:10 }}>
              <div><label>Rate diário voo</label><input type="number" step="0.01" value={form.rate_flight_applied} onChange={e=>setForm(f=>({...f, rate_flight_applied:e.target.value}))} placeholder="0.00" /></div>
              <div><label>Rate diário solo</label><input type="number" step="0.01" value={form.rate_ground_applied} onChange={e=>setForm(f=>({...f, rate_ground_applied:e.target.value}))} placeholder="0.00" /></div>
              <div></div>
            </div>
          ) : (
            <div className="g3" style={{ marginBottom:10 }}>
              <div style={{ gridColumn:'1/3' }}><label>Valor combinado (total fechado, sem per diem)</label><input type="number" step="0.01" value={form.total_agreed_amount} onChange={e=>setForm(f=>({...f, total_agreed_amount:e.target.value}))} placeholder="0.00" /></div>
              <div style={{ alignSelf:'end', fontSize:10, color:'var(--text3)' }}>Per diem é somado por cima.</div>
            </div>
          )}

          <div style={{ marginBottom:10 }}><label>Notas</label><input value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} placeholder="ex: hotel + transfer incluso" /></div>
          <div style={{ display:'flex', gap:8 }}>
            <button type="submit" className="primary" style={{ fontSize:12 }}>Adicionar</button>
            <button type="button" onClick={() => { setShowAdd(false); setError(''); setForm(EMPTY_FC); }} style={{ fontSize:12 }}>Cancelar</button>
          </div>
        </form>
      )}

      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)' }}>
        <label style={{ fontSize:11, color:'var(--text3)' }}>Observações da tripulação</label>
        <textarea value={crewNotes||''} onChange={e=>onCrewNotesChange(e.target.value)} placeholder="Hotel utilizado, transfer, intercorrências…" style={{ minHeight:50, fontSize:12 }} />
      </div>
    </div>
  );
}