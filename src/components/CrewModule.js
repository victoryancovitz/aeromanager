import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getCrewMembers, saveCrewMember, deleteCrewMember, getCrewDocuments, saveCrewDocument, deleteCrewDocument, getSettings, getFlights } from '../store';

const ROLES = { captain:'Comandante (PIC)', fo:'Co-Piloto (SIC)', cabin:'Comissário', dispatcher:'Despachante', pax:'Passageiro frequente' };
const DOC_TYPES = { passport:'Passaporte', anac_license:'Licença ANAC', medical:'Exame Médico (CCF)', type_rating:'Habilitação de Tipo', foreign_validation:'Validação Estrangeira', other:'Outro documento' };
const DOC_ICONS = { passport:'🛂', anac_license:'📋', medical:'🏥', type_rating:'✈', foreign_validation:'🌐', other:'📄' };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function statusForDays(d) {
  if (d === null) return null;
  if (d < 0)   return { color:'var(--red)',   bg:'var(--red-dim)',   label:'Vencido',     dot:'red' };
  if (d <= 30) return { color:'var(--amber)', bg:'var(--amber-dim)', label:`Vence em ${d}d`, dot:'amber' };
  if (d <= 90) return { color:'var(--amber)', bg:'var(--amber-dim)', label:`Vence em ${d}d`, dot:'amber' };
  return { color:'var(--green)', bg:'var(--green-dim)', label:'Válido', dot:'green' };
}

async function extractDocumentViaAI(base64, mediaType, apiKey, docType) {
  const prompts = {
    passport: `Extract from this passport: full_name (SURNAME GIVEN), nationality, dob (YYYY-MM-DD), doc_number, expiry_date (YYYY-MM-DD), issuing_country. Return only JSON.`,
    anac_license: `Extract from this Brazilian ANAC pilot license/extrato: full_name, anac_code, dob (YYYY-MM-DD), ratings (array of {type, expiry_date, function, status}), licenses (array of {type, number, date}), medical_class, medical_expiry (YYYY-MM-DD), english_level, english_expiry (YYYY-MM-DD). Return only JSON.`,
    medical: `Extract from this aviation medical certificate: full_name, medical_class, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, restrictions (array of strings). Return only JSON.`,
    foreign_validation: `Extract from this foreign pilot license validation: full_name, doc_number, issuing_country, issuing_authority, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), aircraft_type, operator, foreign_license_type, foreign_license_number. Return only JSON.`,
    type_rating: `Extract from this type rating certificate: full_name, aircraft_type, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, function (PIC/SIC). Return only JSON.`,
  };
  const prompt = prompts[docType] || `Extract key information from this aviation document. Return only JSON with: doc_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, notes.`;

  const res = await fetch('/api/claude', {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-opus-4-6', max_tokens: 1500,
      messages: [{ role:'user', content: [
        { type:'image', source:{ type:'base64', media_type: mediaType, data: base64 } },
        { type:'text', text: prompt }
      ]}]
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return JSON.parse(text.replace(/```json|```/g,'').trim());
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DocCard({ doc, onDelete }) {
  const d = daysUntil(doc.expiry_date);
  const st = statusForDays(d);
  const rawData = doc.raw_data || {};
  const ratings = rawData.ratings || [];

  return (
    <div style={{ padding:'12px 14px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--border)', marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: ratings.length > 0 ? 10 : 0 }}>
        <span style={{ fontSize:18 }}>{DOC_ICONS[doc.doc_type] || '📄'}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--text1)' }}>{DOC_TYPES[doc.doc_type] || doc.doc_type}</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
            {doc.doc_number && <span style={{ fontFamily:'var(--font-mono)' }}>{doc.doc_number}</span>}
            {doc.issuing_country && <span style={{ marginLeft:8 }}>{doc.issuing_country}</span>}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          {st && (
            <div style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:8, background:st.bg, color:st.color, marginBottom:2 }}>
              {st.label}
            </div>
          )}
          {doc.expiry_date && (
            <div style={{ fontSize:10, color:'var(--text3)' }}>
              {new Date(doc.expiry_date).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
        <button className="danger" style={{ fontSize:10, padding:'3px 8px' }} onClick={() => onDelete(doc.id)}>✕</button>
      </div>

      {/* ANAC ratings */}
      {ratings.length > 0 && (
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:8 }}>
          <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', fontWeight:600, marginBottom:6 }}>Habilitações</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {ratings.map((r, i) => {
              const rd = daysUntil(r.expiry_date);
              const rst = statusForDays(rd);
              return (
                <div key={i} style={{ padding:'3px 8px', borderRadius:6, background: rst ? rst.bg : 'var(--bg3)', border:`1px solid ${rst ? rst.color+'44' : 'var(--border)'}`, fontSize:10 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:500, color: rst ? rst.color : 'var(--text2)' }}>{r.type}</span>
                  {r.expiry_date && <span style={{ color:'var(--text3)', marginLeft:4 }}>{new Date(r.expiry_date).toLocaleDateString('pt-BR',{month:'2-digit',year:'2-digit'})}</span>}
                </div>
              );
            })}
          </div>
          {rawData.english_level && (
            <div style={{ marginTop:6, fontSize:10, color:'var(--text3)' }}>
              Inglês Nível {rawData.english_level}
              {rawData.english_expiry && <span style={{ marginLeft:6 }}>até {new Date(rawData.english_expiry).toLocaleDateString('pt-BR')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExperiencePanel({ member, flights }) {
  const stats = useMemo(() => {
    const myFlights = flights.filter(f => f.logbookNotes?.includes(member.anac_code) || f.pilotId === member.id);
    // Use all flights if this is the "self" member
    const allFlights = member.is_self ? flights : myFlights;

    const now = new Date();
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);

    const recent90 = allFlights.filter(f => new Date(f.date) >= d90);
    const recent30 = allFlights.filter(f => new Date(f.date) >= d30);

    const totalMins = allFlights.reduce((s,f) => s+(f.flightTimeMinutes||0), 0);
    const mins90    = recent90.reduce((s,f) => s+(f.flightTimeMinutes||0), 0);
    const mins30    = recent30.reduce((s,f) => s+(f.flightTimeMinutes||0), 0);
    const ifrMins   = allFlights.reduce((s,f) => s+(f.flightTimeIfr||0), 0);
    const nightMins = allFlights.reduce((s,f) => s+(f.flightTimeNight||0), 0);
    const cycles    = allFlights.reduce((s,f) => s+(f.cycles||1), 0);

    return {
      total: (totalMins/60).toFixed(1),
      h90:   (mins90/60).toFixed(1),
      h30:   (mins30/60).toFixed(1),
      ifr:   (ifrMins/60).toFixed(1),
      night: (nightMins/60).toFixed(1),
      cycles,
      flights: allFlights.length,
    };
  }, [member, flights]);

  return (
    <div style={{ marginTop:14, padding:'12px 14px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--border)' }}>
      <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600, marginBottom:10 }}>Experiência recente (do sistema)</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          { label:'Total', value:`${stats.total}h`, color:'var(--blue)' },
          { label:'Últ. 90 dias', value:`${stats.h90}h`, color: parseFloat(stats.h90) < 3 ? 'var(--amber)' : 'var(--green)' },
          { label:'Últ. 30 dias', value:`${stats.h30}h`, color:'var(--text2)' },
          { label:'IFR', value:`${stats.ifr}h`, color:'var(--purple)' },
          { label:'Noturno', value:`${stats.night}h`, color:'var(--text2)' },
          { label:'Pousos', value:stats.cycles, color:'var(--teal)' },
        ].map(s => (
          <div key={s.label} style={{ textAlign:'center', padding:'8px 4px', background:'var(--bg1)', borderRadius:8, border:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:400, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9.5, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CrewModule({ flights }) {
  const [members, setMembers]   = useState([]);
  const [docs, setDocs]         = useState({});
  const [selected, setSelected] = useState(null);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ full_name:'', role:'captain', nationality:'Brazil', dob:'', anac_code:'', is_self:false, notes:'' });
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm]   = useState({ doc_type:'passport', doc_number:'', issuing_country:'', expiry_date:'', notes:'' });
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [apiKey, setApiKey]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const fileRef = useRef();

  useEffect(() => {
    load();
    getSettings().then(s => setApiKey(s?.apiKey || '')).catch(()=>{});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const list = await getCrewMembers();
      setMembers(list);
      // Load docs for all members
      const allDocs = {};
      await Promise.all(list.map(async m => {
        const d = await getCrewDocuments(m.id);
        allDocs[m.id] = d;
      }));
      setDocs(allDocs);
      if (list.length > 0 && !selected) setSelected(list[0].id);
    } catch(e) {
      if (e.message?.includes('relation') || e.code === '42P01') setError('SQL_MISSING');
    }
    setLoading(false);
  }

  async function saveMember(e) {
    e.preventDefault();
    await saveCrewMember({ ...form, id: editing !== 'new' ? editing : undefined });
    setEditing(null);
    await load();
  }

  async function removeMember(id) {
    if (!window.confirm('Remover tripulante e todos os seus documentos?')) return;
    await deleteCrewMember(id);
    if (selected === id) setSelected(null);
    await load();
  }

  async function removeDoc(id) {
    if (!window.confirm('Remover documento?')) return;
    await deleteCrewDocument(id);
    await load();
  }

  async function handleDocFile(e) {
    const file = e.target.files[0];
    if (!file || !selected) return;
    if (!apiKey) { setError('Configure a chave da API Anthropic no CoPiloto IA primeiro.'); return; }
    setScanning(true);
    setScanProgress('Lendo arquivo...');
    try {
      const b64 = await fileToBase64(file);
      const mt  = file.type || 'application/pdf';
      setScanProgress('IA extraindo dados do documento...');
      const extracted = await extractDocumentViaAI(b64, mt, apiKey, docForm.doc_type);

      // Map extracted fields to docForm
      const mapped = {
        ...docForm,
        crew_member_id: selected,
        doc_number:         extracted.doc_number || extracted.passport_number || docForm.doc_number,
        issuing_country:    extracted.issuing_country || extracted.nationality || docForm.issuing_country,
        issuing_authority:  extracted.issuing_authority || '',
        issue_date:         extracted.issue_date || '',
        expiry_date:        extracted.expiry_date || extracted.medical_expiry || docForm.expiry_date,
        raw_data:           extracted,
      };

      // If ANAC: also update member's anac_code and name
      if (docForm.doc_type === 'anac_license' && extracted.anac_code) {
        const m = members.find(x => x.id === selected);
        if (m && !m.anac_code) {
          await saveCrewMember({ ...m, anac_code: extracted.anac_code });
        }
      }

      await saveCrewDocument(mapped);
      setShowAddDoc(false);
      await load();
    } catch(err) {
      setError(`Erro: ${err.message}`);
    }
    setScanning(false);
    setScanProgress('');
    e.target.value = '';
  }

  async function saveManualDoc(e) {
    e.preventDefault();
    await saveCrewDocument({ ...docForm, crew_member_id: selected });
    setShowAddDoc(false);
    setDocForm({ doc_type:'passport', doc_number:'', issuing_country:'', expiry_date:'', notes:'' });
    await load();
  }

  const selectedMember = members.find(m => m.id === selected);
  const selectedDocs   = selected ? (docs[selected] || []) : [];

  // Alert count across all members
  const totalAlerts = Object.values(docs).flat().filter(d => {
    const d2 = daysUntil(d.expiry_date);
    return d2 !== null && d2 <= 30;
  }).length;

  if (error === 'SQL_MISSING') return (
    <div style={{ padding:24 }}>
      <div style={{ padding:'20px 24px', background:'var(--amber-dim)', border:'1px solid var(--amber)', borderRadius:12, fontSize:13, color:'var(--amber)', lineHeight:1.7 }}>
        <div style={{ fontWeight:600, marginBottom:8 }}>Tabelas não encontradas</div>
        Cole o SQL abaixo no Supabase SQL Editor:
        <pre style={{ marginTop:10, padding:'10px 14px', background:'var(--bg0)', borderRadius:8, fontSize:11, color:'var(--text1)', overflowX:'auto', userSelect:'all', whiteSpace:'pre-wrap' }}>
{`create table if not exists crew_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  full_name text not null,
  display_name text, role text default 'captain',
  nationality text, dob date, anac_code text,
  is_self boolean default false, notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists crew_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  crew_member_id uuid references crew_members(id) on delete cascade not null,
  doc_type text not null, doc_number text,
  issuing_country text, issuing_authority text,
  issue_date date, expiry_date date,
  raw_data jsonb default '{}', notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table crew_members enable row level security;
alter table crew_documents enable row level security;
create policy "users_own_crew_members" on crew_members for all using (auth.uid() = user_id);
create policy "users_own_crew_documents" on crew_documents for all using (auth.uid() = user_id);
create index if not exists idx_crew_members_user on crew_members(user_id);
create index if not exists idx_crew_docs_member on crew_documents(crew_member_id);
create trigger trg_crew_members_updated before update on crew_members for each row execute function update_updated_at();
create trigger trg_crew_documents_updated before update on crew_documents for each row execute function update_updated_at();`}
        </pre>
        <button className="primary" style={{ marginTop:12 }} onClick={() => { setError(''); load(); }}>Recarregar</button>
      </div>
    </div>
  );

  if (editing !== null) return (
    <div style={{ padding:24, maxWidth:540 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>{editing === 'new' ? 'Novo tripulante' : 'Editar tripulante'}</div>
      </div>
      <form onSubmit={saveMember}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div style={{ marginBottom:14 }}><label>Nome completo *</label><input required value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="BORIOLI YANCOVITZ, Victor" /></div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Função</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{Object.entries(ROLES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><label>Código ANAC</label><input value={form.anac_code} onChange={e=>setForm(f=>({...f,anac_code:e.target.value}))} placeholder="128972" /></div>
          </div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Nacionalidade</label><input value={form.nationality} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))} placeholder="Brazil" /></div>
            <div><label>Data de nascimento</label><input type="date" value={form.dob} onChange={e=>setForm(f=>({...f,dob:e.target.value}))} /></div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox" id="is_self" checked={form.is_self} onChange={e=>setForm(f=>({...f,is_self:e.target.checked}))} style={{ width:'auto' }} />
            <label htmlFor="is_self" style={{ textTransform:'none', fontSize:12, marginBottom:0 }}>Este sou eu (piloto proprietário) — vincula meus voos automaticamente</label>
          </div>
        </div>
        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar</button>
          <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Tripulação & Documentos</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
            {members.length} membro(s)
            {totalAlerts > 0 && <span style={{ marginLeft:8, color:'var(--amber)', fontWeight:500 }}>· {totalAlerts} doc(s) vencendo</span>}
          </div>
        </div>
        <button className="primary" onClick={() => { setForm({ full_name:'', role:'captain', nationality:'Brazil', dob:'', anac_code:'', is_self:false, notes:'' }); setEditing('new'); }}>+ Novo tripulante</button>
      </div>

      {error && error !== 'SQL_MISSING' && (
        <div className="alert alert-danger" style={{ marginBottom:16 }}>
          <span>{error}</span><button className="ghost" style={{ marginLeft:'auto' }} onClick={()=>setError('')}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando...</div>
      ) : members.length === 0 ? (
        <div className="card" style={{ padding:'50px 20px', textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12, opacity:.5 }}>👨‍✈️</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:18, marginBottom:8 }}>Nenhum tripulante cadastrado</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>Comece cadastrando seu próprio perfil de piloto</div>
          <button className="primary" onClick={() => { setForm({ full_name:'', role:'captain', nationality:'Brazil', dob:'', anac_code:'', is_self:true, notes:'' }); setEditing('new'); }}>Cadastrar meu perfil</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>

          {/* Left: member list */}
          <div>
            {members.map(m => {
              const mDocs   = docs[m.id] || [];
              const alerts  = mDocs.filter(d => { const d2 = daysUntil(d.expiry_date); return d2 !== null && d2 <= 30; }).length;
              const active  = selected === m.id;
              return (
                <div key={m.id} onClick={() => setSelected(m.id)} style={{ padding:'12px 14px', borderRadius:10, border:`1px solid ${active?'var(--blue-mid)':'var(--border)'}`, background: active?'var(--blue-dim)':'var(--bg1)', cursor:'pointer', marginBottom:8, transition:'all .15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:9, background: m.is_self?'var(--blue-dim)':'var(--bg3)', border:`1px solid ${m.is_self?'var(--blue-mid)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                      {m.role === 'pax' ? '🧑' : '👨‍✈️'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.full_name}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{ROLES[m.role] || m.role}</div>
                    </div>
                    {alerts > 0 && <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--amber)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>{alerts}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: selected member detail */}
          {selectedMember && (
            <div>
              {/* Header */}
              <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
                  <div style={{ width:48, height:48, borderRadius:12, background: selectedMember.is_self?'var(--blue-dim)':'var(--bg3)', border:`1px solid ${selectedMember.is_self?'var(--blue-mid)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                    {selectedMember.role === 'pax' ? '🧑' : '👨‍✈️'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'var(--text1)' }}>{selectedMember.full_name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, display:'flex', gap:12 }}>
                      <span>{ROLES[selectedMember.role]}</span>
                      {selectedMember.anac_code && <span>ANAC {selectedMember.anac_code}</span>}
                      {selectedMember.nationality && <span>{selectedMember.nationality}</span>}
                      {selectedMember.dob && <span>Nasc. {new Date(selectedMember.dob).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={{ fontSize:11, padding:'5px 12px' }} onClick={() => { setForm({...selectedMember}); setEditing(selectedMember.id); }}>Editar</button>
                    <button className="danger" style={{ fontSize:11, padding:'5px 10px' }} onClick={() => removeMember(selectedMember.id)}>✕</button>
                  </div>
                </div>

                {/* Experience panel for self */}
                {selectedMember.is_self && flights.length > 0 && (
                  <ExperiencePanel member={selectedMember} flights={flights} />
                )}
              </div>

              {/* Documents */}
              <div className="card" style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Documentos ({selectedDocs.length})</div>
                  <button style={{ fontSize:11, padding:'5px 12px' }} onClick={() => setShowAddDoc(v=>!v)}>+ Adicionar documento</button>
                </div>

                {/* Add document form */}
                {showAddDoc && (
                  <div style={{ background:'var(--bg2)', borderRadius:10, padding:'14px 16px', marginBottom:14, border:'1px solid var(--border)' }}>
                    <div style={{ marginBottom:12 }}>
                      <label>Tipo de documento</label>
                      <select value={docForm.doc_type} onChange={e=>setDocForm(f=>({...f,doc_type:e.target.value}))}>
                        {Object.entries(DOC_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>

                    {/* Scanner via AI */}
                    {apiKey && (
                      <div style={{ marginBottom:12 }}>
                        <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleDocFile} />
                        <button
                          style={{ width:'100%', padding:'9px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', color:'var(--blue)', borderRadius:8, fontSize:12 }}
                          onClick={() => fileRef.current?.click()}
                          disabled={scanning}
                        >
                          {scanning ? `🧠 ${scanProgress}` : '✦ Escanear documento com IA (foto/PDF)'}
                        </button>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:4, textAlign:'center' }}>A IA extrai automaticamente número, validade, habilitações e outros dados</div>
                      </div>
                    )}

                    <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', marginBottom:10 }}>— ou preencha manualmente —</div>

                    <form onSubmit={saveManualDoc}>
                      <div className="g2" style={{ marginBottom:10 }}>
                        <div><label>Número</label><input value={docForm.doc_number} onChange={e=>setDocForm(f=>({...f,doc_number:e.target.value}))} placeholder="FX883299" /></div>
                        <div><label>País emissor</label><input value={docForm.issuing_country} onChange={e=>setDocForm(f=>({...f,issuing_country:e.target.value}))} placeholder="Brazil" /></div>
                      </div>
                      <div className="g2" style={{ marginBottom:12 }}>
                        <div><label>Emissão</label><input type="date" value={docForm.issue_date||''} onChange={e=>setDocForm(f=>({...f,issue_date:e.target.value}))} /></div>
                        <div><label>Validade *</label><input type="date" required value={docForm.expiry_date} onChange={e=>setDocForm(f=>({...f,expiry_date:e.target.value}))} /></div>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button type="submit" className="primary" style={{ fontSize:12 }}>Salvar</button>
                        <button type="button" style={{ fontSize:12 }} onClick={() => setShowAddDoc(false)}>Cancelar</button>
                      </div>
                    </form>
                  </div>
                )}

                {selectedDocs.length === 0 ? (
                  <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', padding:'20px 0' }}>Nenhum documento cadastrado</div>
                ) : selectedDocs.map(d => (
                  <DocCard key={d.id} doc={d} onDelete={removeDoc} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
