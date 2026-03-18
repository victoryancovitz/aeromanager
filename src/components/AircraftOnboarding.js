import React, { useState } from 'react';
import { saveAircraft, saveMaintenance, saveCost, getAircraft } from '../store';
import { supabase } from '../supabase';

// ── Fluxo de etapas por perfil ────────────────────────────────
const PROFILE_FLOWS = {
  owner_pilot: {
    steps: ['profile','aircraft','history','docs','costs','done'],
    label: 'Proprietário-Piloto',
  },
  owner_hired_pilot: {
    steps: ['profile','aircraft','history','docs','costs','hired_pilot','done'],
    label: 'Proprietário com Piloto',
  },
  co_owner: {
    steps: ['profile','aircraft','history','docs','co_owners','costs','split_rules','done'],
    label: 'Co-proprietário',
  },
  managed: {
    steps: ['profile','aircraft','history','docs','manager','costs','done'],
    label: 'Gerenciada por Terceiro',
  },
  authorized_pilot: {
    steps: ['profile','find_aircraft','request_access','done'],
    label: 'Piloto Autorizado',
  },
};

const STEP_META = {
  profile:         { icon: '👤', label: 'Perfil'          },
  aircraft:        { icon: '✈',  label: 'Aeronave'        },
  history:         { icon: '📋', label: 'Histórico'       },
  docs:            { icon: '📄', label: 'Documentação'    },
  costs:           { icon: '💰', label: 'Custos fixos'    },
  hired_pilot:     { icon: '🧑‍✈️', label: 'Piloto'         },
  co_owners:       { icon: '🤝', label: 'Sócios'          },
  split_rules:     { icon: '⚖️', label: 'Rateio'          },
  manager:         { icon: '🏢', label: 'Gerenciadora'    },
  find_aircraft:   { icon: '🔍', label: 'Buscar aeronave' },
  request_access:  { icon: '🔑', label: 'Solicitar acesso'},
  done:            { icon: '✅', label: 'Concluído'       },
};

const PROFILES = [
  {
    id: 'owner_pilot',
    icon: '🧑‍✈️',
    title: 'Proprietário-Piloto',
    desc: 'Sou o único dono e também piloto.',
    details: 'Você cadastra a aeronave, custos e voa tudo sozinho.',
    steps_preview: ['Aeronave','Histórico','Documentação','Custos fixos'],
  },
  {
    id: 'owner_hired_pilot',
    icon: '👔',
    title: 'Proprietário com piloto contratado',
    desc: 'Sou dono mas o piloto é outra pessoa.',
    details: 'Você controla finanças. O piloto tem acesso operacional.',
    steps_preview: ['Aeronave','Histórico','Documentação','Custos','Piloto contratado'],
  },
  {
    id: 'co_owner',
    icon: '🤝',
    title: 'Co-proprietário (condomínio)',
    desc: 'Somos 2 ou mais donos da mesma aeronave.',
    details: 'Cadastra os sócios com % de propriedade e regras de rateio de custos.',
    steps_preview: ['Aeronave','Histórico','Documentação','Sócios','Custos','Rateio'],
  },
  {
    id: 'managed',
    icon: '🏢',
    title: 'Gerenciada por terceiro',
    desc: 'Uma empresa ou pessoa gerencia por mim.',
    details: 'A gerenciadora cuida do operacional. Você acompanha relatórios.',
    steps_preview: ['Aeronave','Histórico','Documentação','Gerenciadora','Custos'],
  },
  {
    id: 'authorized_pilot',
    icon: '🛫',
    title: 'Piloto autorizado (não sou dono)',
    desc: 'Tenho permissão para voar a aeronave de outra pessoa.',
    details: 'Busca a aeronave pelo prefixo e solicita acesso ao proprietário.',
    steps_preview: ['Buscar aeronave','Solicitar acesso'],
  },
];

const CONDITION_OPTIONS = [
  { id: 'new',           label: 'Nova (0h)',            desc: 'Saída de fábrica ou reconstruída com zero horas' },
  { id: 'low_time',      label: 'Baixas horas (<500h)', desc: 'Pouco uso, tudo dentro do prazo' },
  { id: 'mid_life',      label: 'Mid-life',             desc: 'Motor e hélice com 30–70% do TBO utilizados' },
  { id: 'high_time',     label: 'High-time',            desc: 'Próxima do TBO, inspeções recentes em dia' },
  { id: 'post_overhaul', label: 'Pós-revisão geral',    desc: 'Motor recém revisado (0 TSO)' },
];

const EMPTY_AIRCRAFT = {
  registration: '', type: 'single_engine', manufacturer: '', model: '', year: '',
  engineModel: '', engineTboHours: 2000, propModel: '', propTboHours: 2400,
  baseAirframeHours: 0, fuelType: 'avgas_100ll', fuelCapacityLiters: '',
  homeBase: '', monthlyFixed: 0,
};

// ── Helpers ───────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

function buildMxItems(aircraftId, hours, condition, form) {
  const items = [];
  const airframe = parseFloat(hours.airframe) || 0;
  const tbo = parseFloat(form.engineTboHours) || 2000;
  const engTso = parseFloat(hours.engineTso) || 0;
  const isNew = condition === 'new';

  const last100h = parseFloat(hours.lastInsp100h) || (airframe - 80);
  const next100h = last100h + 100;
  items.push({
    aircraftId, itemType:'inspection', name:'Inspeção 100h',
    intervalHours:100, lastDoneHours: last100h,
    nextDueHours: next100h,
    status: next100h <= airframe ? 'overdue' : (next100h - airframe < 20 ? 'due_soon' : 'current'),
    estimatedCostBrl: 3500,
  });

  const lastAnnual = hours.lastInspAnnual || '';
  items.push({
    aircraftId, itemType:'inspection', name:'Inspeção Anual (ANAC)',
    intervalDays:365, lastDoneDate: lastAnnual || null,
    nextDueDate: lastAnnual ? addDays(lastAnnual, 365) : null,
    status: lastAnnual ? 'current' : 'overdue',
    estimatedCostBrl: 4800,
  });

  if (!isNew && engTso > 0) {
    items.push({
      aircraftId, itemType:'inspection', name:`TBO Motor — ${form.engineModel || 'Motor'}`,
      intervalHours: tbo, lastDoneHours: airframe - engTso,
      nextDueHours: (airframe - engTso) + tbo,
      status: engTso >= tbo ? 'overdue' : (tbo - engTso < 200 ? 'due_soon' : 'current'),
      estimatedCostBrl: 45000,
      notes: `TSO atual: ${engTso.toFixed(1)}h — restam ${(tbo - engTso).toFixed(1)}h`,
    });
  }

  const propTso = parseFloat(hours.propTso) || 0;
  const propTbo = parseFloat(form.propTboHours) || 2400;
  if (!isNew && propTso > 0) {
    items.push({
      aircraftId, itemType:'inspection', name:`TBO Hélice — ${form.propModel || 'Hélice'}`,
      intervalHours: propTbo, lastDoneHours: airframe - propTso,
      nextDueHours: (airframe - propTso) + propTbo,
      status: propTso >= propTbo ? 'overdue' : 'current',
      estimatedCostBrl: 8500,
    });
  }

  items.push({
    aircraftId, itemType:'inspection', name:'Troca de Óleo 50h',
    intervalHours:50, lastDoneHours: airframe - 10,
    nextDueHours: airframe + 40,
    status:'current', estimatedCostBrl:420,
  });

  return items;
}

// ── Progress bar ──────────────────────────────────────────────
function StepBar({ steps, current }) {
  const visSteps = steps.filter(s => s !== 'done');
  const curIdx   = visSteps.indexOf(current);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:28, overflowX:'auto', paddingBottom:4 }}>
      {visSteps.map((sid, i) => {
        const meta   = STEP_META[sid] || { icon:'•', label: sid };
        const done   = i < curIdx;
        const active = i === curIdx;
        return (
          <div key={sid} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{
                width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: done ? 13 : 15,
                background: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--bg3)',
                color: done || active ? '#fff' : 'var(--text3)',
                fontWeight:600, transition:'all .2s', border: active ? '2px solid var(--blue-mid)' : '2px solid transparent',
              }}>
                {done ? '✓' : meta.icon}
              </div>
              <div style={{ fontSize:9, color: active ? 'var(--blue)' : done ? 'var(--green)' : 'var(--text3)', fontWeight: active ? 600 : 400, whiteSpace:'nowrap', maxWidth:64, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis' }}>
                {meta.label}
              </div>
            </div>
            {i < visSteps.length - 1 && (
              <div style={{ width:28, height:2, background: done ? 'var(--green)' : 'var(--border)', margin:'0 2px', marginBottom:18, flexShrink:0, transition:'background .3s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function AircraftOnboarding({ onClose, onComplete }) {
  const [profile,     setProfile]   = useState(null);
  const [step,        setStep]      = useState('profile');
  const [form,        setForm]      = useState(EMPTY_AIRCRAFT);
  const [condition,   setCond]      = useState(null);
  const [hours,       setHours]     = useState({ airframe:'', engineTsn:'', engineTso:'', propTso:'', lastInsp100h:'', lastInspAnnual:'' });
  const [fixedCosts,  setFixed]     = useState([
    { category:'hangar',    description:'Hangar mensal', amount:'', vendor:'' },
    { category:'insurance', description:'Seguro aeronáutico', amount:'', vendor:'' },
  ]);
  // Profile-specific states
  const [hiredPilot,  setHiredPilot] = useState({ name:'', email:'', anac_code:'', notes:'' });
  const [coOwners,    setCoOwners]   = useState([
    { name:'', email:'', share_pct:'', role:'owner' },
    { name:'', email:'', share_pct:'', role:'owner' },
  ]);
  const [splitRules,  setSplitRules] = useState({ fixed:'equal', variable:'proportional_hours' });
  const [manager,     setManager]    = useState({ name:'', email:'', phone:'', notes:'', accessLevel:'operational' });
  const [findReg,     setFindReg]    = useState('');
  const [foundAc,     setFoundAc]    = useState(null);
  const [findError,   setFindError]  = useState('');
  const [requestMsg,  setRequestMsg] = useState('');
  const [saving,      setSaving]     = useState(false);
  const [error,       setError]      = useState('');
  const [savedAc,     setSavedAc]    = useState(null);

  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  function setH(k,v) { setHours(h=>({...h,[k]:v})); }

  const flow = profile ? PROFILE_FLOWS[profile.id] : null;

  function next() {
    if (!flow) return;
    const idx = flow.steps.indexOf(step);
    if (idx < flow.steps.length - 1) setStep(flow.steps[idx+1]);
  }
  function back() {
    if (!flow) return;
    const idx = flow.steps.indexOf(step);
    if (idx > 0) setStep(flow.steps[idx-1]);
    else { setProfile(null); setStep('profile'); }
  }

  function selectProfile(p) {
    setProfile(p);
    setStep(PROFILE_FLOWS[p.id].steps[1]); // skip profile step, go to first real step
  }

  const isNew = condition === 'new';
  const isLastStep = flow && step === flow.steps[flow.steps.length - 2]; // step before 'done'

  // Validation per step
  const canNext = {
    profile:        !!profile,
    aircraft:       !!form.registration && !!form.manufacturer && !!form.model,
    history:        !!condition,
    docs:           true,
    costs:          true,
    hired_pilot:    !!hiredPilot.name,
    co_owners:      coOwners.filter(o=>o.name&&o.share_pct).length >= 2,
    split_rules:    true,
    manager:        !!manager.name,
    find_aircraft:  !!foundAc,
    request_access: true,
  };

  async function handleSave() {
    setSaving(true); setError('');
    try {
      // Save aircraft (not for authorized_pilot)
      if (profile.id !== 'authorized_pilot') {
        const ac = await saveAircraft({
          registration: form.registration, type: form.type || 'single_engine',
          manufacturer: form.manufacturer, model: form.model,
          year: parseInt(form.year) || null,
          engineModel: form.engineModel || null,
          engineTboHours: parseFloat(form.engineTboHours) || 2000,
          propModel: form.propModel || null,
          propTboHours: parseFloat(form.propTboHours) || 2400,
          baseAirframeHours: parseFloat(hours.airframe) || 0,
          totalFlightHours: parseFloat(hours.airframe) || 0,
          totalEngineHours: parseFloat(hours.engineTsn) || parseFloat(hours.airframe) || 0,
          fuelType: form.fuelType || 'avgas_100ll',
          fuelCapacityLiters: parseFloat(form.fuelCapacityLiters) || null,
          homeBase: form.homeBase || null,
          monthlyFixed: parseFloat(form.monthlyFixed) || 0,
          isActive: true,
        });
        setSavedAc(ac);

        // Save MX plan
        const mxItems = buildMxItems(ac.id, hours, condition, form);
        for (const mx of mxItems) await saveMaintenance(mx);

        // Save fixed costs
        for (const c of fixedCosts) {
          if (!c.amount || parseFloat(c.amount) <= 0) continue;
          await saveCost({ aircraftId: ac.id, category: c.category, costType:'fixed',
            amountBrl: parseFloat(c.amount), description: c.description,
            vendor: c.vendor, referenceDate: new Date().toISOString().slice(0,10),
            recurrence: 'monthly' });
        }

        // Save co-owners if co_owner profile
        if (profile.id === 'co_owner') {
          for (const co of coOwners.filter(o=>o.name&&o.share_pct)) {
            await supabase.from('aircraft_co_owners').insert({
              aircraft_id: ac.id,
              display_name: co.name,
              email: co.email || null,
              share_pct: parseFloat(co.share_pct),
              role: co.role || 'owner',
            });
          }
        }
      }
      setStep('done');
      onComplete?.();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  async function handleFindAircraft() {
    setFindError(''); setFoundAc(null);
    const reg = findReg.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (!reg) return;
    try {
      const { data } = await supabase.from('aircraft').select('id,registration,manufacturer,model,year').ilike('registration', `%${reg}%`).limit(5);
      if (data && data.length > 0) setFoundAc(data[0]);
      else setFindError('Aeronave não encontrada. O proprietário precisa cadastrá-la primeiro.');
    } catch(e) { setFindError(e.message); }
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'24px 16px' }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:18, width:'100%', maxWidth:680, padding:'26px 30px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <div style={{ width:42, height:42, borderRadius:11, background:'var(--blue-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>✈</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:20 }}>
              {profile ? `Cadastrar aeronave — ${profile.title}` : 'Cadastrar nova aeronave'}
            </div>
            {profile && (
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
                {PROFILE_FLOWS[profile.id].steps.filter(s=>s!=='done').length} etapas para o seu perfil
              </div>
            )}
          </div>
          <button className="ghost" onClick={onClose} style={{ fontSize:17 }}>✕</button>
        </div>

        {/* Progress bar (only after profile selected) */}
        {profile && step !== 'done' && (
          <StepBar steps={PROFILE_FLOWS[profile.id].steps} current={step} />
        )}

        {error && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
            {error}
          </div>
        )}

        {/* ── STEP: PROFILE ─────────────────────────────────── */}
        {step === 'profile' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Qual é a sua relação com esta aeronave?</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              Cada perfil tem um fluxo específico — só pedimos o que você precisa.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {PROFILES.map(p => (
                <div key={p.id} onClick={() => selectProfile(p)}
                  style={{ padding:'14px 18px', borderRadius:12, border:`1.5px solid var(--border)`, background:'var(--bg2)', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:14, transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.background='var(--blue-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg2)'; }}>
                  <span style={{ fontSize:26, flexShrink:0, marginTop:1 }}>{p.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'var(--text1)', marginBottom:2 }}>{p.title}</div>
                    <div style={{ fontSize:12, color:'var(--text2)', marginBottom:5 }}>{p.desc}</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {p.steps_preview.map(s => (
                        <span key={s} style={{ fontSize:9.5, padding:'2px 8px', borderRadius:10, background:'var(--bg3)', color:'var(--text3)', border:'1px solid var(--border)' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{ color:'var(--text3)', fontSize:18, flexShrink:0 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: AIRCRAFT ────────────────────────────────── */}
        {step === 'aircraft' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:16 }}>Dados da aeronave</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label>Prefixo (matrícula) *</label>
                <input value={form.registration} onChange={e=>set('registration',e.target.value.toUpperCase())} placeholder="PP-ABC" style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, letterSpacing:2 }} autoFocus />
              </div>
              <div>
                <label>Tipo</label>
                <select value={form.type} onChange={e=>set('type',e.target.value)}>
                  <option value="single_engine">Monomotor</option>
                  <option value="multi_engine">Bimotor</option>
                  <option value="turboprop">Turboélice</option>
                  <option value="jet">Jato</option>
                  <option value="helicopter">Helicóptero</option>
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Fabricante *</label><input value={form.manufacturer} onChange={e=>set('manufacturer',e.target.value)} placeholder="Cessna, Piper..." /></div>
              <div><label>Modelo *</label><input value={form.model} onChange={e=>set('model',e.target.value)} placeholder="172S, PA-28..." /></div>
              <div><label>Ano</label><input type="number" value={form.year} onChange={e=>set('year',e.target.value)} placeholder="2019" min={1940} max={2030} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Motor</label><input value={form.engineModel} onChange={e=>set('engineModel',e.target.value)} placeholder="Lycoming IO-360..." /></div>
              <div><label>TBO do motor (horas)</label><input type="number" value={form.engineTboHours} onChange={e=>set('engineTboHours',e.target.value)} placeholder="2000" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Hélice</label><input value={form.propModel} onChange={e=>set('propModel',e.target.value)} placeholder="McCauley, Hartzell..." /></div>
              <div><label>TBO da hélice (horas)</label><input type="number" value={form.propTboHours} onChange={e=>set('propTboHours',e.target.value)} placeholder="2400" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div>
                <label>Combustível</label>
                <select value={form.fuelType} onChange={e=>set('fuelType',e.target.value)}>
                  <option value="avgas_100ll">Avgas 100LL</option>
                  <option value="jet_a1">Jet A-1</option>
                </select>
              </div>
              <div><label>Capacidade (L)</label><input type="number" value={form.fuelCapacityLiters} onChange={e=>set('fuelCapacityLiters',e.target.value)} placeholder="212" /></div>
              <div><label>Base (ICAO)</label><input value={form.homeBase} onChange={e=>set('homeBase',e.target.value.toUpperCase())} placeholder="SBMT" maxLength={4} style={{ fontFamily:'var(--font-mono)' }} /></div>
            </div>
          </div>
        )}

        {/* ── STEP: HISTORY ─────────────────────────────────── */}
        {step === 'history' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>Estado da aeronave na compra/aquisição</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>Gera o plano de manutenção inicial automaticamente.</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
              {CONDITION_OPTIONS.map(c => (
                <div key={c.id} onClick={() => setCond(c.id)}
                  style={{ padding:'12px 16px', borderRadius:10, border:`1.5px solid ${condition===c.id?'var(--blue)':'var(--border)'}`, background:condition===c.id?'var(--blue-dim)':'var(--bg2)', cursor:'pointer', transition:'all .15s' }}>
                  <div style={{ fontWeight:600, fontSize:12, color:condition===c.id?'var(--blue)':'var(--text1)', marginBottom:3 }}>{c.label}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{c.desc}</div>
                </div>
              ))}
            </div>
            {condition && condition !== 'new' && (
              <div style={{ padding:'16px 20px', background:'var(--bg2)', borderRadius:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>Horas na compra</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label>Horas totais da célula</label><input type="number" value={hours.airframe} onChange={e=>setH('airframe',e.target.value)} placeholder="3240" style={{ fontFamily:'var(--font-mono)' }} /></div>
                  <div><label>Horas TSO do motor</label><input type="number" value={hours.engineTso} onChange={e=>setH('engineTso',e.target.value)} placeholder="820" style={{ fontFamily:'var(--font-mono)' }} /></div>
                  <div><label>Horas TSO da hélice</label><input type="number" value={hours.propTso} onChange={e=>setH('propTso',e.target.value)} placeholder="820" style={{ fontFamily:'var(--font-mono)' }} /></div>
                  <div><label>Horas desde última 100h</label><input type="number" value={hours.lastInsp100h} onChange={e=>setH('lastInsp100h',e.target.value)} placeholder="3200" style={{ fontFamily:'var(--font-mono)' }} /></div>
                  <div><label>Data da última inspeção anual</label><input type="date" value={hours.lastInspAnnual} onChange={e=>setH('lastInspAnnual',e.target.value)} /></div>
                </div>
                {hours.airframe && hours.engineTso && (
                  <div style={{ marginTop:12, padding:'8px 12px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:11, color:'var(--blue)' }}>
                    ✓ Motor: <strong>{(parseFloat(form.engineTboHours||2000)-parseFloat(hours.engineTso||0)).toFixed(0)}h restantes</strong> até TBO
                    {parseFloat(hours.airframe) - parseFloat(hours.lastInsp100h||0) > 100 && <span style={{ color:'var(--red)', marginLeft:12 }}>⚠ 100h vencida</span>}
                  </div>
                )}
              </div>
            )}
            {condition === 'new' && (
              <div style={{ padding:'12px 16px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:10, fontSize:12, color:'var(--green)' }}>
                ✓ Aeronave nova — plano de manutenção iniciará do zero.
              </div>
            )}
          </div>
        )}

        {/* ── STEP: DOCS ────────────────────────────────────── */}
        {step === 'docs' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>Documentação obrigatória</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>Você vai adicionar os documentos após o cadastro em <strong>Documentos da Aeronave</strong>. Por ora, veja o checklist:</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { doc:'CVA', detail:'Validade anual — emitido pela ANAC após inspeção', urgency:'high' },
                { doc:'Matrícula ANAC', detail:'Permanente — transferir ao vender', urgency:'low' },
                { doc:'Seguro RETA', detail:'Obrigatório por lei — validade anual', urgency:'high' },
                { doc:'Licença de Rádio (ANATEL)', detail:'Validade 2 anos', urgency:'medium' },
                { doc:'Manual de Voo (POH/AFM)', detail:'Obrigatório a bordo — importar via POH Importer', urgency:'medium' },
                { doc:'Certificação Transponder', detail:'A cada 24 meses', urgency:'medium' },
              ].map((d,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:9, background:'var(--bg2)', border:'1px solid var(--border)' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: d.urgency==='high'?'var(--amber)':d.urgency==='medium'?'var(--blue)':'var(--green)', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{d.doc}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{d.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, padding:'10px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:12, color:'var(--blue)' }}>
              💡 Use <strong>Importar docs em lote</strong> para fazer upload de todos de uma vez — a IA lê e preenche automaticamente.
            </div>
          </div>
        )}

        {/* ── STEP: COSTS ───────────────────────────────────── */}
        {step === 'costs' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>Custos fixos mensais</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>Lançados automaticamente todo mês no módulo financeiro.</div>
            {fixedCosts.map((c, i) => (
              <div key={i} style={{ padding:'14px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', marginBottom:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:8 }}>
                  <div><label style={{ fontSize:11 }}>Descrição</label><input value={c.description} onChange={e => setFixed(f => f.map((x,j)=>j===i?{...x,description:e.target.value}:x))} /></div>
                  <div><label style={{ fontSize:11 }}>Valor mensal (R$)</label><input type="number" value={c.amount} onChange={e => setFixed(f => f.map((x,j)=>j===i?{...x,amount:e.target.value}:x))} placeholder="0,00" style={{ fontFamily:'var(--font-mono)' }} /></div>
                </div>
                <div><label style={{ fontSize:11 }}>Fornecedor</label><input value={c.vendor} onChange={e => setFixed(f => f.map((x,j)=>j===i?{...x,vendor:e.target.value}:x))} placeholder="Aeroporto, seguradora..." /></div>
              </div>
            ))}
            <button className="ghost" style={{ fontSize:12, marginTop:4 }} onClick={() => setFixed(f => [...f, { category:'other', description:'', amount:'', vendor:'' }])}>
              + Adicionar custo fixo
            </button>
            {fixedCosts.some(c => parseFloat(c.amount) > 0) && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:12, color:'var(--blue)' }}>
                Total fixo mensal: R$ {fixedCosts.reduce((s,c)=>s+parseFloat(c.amount||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: HIRED PILOT ─────────────────────────────── */}
        {step === 'hired_pilot' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Piloto contratado</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              Dados do piloto que vai operar a aeronave. Ele receberá acesso ao módulo operacional (voos, combustível, manutenção).
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Nome completo *</label><input value={hiredPilot.name} onChange={e=>setHiredPilot(p=>({...p,name:e.target.value}))} placeholder="Carlos Eduardo Mendes" autoFocus /></div>
              <div><label>E-mail (para convite)</label><input type="email" value={hiredPilot.email} onChange={e=>setHiredPilot(p=>({...p,email:e.target.value}))} placeholder="piloto@email.com" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Código ANAC / Habilitação</label><input value={hiredPilot.anac_code} onChange={e=>setHiredPilot(p=>({...p,anac_code:e.target.value}))} placeholder="CHT-0045678" style={{ fontFamily:'var(--font-mono)' }} /></div>
              <div>
                <label>Acesso</label>
                <select value={hiredPilot.accessLevel||'operational'} onChange={e=>setHiredPilot(p=>({...p,accessLevel:e.target.value}))}>
                  <option value="operational">Operacional (voos, combustível, MX)</option>
                  <option value="full">Completo (inclui custos)</option>
                  <option value="flight_only">Somente voos</option>
                </select>
              </div>
            </div>
            <div><label>Observações</label><textarea rows={2} value={hiredPilot.notes} onChange={e=>setHiredPilot(p=>({...p,notes:e.target.value}))} placeholder="Notas sobre o contrato, horários, etc." /></div>
            <div style={{ marginTop:14, padding:'10px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:12, color:'var(--blue)' }}>
              💡 O convite será enviado por e-mail quando a funcionalidade multi-usuário for lançada (v6.x). Por enquanto o cadastro é registrado localmente.
            </div>
          </div>
        )}

        {/* ── STEP: CO-OWNERS ───────────────────────────────── */}
        {step === 'co_owners' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Sócios da aeronave</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              Informe todos os co-proprietários e a percentagem de cada um. Total deve ser 100%.
            </div>
            {coOwners.map((co, i) => (
              <div key={i} style={{ padding:'14px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--blue)', flexShrink:0 }}>{i+1}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>Sócio {i+1}</div>
                  {coOwners.length > 2 && (
                    <button className="ghost" style={{ marginLeft:'auto', fontSize:11, color:'var(--red)' }} onClick={() => setCoOwners(l=>l.filter((_,j)=>j!==i))}>Remover</button>
                  )}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
                  <div><label style={{ fontSize:11 }}>Nome *</label><input value={co.name} onChange={e=>setCoOwners(l=>l.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Nome completo" /></div>
                  <div><label style={{ fontSize:11 }}>Cota (%)</label><input type="number" min="1" max="100" value={co.share_pct} onChange={e=>setCoOwners(l=>l.map((x,j)=>j===i?{...x,share_pct:e.target.value}:x))} placeholder="50" style={{ fontFamily:'var(--font-mono)', fontWeight:600 }} /></div>
                  <div>
                    <label style={{ fontSize:11 }}>Papel</label>
                    <select value={co.role} onChange={e=>setCoOwners(l=>l.map((x,j)=>j===i?{...x,role:e.target.value}:x))}>
                      <option value="owner">Proprietário</option>
                      <option value="investor">Investidor</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop:8 }}><label style={{ fontSize:11 }}>E-mail</label><input type="email" value={co.email} onChange={e=>setCoOwners(l=>l.map((x,j)=>j===i?{...x,email:e.target.value}:x))} placeholder="email@exemplo.com" /></div>
              </div>
            ))}
            <button className="ghost" style={{ fontSize:12, marginTop:4 }} onClick={() => setCoOwners(l=>[...l,{name:'',email:'',share_pct:'',role:'owner'}])}>+ Adicionar sócio</button>
            {(() => {
              const total = coOwners.reduce((s,c) => s + parseFloat(c.share_pct||0), 0);
              return (
                <div style={{ marginTop:14, padding:'10px 14px', background: Math.abs(total-100) < 0.1 ? 'var(--green-dim)' : 'var(--amber-dim)', border:`1px solid ${Math.abs(total-100) < 0.1 ? 'var(--green-mid)' : 'var(--amber-mid)'}`, borderRadius:8, fontSize:12, color: Math.abs(total-100) < 0.1 ? 'var(--green)' : 'var(--amber)', fontWeight:600 }}>
                  {Math.abs(total-100) < 0.1 ? `✓ Total: ${total}% — perfeito!` : `Total atual: ${total}% — precisa somar 100%`}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── STEP: SPLIT RULES ─────────────────────────────── */}
        {step === 'split_rules' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Regras de rateio de custos</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              Como os custos serão divididos entre os {coOwners.filter(c=>c.name).length} sócios?
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { key:'fixed', label:'Custos fixos', example:'Hangar, seguro, anuidades, inspeção anual', options:[
                  { value:'equal', label:'Dividir igualmente (pela cota %)', desc:'Cada sócio paga proporcional à sua participação' },
                  { value:'absolute_equal', label:'Dividir em partes iguais', desc:'Cada sócio paga o mesmo valor independente da cota' },
                ]},
                { key:'variable', label:'Custos variáveis', example:'Combustível, inspeção 100h, troca de óleo', options:[
                  { value:'proportional_hours', label:'Proporcional às horas voadas', desc:'Quem voou mais paga mais — o mais justo' },
                  { value:'equal', label:'Dividir pela cota %', desc:'Ignora quem voou — divide pela participação' },
                ]},
              ].map(rule => (
                <div key={rule.key} style={{ padding:'16px 18px', borderRadius:12, background:'var(--bg2)', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{rule.label}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>Exemplos: {rule.example}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {rule.options.map(opt => (
                      <div key={opt.value} onClick={() => setSplitRules(r=>({...r,[rule.key]:opt.value}))}
                        style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', borderRadius:9, border:`1.5px solid ${splitRules[rule.key]===opt.value?'var(--blue)':'var(--border)'}`, background:splitRules[rule.key]===opt.value?'var(--blue-dim)':'transparent', cursor:'pointer', transition:'all .15s' }}>
                        <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${splitRules[rule.key]===opt.value?'var(--blue)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                          {splitRules[rule.key]===opt.value && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--blue)' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:500, color:splitRules[rule.key]===opt.value?'var(--blue)':'var(--text1)' }}>{opt.label}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{opt.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: MANAGER ─────────────────────────────────── */}
        {step === 'manager' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Empresa/pessoa gerenciadora</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              Quem vai operar e gerenciar a aeronave por você? Terá acesso operacional conforme sua configuração.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Nome da empresa ou pessoa *</label><input value={manager.name} onChange={e=>setManager(m=>({...m,name:e.target.value}))} placeholder="AeroManage Ltda" autoFocus /></div>
              <div><label>E-mail</label><input type="email" value={manager.email} onChange={e=>setManager(m=>({...m,email:e.target.value}))} placeholder="contato@gerenciadora.com.br" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label>Telefone</label><input value={manager.phone} onChange={e=>setManager(m=>({...m,phone:e.target.value}))} placeholder="+55 11 99999-9999" /></div>
              <div>
                <label>Nível de acesso</label>
                <select value={manager.accessLevel} onChange={e=>setManager(m=>({...m,accessLevel:e.target.value}))}>
                  <option value="operational">Operacional (voos, MX, combustível)</option>
                  <option value="full">Completo (inclui custos e documentos)</option>
                  <option value="readonly">Somente leitura (relatórios)</option>
                </select>
              </div>
            </div>
            <div><label>Observações / Contrato</label><textarea rows={3} value={manager.notes} onChange={e=>setManager(m=>({...m,notes:e.target.value}))} placeholder="Número do contrato, vigência, responsabilidades..." /></div>
            <div style={{ marginTop:14, padding:'10px 14px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:12, color:'var(--amber)' }}>
              ⚠ O convite e controle de acesso multi-usuário serão ativados na v6.x. Os dados ficam registrados para quando a funcionalidade for lançada.
            </div>
          </div>
        )}

        {/* ── STEP: FIND AIRCRAFT ───────────────────────────── */}
        {step === 'find_aircraft' && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Buscar a aeronave pelo prefixo</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              O proprietário já precisa ter cadastrado a aeronave no AeroManager. Digite o prefixo para buscá-la.
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              <input
                value={findReg}
                onChange={e => setFindReg(e.target.value.toUpperCase())}
                placeholder="PP-ABC"
                style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:18, letterSpacing:3, flex:1 }}
                onKeyDown={e => e.key === 'Enter' && handleFindAircraft()}
                autoFocus
              />
              <button className="primary" onClick={handleFindAircraft} style={{ padding:'0 24px', fontSize:13 }}>Buscar</button>
            </div>
            {findError && <div style={{ padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)', marginBottom:12 }}>{findError}</div>}
            {foundAc && (
              <div style={{ padding:'16px 18px', borderRadius:12, background:'var(--green-dim)', border:'1.5px solid var(--green-mid)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:28 }}>✈</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, fontFamily:'var(--font-mono)' }}>{foundAc.registration}</div>
                    <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{foundAc.manufacturer} {foundAc.model} {foundAc.year && `· ${foundAc.year}`}</div>
                    <div style={{ fontSize:11, color:'var(--green)', marginTop:4 }}>✓ Aeronave encontrada — prossiga para solicitar acesso</div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop:16, padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--text3)' }}>
              Aeronave não está cadastrada? Peça ao proprietário para registrá-la no AeroManager e te adicionar como piloto autorizado.
            </div>
          </div>
        )}

        {/* ── STEP: REQUEST ACCESS ──────────────────────────── */}
        {step === 'request_access' && foundAc && (
          <div>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>Solicitar acesso</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
              Sua solicitação será enviada ao proprietário da <strong>{foundAc.registration}</strong>.
            </div>
            <div style={{ padding:'14px 18px', background:'var(--bg2)', borderRadius:12, border:'1px solid var(--border)', marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>Aeronave</div>
              <div style={{ fontWeight:700, fontSize:16, fontFamily:'var(--font-mono)' }}>{foundAc.registration}</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>{foundAc.manufacturer} {foundAc.model}</div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label>Tipo de acesso que você precisa</label>
              <select>
                <option value="captain">Piloto Comandante — voos, combustível, MX operacional</option>
                <option value="fo">Copiloto / Segundo piloto</option>
                <option value="mechanic">Mecânico — somente manutenção</option>
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label>Mensagem para o proprietário (opcional)</label>
              <textarea rows={3} value={requestMsg} onChange={e=>setRequestMsg(e.target.value)} placeholder="Olá, sou o piloto contratado da sua aeronave e preciso de acesso para registrar voos..." />
            </div>
            <div style={{ padding:'10px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:12, color:'var(--blue)' }}>
              💡 O sistema de convites multi-usuário será lançado na v6.x. Por enquanto, este pedido fica registrado e o proprietário poderá ativar seu acesso quando disponível.
            </div>
          </div>
        )}

        {/* ── STEP: DONE ────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:60, marginBottom:14 }}>🎉</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--green)', marginBottom:8 }}>
              {profile?.id === 'authorized_pilot' ? 'Solicitação enviada!' : `${form.registration || 'Aeronave'} cadastrada!`}
            </div>
            <div style={{ fontSize:13, color:'var(--text3)', marginBottom:28, lineHeight:2 }}>
              {profile?.id === 'owner_pilot' && <>✈ Aeronave criada<br/>🔧 Plano de manutenção gerado<br/>💰 Custos fixos configurados</>}
              {profile?.id === 'owner_hired_pilot' && <>✈ Aeronave criada<br/>🧑‍✈️ Piloto contratado registrado<br/>💰 Custos fixos configurados</>}
              {profile?.id === 'co_owner' && <>✈ Aeronave criada<br/>🤝 {coOwners.filter(c=>c.name).length} sócios cadastrados<br/>⚖️ Regras de rateio configuradas</>}
              {profile?.id === 'managed' && <>✈ Aeronave criada<br/>🏢 Gerenciadora registrada<br/>💰 Custos fixos configurados</>}
              {profile?.id === 'authorized_pilot' && <>🔑 Solicitação de acesso registrada<br/>Aguarde o proprietário aprovar seu acesso.</>}
            </div>
            {profile?.id !== 'authorized_pilot' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
                {[
                  { icon:'📄', label:'Adicionar documentos',     action:'aircraft_docs' },
                  { icon:'📖', label:'Importar POH com IA',      action:'poh' },
                  { icon:'🧾', label:'Escanear NF combustível',  action:'receipt' },
                  { icon:'✈', label:'Registrar primeiro voo',    action:'flights' },
                ].map(item => (
                  <button key={item.action} className="ghost"
                    style={{ padding:'12px 14px', borderRadius:10, fontSize:12, display:'flex', alignItems:'center', gap:10 }}
                    onClick={() => onComplete?.()}>
                    <span style={{ fontSize:20 }}>{item.icon}</span>
                    <span style={{ flex:1, textAlign:'left' }}>{item.label}</span>
                    <span style={{ color:'var(--text3)' }}>→</span>
                  </button>
                ))}
              </div>
            )}
            <button className="primary" style={{ padding:'12px 40px', fontSize:14 }} onClick={onClose}>
              Ir para o Dashboard →
            </button>
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────── */}
        {step !== 'profile' && step !== 'done' && (
          <div style={{ display:'flex', gap:10, marginTop:24, paddingTop:18, borderTop:'1px solid var(--border)' }}>
            <button onClick={back} style={{ padding:'10px 18px', fontSize:13 }}>← Voltar</button>
            <div style={{ flex:1 }} />
            <button className="primary"
              onClick={isLastStep ? handleSave : next}
              disabled={!canNext[step] || saving}
              style={{ padding:'10px 28px', fontSize:13 }}>
              {saving ? 'Salvando...' : isLastStep ? '✓ Criar aeronave' : 'Próximo →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
