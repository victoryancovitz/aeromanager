// Flights.js — v5.40
import React, { useState } from 'react';
import { saveFlight, deleteFlight } from '../store';
import { AcIcon } from './Instruments';
import { useMultiSelect } from '../hooks/useMultiSelect';
import IcaoInput from './IcaoInput';
import LogbookImportWizard from './LogbookImportWizard';

const EMPTY = {
  aircraftId:'', departureIcao:'', destinationIcao:'', alternateIcao:'',
  date:new Date().toISOString().slice(0,10), takeoffUtc:'', landingUtc:'',
  flightTimeMinutes:0, distanceNm:'', fuelAddedLiters:'', fuelPricePerLiter:'',
  cruiseAltitudeFt:'', flightConditions:'vfr', purpose:'leisure', cycles:1,
  logbookNotes:'', autoLaunchCost: true
};

export default function Flights({ flights=[], aircraft=[], costs=[], reload, setPage, setPreselFlight }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showLogbookImport, setShowLogbookImport] = useState(false);
  const [timeError, setTimeError] = useState('');
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
              <div><IcaoInput label="Destino (ICAO) *" required value={form.destinationIcao} onChange={v=>set('destinationIcao',v)} placeholder="SBGR" /></div>
              <div><label>Alternado</label><input value={form.alternateIcao} onChange={e=>set('alternateIcao',e.target.value.toUpperCase())} placeholder="SBSP" maxLength={4} /></div>
            </div>
            <div className="g3" style={{ marginBottom:timeError?4:14 }}>
              <div><label>Decolagem (UTC)</label><input type="time" value={form.takeoffUtc} onChange={e=>set('takeoffUtc',e.target.value)} /></div>
              <div><label>Pouso (UTC)</label><input type="time" value={form.landingUtc} onChange={e=>set('landingUtc',e.target.value)} style={{ borderColor:timeError?'#ef4444':undefined }} /></div>
              <div><label>Tempo de voo</label><input readOnly value={form.flightTimeMinutes>0?`${h}h ${m.toString().padStart(2,'0')}min`:'—'} style={{ color:'#4a9eff', fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }} /></div>
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
          <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
            <div className="section-title">Diário de bordo</div>
            <textarea placeholder="Condições meteorológicas, observações, passageiros, intercorrências..." value={form.logbookNotes} onChange={e=>set('logbookNotes',e.target.value)} />
          </div>
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
    </div>
  );
}