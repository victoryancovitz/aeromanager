import React, { useState, useEffect } from 'react';
import { getMissions, saveMission, deleteMission, getFlights, getCosts } from '../store';
import { AcIcon } from './Instruments';
import IcaoInput from './IcaoInput';

const MISSION_TYPES = [{ v:'round_trip',l:'Bate e volta'},{ v:'multi_leg',l:'Multi-leg'},{ v:'ferry',l:'Posicionamento (ferry)'},{ v:'maintenance',l:'Voo de manutenção'},{ v:'international',l:'Internacional'}];
const PURPOSES = [{ v:'leisure',l:'Lazer / Passeio'},{ v:'transport',l:'Transporte'},{ v:'business',l:'Negócios'},{ v:'training',l:'Instrução'},{ v:'professional',l:'Profissional'}];
const STATUS = [{ v:'planned',l:'Planejado',c:'#4a9eff'},{ v:'in_progress',l:'Em andamento',c:'#f5a623'},{ v:'completed',l:'Concluído',c:'#3dd68c'},{ v:'cancelled',l:'Cancelado',c:'#ff5252'}];

const EMPTY = { name:'', type:'round_trip', status:'planned', aircraftId:'', purpose:'leisure', dateStart:'', dateEnd:'', legs:[], passengers:[], notes:'' };

export default function Missions({ aircraft=[], reload, onGenerateGD }) {
  const [missions, setMissions] = useState([]);
  const [flights, setFlights]   = useState([]);
  const [costs, setCosts]       = useState([]);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [newPax, setNewPax]     = useState({ name:'', doc:'', role:'pax' });
  const [newLeg, setNewLeg]     = useState({ seq:1, departureIcao:'', destinationIcao:'', date:'', flightId:'' });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getMissions(), getFlights(), getCosts()])
      .then(([m, f, c]) => {
        setMissions((m||[]).sort((a,b)=>(b.dateStart||'').localeCompare(a.dateStart||'')));
        setFlights(f||[]);
        setCosts(c||[]);
      })
      .catch(e => console.error('Missions load error:', e))
      .finally(() => setLoading(false));
  }, []);

  function startNew() { setForm({...EMPTY, dateStart:new Date().toISOString().slice(0,10), aircraftId:aircraft[0]?.id||''}); setEditing('new'); }
  function startEdit(m) { setForm({...m}); setEditing(m.id); }
  function cancel() { setEditing(null); }
  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  async function submit(e) { e.preventDefault(); await saveMission(form); reload(); setEditing(null); }
  async function remove(id) { if(window.confirm('Remover missão?')){ await deleteMission(id); reload(); } }

  function addPax() {
    if (!newPax.name) return;
    set('passengers', [...(form.passengers||[]), { ...newPax }]);
    setNewPax({ name:'', doc:'', role:'pax' });
  }
  function removePax(i) { set('passengers', form.passengers.filter((_,idx)=>idx!==i)); }
  function addLeg() {
    const legs = form.legs||[];
    set('legs', [...legs, { ...newLeg, seq: legs.length+1 }]);
    setNewLeg(n=>({ ...n, seq:n.seq+1, departureIcao:n.destinationIcao, destinationIcao:'', flightId:'' }));
  }
  function removeLeg(i) { set('legs', form.legs.filter((_,idx)=>idx!==i)); }

  function getMissionStats(m) {
    const mFlights = m.legs?.map(l=>flights.find(f=>f.id===l.flightId)).filter(Boolean) || [];
    const legCosts = mFlights.flatMap(f=>costs.filter(c=>c.flightId===f.id));
    const totalCost = legCosts.reduce((s,c)=>s+parseFloat(c.amountBrl||0),0);
    const totalMins = mFlights.reduce((s,f)=>s+(f.flightTimeMinutes||0),0);
    const totalNm = mFlights.reduce((s,f)=>s+parseFloat(f.distanceNm||0),0);
    return { totalCost, totalMins, totalNm, legs: m.legs?.length||0 };
  }

  const acFlights = form.aircraftId ? flights.filter(f=>f.aircraftId===form.aircraftId).sort((a,b)=>b.date.localeCompare(a.date)) : [];

  if (loading) return <div style={{ padding:40, color:'#5a6080', textAlign:'center', fontSize:13 }}>Carregando missões...</div>;

  if (editing !== null) return (
    <div style={{ padding:24, maxWidth:720 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={cancel}>← Voltar</button>
        <div style={{ fontSize:16, fontWeight:700 }}>{editing==='new'?'Nova missão':'Editar missão'}</div>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Identificação</div>
          <div style={{ marginBottom:14 }}><label>Nome da missão *</label><input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Viagem SP → BH → RJ → SP" /></div>
          <div className="g3" style={{ marginBottom:14 }}>
            <div><label>Aeronave *</label><select required value={form.aircraftId} onChange={e=>set('aircraftId',e.target.value)}><option value="">Selecione...</option>{aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}</select></div>
            <div><label>Tipo</label><select value={form.type} onChange={e=>set('type',e.target.value)}>{MISSION_TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            <div><label>Status</label><select value={form.status} onChange={e=>set('status',e.target.value)}>{STATUS.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          </div>
          <div className="g3" style={{ marginBottom:14 }}>
            <div><label>Data início</label><input type="date" value={form.dateStart} onChange={e=>set('dateStart',e.target.value)} /></div>
            <div><label>Data fim</label><input type="date" value={form.dateEnd} onChange={e=>set('dateEnd',e.target.value)} /></div>
            <div><label>Finalidade</label><select value={form.purpose} onChange={e=>set('purpose',e.target.value)}>{PURPOSES.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}</select></div>
          </div>
          <div><label>Observações</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Propósito da missão, informações relevantes..." /></div>
        </div>

        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Legs (trechos)</div>
          {(form.legs||[]).map((leg, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#1e2230', borderRadius:8, marginBottom:6 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'#4a9eff22', border:'1px solid #4a9eff44', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#4a9eff', fontWeight:700 }}>{leg.seq}</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{leg.departureIcao} → {leg.destinationIcao}</div>
              {leg.date && <div style={{ fontSize:11, color:'#9aa0b8' }}>{new Date(leg.date+'T12:00:00').toLocaleDateString('pt-BR')}</div>}
              {leg.flightId && <div style={{ fontSize:11 }}><span className="tag tag-ok">Voo vinculado</span></div>}
              <button type="button" className="danger" style={{ marginLeft:'auto', fontSize:11, padding:'3px 8px' }} onClick={()=>removeLeg(i)}>✕</button>
            </div>
          ))}
          <div style={{ background:'#1e2230', borderRadius:8, padding:'12px', marginTop:8 }}>
            <div style={{ fontSize:11, color:'#9aa0b8', marginBottom:8 }}>Adicionar trecho</div>
            <div className="g4" style={{ marginBottom:8 }}>
              <div><IcaoInput label="Origem" value={newLeg.departureIcao} onChange={v=>setNewLeg(n=>({...n,departureIcao:v}))} placeholder="SBSP" /></div>
              <div><IcaoInput label="Destino" value={newLeg.destinationIcao} onChange={v=>setNewLeg(n=>({...n,destinationIcao:v}))} placeholder="SBBH" /></div>
              <div><label>Data</label><input type="date" value={newLeg.date} onChange={e=>setNewLeg(n=>({...n,date:e.target.value}))} /></div>
              <div><label>Voo registrado</label>
                <select value={newLeg.flightId} onChange={e=>setNewLeg(n=>({...n,flightId:e.target.value}))}>
                  <option value="">— Vincular voo —</option>
                  {acFlights.map(f=><option key={f.id} value={f.id}>{f.date} · {f.departureIcao}→{f.destinationIcao}</option>)}
                </select>
              </div>
            </div>
            <button type="button" style={{ fontSize:11, padding:'5px 14px' }} onClick={addLeg}>+ Adicionar trecho</button>
          </div>
        </div>

        <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
          <div className="section-title">Passageiros e tripulação</div>
          {(form.passengers||[]).map((p, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'#1e2230', borderRadius:8, marginBottom:6, fontSize:12 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background: p.role==='crew'?'#4a9eff22':'#9b6dff22', border:`1px solid ${p.role==='crew'?'#4a9eff':'#9b6dff'}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:p.role==='crew'?'#4a9eff':'#9b6dff', fontWeight:700 }}>
                {p.name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1 }}><span style={{ fontWeight:500 }}>{p.name}</span> <span style={{ color:'#5a6080' }}>· {p.doc||'—'}</span></div>
              <span className={`tag ${p.role==='crew'?'tag-bi':'tag-mono'}`} style={{ fontSize:10 }}>{p.role==='crew'?'Tripulação':'PAX'}</span>
              <button type="button" className="danger" style={{ fontSize:11, padding:'3px 8px' }} onClick={()=>removePax(i)}>✕</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <input value={newPax.name} onChange={e=>setNewPax(n=>({...n,name:e.target.value}))} placeholder="Nome" style={{ flex:2 }} />
            <input value={newPax.doc} onChange={e=>setNewPax(n=>({...n,doc:e.target.value}))} placeholder="Doc / CPF / Passaporte" style={{ flex:2 }} />
            <select value={newPax.role} onChange={e=>setNewPax(n=>({...n,role:e.target.value}))} style={{ flex:1 }}><option value="pax">PAX</option><option value="crew">Tripulação</option></select>
            <button type="button" style={{ padding:'8px 14px', fontSize:12, flexShrink:0 }} onClick={addPax}>+ Adicionar</button>
          </div>
        </div>

        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar missão</button>
          <button type="button" onClick={cancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Missões</div>
          <div style={{ color:'#9aa0b8', fontSize:12, marginTop:2 }}>{missions.length} missão(ões) registrada(s)</div>
        </div>
        {aircraft.length>0 && <div style={{display:'flex',gap:8}}>
          {onGenerateGD && <button onClick={onGenerateGD} style={{fontSize:12}}>📄 Gerar GD</button>}
          <button className="primary" onClick={startNew}>+ Nova missão</button>
        </div>}
      </div>

      {missions.length===0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'#5a6080' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🗺</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Nenhuma missão registrada</div>
          <div style={{ fontSize:12, marginBottom:16 }}>Agrupe voos relacionados em uma missão para visualizar o custo total e gerenciar passageiros</div>
          {aircraft.length>0 && <button className="primary" onClick={startNew}>Criar primeira missão</button>}
        </div>
      ) : missions.map(m => {
        const ac = aircraft.find(a=>a.id===m.aircraftId);
        const stats = getMissionStats(m);
        const sc = STATUS.find(s=>s.v===m.status)||STATUS[0];
        const mType = MISSION_TYPES.find(t=>t.v===m.type);
        return (
          <div key={m.id} className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              {ac && <AcIcon type={ac.type} size={40} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{m.name}</div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:600, background:`${sc.c}22`, color:sc.c, border:`1px solid ${sc.c}44` }}>{sc.l}</span>
                </div>
                <div style={{ fontSize:12, color:'#9aa0b8', marginBottom:8 }}>
                  {ac?.registration} · {mType?.l} · {m.dateStart}{m.dateEnd && m.dateEnd!==m.dateStart ? ` → ${m.dateEnd}` : ''}
                </div>
                {m.legs?.length > 0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                    {m.legs.map((leg, i) => (
                      <React.Fragment key={i}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#e8eaf0', fontWeight:600 }}>{leg.departureIcao}</span>
                        <span style={{ color:'#5a6080', fontSize:12 }}>→</span>
                        {i===m.legs.length-1 && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#e8eaf0', fontWeight:600 }}>{leg.destinationIcao}</span>}
                      </React.Fragment>
                    ))}
                    <span style={{ fontSize:11, color:'#5a6080' }}>({m.legs.length} leg{m.legs.length>1?'s':''})</span>
                  </div>
                )}
                {m.passengers?.length > 0 && (
                  <div style={{ fontSize:11, color:'#9aa0b8' }}>
                    {m.passengers.filter(p=>p.role==='crew').length} tripulante(s) · {m.passengers.filter(p=>p.role==='pax').length} passageiro(s)
                  </div>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, flexShrink:0 }}>
                {[
                  { l:'Custo total', v: stats.totalCost > 0 ? `R$ ${Math.round(stats.totalCost).toLocaleString('pt-BR')}` : '—', c:'#4a9eff' },
                  { l:'Tempo total', v: stats.totalMins > 0 ? `${Math.floor(stats.totalMins/60)}h${(stats.totalMins%60).toString().padStart(2,'0')}` : '—', c:'#e8eaf0' },
                  { l:'Distância', v: stats.totalNm > 0 ? `${Math.round(stats.totalNm)}nm` : '—', c:'#9b6dff' },
                ].map(s=>(
                  <div key={s.l} style={{ textAlign:'center', background:'#1e2230', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:9, color:'#5a6080', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{s.l}</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600, color:s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button style={{ fontSize:12, padding:'6px 12px' }} onClick={()=>startEdit(m)}>Editar</button>
                <button className="danger" style={{ fontSize:12, padding:'6px 12px' }} onClick={()=>remove(m.id)}>✕</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
