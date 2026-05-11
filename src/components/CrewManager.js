// CrewManager.js — cadastro de tripulantes e passageiros frequentes com documentos e rates
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';

const ROLE_OPTIONS = [
  { value: 'pic', label: 'P1 / Captain' },
  { value: 'sic', label: 'P2 / First Officer' },
  { value: 'flight_attendant', label: 'Comissária(o)' },
  { value: 'mechanic', label: 'Mecânico' },
  { value: 'passenger', label: 'Passageiro' },
  { value: 'other', label: 'Outro' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));
const ROLE_COLOR = {
  pic: 'var(--blue)', sic: 'var(--purple)',
  flight_attendant: 'var(--green)', mechanic: 'var(--amber)',
  passenger: 'var(--text2)', other: 'var(--text3)',
};

const EMPTY = {
  full_name: '', role: 'pic',
  cpf: '', email: '', phone: '',
  nationality: 'BR', country_birth: '', country_residence: 'BR',
  dob: '', gender: '',
  anac_code: '', license_number: '', license_expiry: '', medical_expiry: '',
  passport_number: '', passport_country: 'BR', passport_issue_date: '', passport_expiry: '',
  us_visa_number: '', us_visa_type: '', us_visa_expiry: '',
  daily_rate_brl: '', daily_rate_usd: '',
  daily_rate_ground_brl: '', daily_rate_ground_usd: '',
  per_diem_domestic_brl: '', per_diem_international_usd: '',
  is_freelance: true, is_active: true, notes: '',
};

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  return parseFloat(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function ValidityBadge({ date, label }) {
  const d = daysUntil(date);
  if (d === null) return null;
  let bg = 'rgba(16,185,129,.1)', border = 'rgba(16,185,129,.4)', color = 'var(--green)', text = `${label} ok`;
  if (d < 0)        { bg='rgba(239,68,68,.12)';  border='rgba(239,68,68,.5)';  color='var(--red)';   text=`${label} vencida há ${Math.abs(d)}d`; }
  else if (d < 90)  { bg='rgba(245,166,35,.12)'; border='rgba(245,166,35,.5)'; color='var(--amber)'; text=`${label} vence em ${d}d`; }
  return (
    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:bg, border:`1px solid ${border}`, color, fontWeight:600 }}>
      {text}
    </span>
  );
}

export default function CrewManager() {
  const [crew, setCrew] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState('id');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const { data, error: e } = await supabase.from('crew_members').select('*').order('full_name');
      if (e) throw e;
      setCrew(data || []);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  function startNew() { setForm({ ...EMPTY }); setEditing('new'); setTab('id'); setError(''); }
  function startEdit(c) {
    setForm({
      full_name: c.full_name || '', role: c.role || 'pic',
      cpf: c.cpf || '', email: c.email || '', phone: c.phone || '',
      nationality: c.nationality || 'BR', country_birth: c.country_birth || '',
      country_residence: c.country_residence || 'BR',
      dob: c.dob || '', gender: c.gender || '',
      anac_code: c.anac_code || '', license_number: c.license_number || '',
      license_expiry: c.license_expiry || '', medical_expiry: c.medical_expiry || '',
      passport_number: c.passport_number || '', passport_country: c.passport_country || 'BR',
      passport_issue_date: c.passport_issue_date || '', passport_expiry: c.passport_expiry || '',
      us_visa_number: c.us_visa_number || '', us_visa_type: c.us_visa_type || '',
      us_visa_expiry: c.us_visa_expiry || '',
      daily_rate_brl: c.daily_rate_brl ?? '', daily_rate_usd: c.daily_rate_usd ?? '',
      daily_rate_ground_brl: c.daily_rate_ground_brl ?? '', daily_rate_ground_usd: c.daily_rate_ground_usd ?? '',
      per_diem_domestic_brl: c.per_diem_domestic_brl ?? '',
      per_diem_international_usd: c.per_diem_international_usd ?? '',
      is_freelance: c.is_freelance !== false, is_active: c.is_active !== false,
      notes: c.notes || '',
    });
    setEditing(c.id); setTab('id'); setError('');
  }
  function cancel() { setEditing(null); setError(''); }

  async function save(e) {
    e.preventDefault(); setError('');
    if (!form.full_name.trim()) { setError('Nome é obrigatório.'); setTab('id'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado.');
      const toNullableDate = v => v ? v : null;
      const toNullableNum = v => v !== '' && v !== null ? parseFloat(v) : null;
      const row = {
        user_id: user.id,
        full_name: form.full_name.trim(),
        role: form.role,
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        nationality: form.nationality.trim() || null,
        country_birth: form.country_birth.trim() || null,
        country_residence: form.country_residence.trim() || null,
        dob: toNullableDate(form.dob),
        gender: form.gender || null,
        anac_code: form.anac_code.trim() || null,
        license_number: form.license_number.trim() || null,
        license_expiry: toNullableDate(form.license_expiry),
        medical_expiry: toNullableDate(form.medical_expiry),
        passport_number: form.passport_number.trim() || null,
        passport_country: form.passport_country.trim() || null,
        passport_issue_date: toNullableDate(form.passport_issue_date),
        passport_expiry: toNullableDate(form.passport_expiry),
        us_visa_number: form.us_visa_number.trim() || null,
        us_visa_type: form.us_visa_type.trim() || null,
        us_visa_expiry: toNullableDate(form.us_visa_expiry),
        daily_rate_brl: toNullableNum(form.daily_rate_brl),
        daily_rate_usd: toNullableNum(form.daily_rate_usd),
        daily_rate_ground_brl: toNullableNum(form.daily_rate_ground_brl),
        daily_rate_ground_usd: toNullableNum(form.daily_rate_ground_usd),
        per_diem_domestic_brl: toNullableNum(form.per_diem_domestic_brl),
        per_diem_international_usd: toNullableNum(form.per_diem_international_usd),
        is_freelance: !!form.is_freelance, is_active: !!form.is_active,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editing === 'new') {
        const { error: err } = await supabase.from('crew_members').insert(row);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('crew_members').update(row).eq('id', editing);
        if (err) throw err;
      }
      setEditing(null);
      await load();
    } catch(err) { setError(err.message); }
    setSaving(false);
  }

  async function remove(id, name) {
    if (!window.confirm(`Remover "${name}"?`)) return;
    setError('');
    try {
      const { error: e } = await supabase.from('crew_members').delete().eq('id', id);
      if (e) throw e;
      await load();
    } catch(err) { setError(err.message); }
  }

  const filtered = useMemo(() => crew.filter(c => {
    if (!showInactive && c.is_active === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.full_name||'').toLowerCase().includes(q)
      || (c.anac_code||'').toLowerCase().includes(q)
      || (c.email||'').toLowerCase().includes(q)
      || (c.passport_number||'').toLowerCase().includes(q)
      || (ROLE_LABEL[c.role]||'').toLowerCase().includes(q);
  }), [crew, search, showInactive]);

  if (editing !== null) {
    const isFreelance = !!form.is_freelance;
    const isPilot = ['pic','sic'].includes(form.role);
    return (
      <div style={{ padding:24, maxWidth:880 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={cancel}>← Voltar</button>
          <div style={{ fontSize:16, fontWeight:700 }}>{editing==='new' ? 'Novo tripulante / passageiro' : 'Editar'}</div>
        </div>

        {error && (
          <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:13 }}>{error}</div>
        )}

        <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid var(--bg2)' }}>
          {[
            {id:'id',  label:'Identificação'},
            {id:'doc', label:'Documentos'},
            ...(isFreelance ? [{id:'rate', label:'Rates'}] : []),
          ].map(t => (
            <button key={t.id} type="button" onClick={()=>setTab(t.id)} style={{
              padding:'8px 16px', border:'none', background:'transparent',
              color: tab===t.id?'var(--blue)':'var(--text3)',
              fontWeight: tab===t.id?600:400, fontSize:12,
              cursor:'pointer', borderBottom: tab===t.id?'2px solid var(--blue)':'2px solid transparent',
              borderRadius:0,
            }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={save}>
          {tab === 'id' && (
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div className="section-title">Identificação</div>
              <div className="g3" style={{ marginBottom:14 }}>
                <div style={{ gridColumn:'1/3' }}><label>Nome completo *</label><input required value={form.full_name} onChange={e=>setForm(f=>({...f, full_name:e.target.value}))} placeholder="SANTOS, Ricardo Mendes" /></div>
                <div><label>Função *</label>
                  <select value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="g3" style={{ marginBottom:14 }}>
                <div><label>CPF</label><input value={form.cpf} onChange={e=>setForm(f=>({...f, cpf:e.target.value}))} placeholder="000.000.000-00" /></div>
                <div><label>E-mail</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} placeholder="freelance@ex.com" /></div>
                <div><label>Telefone</label><input value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} placeholder="+55 11 99999-9999" /></div>
              </div>
              <div className="g3">
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!form.is_freelance} onChange={e=>setForm(f=>({...f, is_freelance:e.target.checked}))} /> Freelance
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f, is_active:e.target.checked}))} /> Ativo
                </label>
                <div></div>
              </div>
              {isFreelance && form.email && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'var(--bg1)', borderRadius:6, fontSize:11, color:'var(--text3)', borderLeft:'3px solid var(--blue)' }}>
                  💡 Opcionalidade de conta: se este freelance criar conta no AeroManager com <strong>{form.email}</strong>, ele será vinculado automaticamente pelo email e poderá ver os voos onde aparece (CIV, pagamentos). Você não precisa fazer nada extra.
                </div>
              )}
            </div>
          )}

          {tab === 'doc' && (
            <>
              {isPilot && (
                <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
                  <div className="section-title">Licença ANAC</div>
                  <div className="g3" style={{ marginBottom:14 }}>
                    <div><label>CANAC</label><input value={form.anac_code} onChange={e=>setForm(f=>({...f, anac_code:e.target.value}))} placeholder="123456" /></div>
                    <div><label>Número da licença</label><input value={form.license_number} onChange={e=>setForm(f=>({...f, license_number:e.target.value}))} placeholder="PLA-..." /></div>
                    <div>
                      <label>Validade da licença</label>
                      <input type="date" value={form.license_expiry} onChange={e=>setForm(f=>({...f, license_expiry:e.target.value}))} />
                      <div style={{ marginTop:4 }}><ValidityBadge date={form.license_expiry} label="Licença" /></div>
                    </div>
                  </div>
                  <div className="g3">
                    <div>
                      <label>Validade do médico (CMA)</label>
                      <input type="date" value={form.medical_expiry} onChange={e=>setForm(f=>({...f, medical_expiry:e.target.value}))} />
                      <div style={{ marginTop:4 }}><ValidityBadge date={form.medical_expiry} label="CMA" /></div>
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
                <div className="section-title">Passaporte</div>
                <div className="g3" style={{ marginBottom:14 }}>
                  <div><label>Número *</label><input value={form.passport_number} onChange={e=>setForm(f=>({...f, passport_number:e.target.value}))} placeholder="FG123456" /></div>
                  <div><label>País emissor *</label><input value={form.passport_country} onChange={e=>setForm(f=>({...f, passport_country:e.target.value}))} placeholder="BR" /></div>
                  <div>
                    <label>Validade *</label>
                    <input type="date" value={form.passport_expiry} onChange={e=>setForm(f=>({...f, passport_expiry:e.target.value}))} />
                    <div style={{ marginTop:4 }}><ValidityBadge date={form.passport_expiry} label="Passaporte" /></div>
                  </div>
                </div>
                <div className="g3" style={{ marginBottom:14 }}>
                  <div><label>Data de emissão</label><input type="date" value={form.passport_issue_date} onChange={e=>setForm(f=>({...f, passport_issue_date:e.target.value}))} /></div>
                  <div><label>Data de nascimento *</label><input type="date" value={form.dob} onChange={e=>setForm(f=>({...f, dob:e.target.value}))} /></div>
                  <div><label>Gênero</label>
                    <select value={form.gender} onChange={e=>setForm(f=>({...f, gender:e.target.value}))}>
                      <option value="">—</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="X">Outro / Não informar</option>
                    </select>
                  </div>
                </div>
                <div className="g3">
                  <div><label>Nacionalidade</label><input value={form.nationality} onChange={e=>setForm(f=>({...f, nationality:e.target.value}))} placeholder="BR" /></div>
                  <div><label>País de nascimento</label><input value={form.country_birth} onChange={e=>setForm(f=>({...f, country_birth:e.target.value}))} placeholder="BR" /></div>
                  <div><label>País de residência</label><input value={form.country_residence} onChange={e=>setForm(f=>({...f, country_residence:e.target.value}))} placeholder="BR" /></div>
                </div>
              </div>

              <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
                <div className="section-title">Visto EUA (para voos internacionais)</div>
                <div className="g3">
                  <div><label>Número do visto</label><input value={form.us_visa_number} onChange={e=>setForm(f=>({...f, us_visa_number:e.target.value}))} placeholder="ex: BR1234567" /></div>
                  <div><label>Tipo</label>
                    <select value={form.us_visa_type} onChange={e=>setForm(f=>({...f, us_visa_type:e.target.value}))}>
                      <option value="">—</option>
                      <option value="B1/B2">B1/B2 (turismo/negócios)</option>
                      <option value="B1">B1 (negócios)</option>
                      <option value="B2">B2 (turismo)</option>
                      <option value="C1/D">C1/D (tripulação)</option>
                      <option value="ESTA">ESTA</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label>Validade</label>
                    <input type="date" value={form.us_visa_expiry} onChange={e=>setForm(f=>({...f, us_visa_expiry:e.target.value}))} />
                    <div style={{ marginTop:4 }}><ValidityBadge date={form.us_visa_expiry} label="Visto" /></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'rate' && isFreelance && (
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div className="section-title">Diárias (rates) e per diem</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:14 }}>
                Valores sugeridos automaticamente ao adicionar este tripulante a um voo. Podem ser sobrescritos.
              </div>
              <div className="section-title" style={{ fontSize:11, marginTop:4 }}>Diária — dia de voo</div>
              <div className="g2" style={{ marginBottom:14 }}>
                <div><label>BRL (R$)</label><input type="number" step="0.01" value={form.daily_rate_brl} onChange={e=>setForm(f=>({...f, daily_rate_brl:e.target.value}))} placeholder="2500.00" /></div>
                <div><label>USD ($)</label><input type="number" step="0.01" value={form.daily_rate_usd} onChange={e=>setForm(f=>({...f, daily_rate_usd:e.target.value}))} placeholder="700.00" /></div>
              </div>
              <div className="section-title" style={{ fontSize:11, marginTop:4 }}>Diária — dia parado (standby)</div>
              <div className="g2" style={{ marginBottom:14 }}>
                <div><label>BRL (R$)</label><input type="number" step="0.01" value={form.daily_rate_ground_brl} onChange={e=>setForm(f=>({...f, daily_rate_ground_brl:e.target.value}))} placeholder="1200.00" /></div>
                <div><label>USD ($)</label><input type="number" step="0.01" value={form.daily_rate_ground_usd} onChange={e=>setForm(f=>({...f, daily_rate_ground_usd:e.target.value}))} placeholder="350.00" /></div>
              </div>
              <div className="section-title" style={{ fontSize:11, marginTop:4 }}>Per diem (hotel + transporte + alimentação)</div>
              <div className="g2">
                <div><label>Doméstico BRL (R$)</label><input type="number" step="0.01" value={form.per_diem_domestic_brl} onChange={e=>setForm(f=>({...f, per_diem_domestic_brl:e.target.value}))} placeholder="800.00" /></div>
                <div><label>Internacional USD ($)</label><input type="number" step="0.01" value={form.per_diem_international_usd} onChange={e=>setForm(f=>({...f, per_diem_international_usd:e.target.value}))} placeholder="215.00" /></div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <label>Notas</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} placeholder="Habilitações, restrições, observações…" />
          </div>

          <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', borderTop:'1px solid var(--bg2)', display:'flex', gap:10 }}>
            <button type="submit" className="primary" disabled={saving}>{saving?'Salvando…':'Salvar'}</button>
            <button type="button" onClick={cancel}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Tripulação & Passageiros</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{crew.filter(c=>c.is_active!==false).length} ativos · {crew.length} total</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input placeholder="Buscar nome, CANAC, passaporte, email…" value={search} onChange={e=>setSearch(e.target.value)} style={{ width:280 }} />
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text3)' }}>
            <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} /> Inativos
          </label>
          <button className="primary" onClick={startNew}>+ Novo</button>
        </div>
      </div>

      {error && (
        <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:13 }}>{error}</div>
      )}

      {loading ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>👥</div>
          <div style={{ fontWeight:600 }}>{search ? 'Ninguém encontrado.' : 'Nenhum cadastro ainda.'}</div>
          {!search && <button className="primary" style={{ marginTop:16 }} onClick={startNew}>+ Adicionar primeiro</button>}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden', padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Nome','Função','CANAC','Passaporte','Validades','Rates','Tipo',''].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:600, color:'var(--text3)', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={()=>startEdit(c)} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', opacity: c.is_active===false?0.5:1 }}>
                  <td style={{ padding:'9px 12px', fontWeight:500 }}>
                    {c.full_name}{c.is_self && <span style={{ marginLeft:6, color:'var(--blue)', fontSize:10 }}>(você)</span>}
                    {c.email && <div style={{ fontSize:10, color:'var(--text3)' }}>{c.email}</div>}
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ color: ROLE_COLOR[c.role] || 'var(--text2)', fontWeight:600 }}>{ROLE_LABEL[c.role] || c.role}</span>
                  </td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{c.anac_code || '—'}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    {c.passport_number ? <>{c.passport_number}<div style={{ color:'var(--text3)', fontSize:10 }}>{c.passport_country || '—'}</div></> : '—'}
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      <ValidityBadge date={c.passport_expiry} label="Pass" />
                      <ValidityBadge date={c.license_expiry} label="Lic" />
                      <ValidityBadge date={c.us_visa_expiry} label="Visto" />
                    </div>
                  </td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    {c.daily_rate_brl || c.daily_rate_usd ? (
                      <>R$ {fmt(c.daily_rate_brl)} / $ {fmt(c.daily_rate_usd)}</>
                    ) : '—'}
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    <span className={`tag tag-${c.is_freelance ? 'warn' : 'ok'}`}>{c.is_freelance ? 'Freelance' : 'Fixo'}</span>
                  </td>
                  <td style={{ padding:'9px 12px' }} onClick={e=>e.stopPropagation()}>
                    <button className="danger" onClick={()=>remove(c.id, c.full_name)} style={{ fontSize:10, padding:'3px 8px' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
