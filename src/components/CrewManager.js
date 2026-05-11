// CrewManager.js — cadastro de tripulantes (pilotos, comissárias, mecânicos) com rates/per diem
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const ROLE_OPTIONS = [
  { value: 'pic', label: 'Comandante (PIC)' },
  { value: 'sic', label: 'Co-piloto (SIC)' },
  { value: 'flight_attendant', label: 'Comissária(o)' },
  { value: 'mechanic', label: 'Mecânico' },
  { value: 'other', label: 'Outro' },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));
const ROLE_COLOR = {
  pic: 'var(--blue)', sic: 'var(--purple)', flight_attendant: 'var(--green)',
  mechanic: 'var(--amber)', other: 'var(--text3)',
};

const EMPTY = {
  full_name: '', role: 'pic', anac_code: '', cpf: '', email: '', phone: '',
  daily_rate_brl: '', daily_rate_usd: '',
  per_diem_domestic_brl: '', per_diem_international_usd: '',
  is_freelance: true, is_active: true, notes: '',
};

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  return parseFloat(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function CrewManager() {
  const [crew, setCrew] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
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

  function startNew() { setForm({ ...EMPTY }); setEditing('new'); setError(''); }
  function startEdit(c) {
    setForm({
      full_name: c.full_name || '',
      role: c.role || 'pic',
      anac_code: c.anac_code || '',
      cpf: c.cpf || '',
      email: c.email || '',
      phone: c.phone || '',
      daily_rate_brl: c.daily_rate_brl ?? '',
      daily_rate_usd: c.daily_rate_usd ?? '',
      per_diem_domestic_brl: c.per_diem_domestic_brl ?? '',
      per_diem_international_usd: c.per_diem_international_usd ?? '',
      is_freelance: c.is_freelance !== false,
      is_active: c.is_active !== false,
      notes: c.notes || '',
    });
    setEditing(c.id);
    setError('');
  }
  function cancel() { setEditing(null); setError(''); }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado.');
      const row = {
        user_id: user.id,
        full_name: form.full_name.trim(),
        role: form.role,
        anac_code: form.anac_code.trim() || null,
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        daily_rate_brl: form.daily_rate_brl !== '' ? parseFloat(form.daily_rate_brl) : null,
        daily_rate_usd: form.daily_rate_usd !== '' ? parseFloat(form.daily_rate_usd) : null,
        per_diem_domestic_brl: form.per_diem_domestic_brl !== '' ? parseFloat(form.per_diem_domestic_brl) : null,
        per_diem_international_usd: form.per_diem_international_usd !== '' ? parseFloat(form.per_diem_international_usd) : null,
        is_freelance: !!form.is_freelance,
        is_active: !!form.is_active,
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
    if (!window.confirm(`Remover "${name}" da tripulação? Esta ação não pode ser desfeita.`)) return;
    setError('');
    try {
      const { error: e } = await supabase.from('crew_members').delete().eq('id', id);
      if (e) throw e;
      await load();
    } catch(err) { setError(err.message); }
  }

  async function toggleActive(id, currentlyActive) {
    setError('');
    try {
      const { error: e } = await supabase.from('crew_members').update({ is_active: !currentlyActive }).eq('id', id);
      if (e) throw e;
      await load();
    } catch(err) { setError(err.message); }
  }

  const filtered = crew.filter(c => {
    if (!showInactive && c.is_active === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.full_name||'').toLowerCase().includes(q)
      || (c.anac_code||'').toLowerCase().includes(q)
      || (c.email||'').toLowerCase().includes(q)
      || (ROLE_LABEL[c.role]||'').toLowerCase().includes(q);
  });

  if (editing !== null) {
    return (
      <div style={{ padding:24, maxWidth:780 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={cancel}>← Voltar</button>
          <div style={{ fontSize:16, fontWeight:700 }}>{editing==='new' ? 'Novo tripulante' : 'Editar tripulante'}</div>
        </div>

        {error && (
          <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:13 }}>{error}</div>
        )}

        <form onSubmit={save}>
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
              <div><label>CANAC (piloto)</label><input value={form.anac_code} onChange={e=>setForm(f=>({...f, anac_code:e.target.value}))} placeholder="123456" /></div>
              <div><label>CPF</label><input value={form.cpf} onChange={e=>setForm(f=>({...f, cpf:e.target.value}))} placeholder="000.000.000-00" /></div>
              <div><label>Telefone</label><input value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} placeholder="+55 11 99999-9999" /></div>
            </div>
            <div><label>E-mail</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} placeholder="piloto@exemplo.com" /></div>
          </div>

          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Taxas e diárias</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
              Estes valores são sugeridos automaticamente ao adicionar este tripulante a um voo. Podem ser sobrescritos por voo.
            </div>
            <div className="g2" style={{ marginBottom:14 }}>
              <div><label>Diária — BRL (R$)</label><input type="number" step="0.01" value={form.daily_rate_brl} onChange={e=>setForm(f=>({...f, daily_rate_brl:e.target.value}))} placeholder="2000.00" /></div>
              <div><label>Diária — USD ($)</label><input type="number" step="0.01" value={form.daily_rate_usd} onChange={e=>setForm(f=>({...f, daily_rate_usd:e.target.value}))} placeholder="500.00" /></div>
            </div>
            <div className="g2">
              <div><label>Per diem doméstico — BRL (R$)</label><input type="number" step="0.01" value={form.per_diem_domestic_brl} onChange={e=>setForm(f=>({...f, per_diem_domestic_brl:e.target.value}))} placeholder="800.00" /></div>
              <div><label>Per diem internacional — USD ($)</label><input type="number" step="0.01" value={form.per_diem_international_usd} onChange={e=>setForm(f=>({...f, per_diem_international_usd:e.target.value}))} placeholder="215.00" /></div>
            </div>
          </div>

          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Status</div>
            <div className="g2">
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={!!form.is_freelance} onChange={e=>setForm(f=>({...f, is_freelance:e.target.checked}))} /> Freelance (rate variável por missão)
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f, is_active:e.target.checked}))} /> Ativo (aparece nos dropdowns)
              </label>
            </div>
            <div style={{ marginTop:14 }}><label>Notas</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} placeholder="Habilitações, observações, restrições…" /></div>
          </div>

          <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', borderTop:'1px solid var(--bg2)', display:'flex', gap:10 }}>
            <button type="submit" className="primary" disabled={saving}>{saving?'Salvando…':'Salvar tripulante'}</button>
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
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Tripulação</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>
            {crew.filter(c => c.is_active !== false).length} ativo(s) · {crew.length} total
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input placeholder="Buscar nome, CANAC, e-mail…" value={search} onChange={e=>setSearch(e.target.value)} style={{ width:240 }} />
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text3)' }}>
            <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} /> Mostrar inativos
          </label>
          <button className="primary" onClick={startNew}>+ Novo tripulante</button>
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
          <div style={{ fontWeight:600 }}>{search ? 'Nenhum tripulante encontrado.' : 'Nenhum tripulante cadastrado.'}</div>
          {!search && <button className="primary" style={{ marginTop:16 }} onClick={startNew}>Cadastrar primeiro tripulante</button>}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden', padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Nome','Função','CANAC','E-mail','Diária BRL','Diária USD','Per diem dom.','Per diem intl.','Tipo','Status',''].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:600, color:'var(--text3)', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => startEdit(c)} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', opacity: c.is_active===false?0.5:1 }}>
                  <td style={{ padding:'9px 12px', fontWeight:500 }}>{c.full_name}{c.is_self && <span style={{ marginLeft:6, color:'var(--blue)', fontSize:10 }}>(você)</span>}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ color: ROLE_COLOR[c.role] || 'var(--text2)', fontWeight:600 }}>{ROLE_LABEL[c.role] || c.role}</span>
                  </td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', color:'var(--text2)' }}>{c.anac_code || '—'}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text2)' }}>{c.email || '—'}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmt(c.daily_rate_brl)}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmt(c.daily_rate_usd)}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmt(c.per_diem_domestic_brl)}</td>
                  <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', textAlign:'right' }}>{fmt(c.per_diem_international_usd)}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span className={`tag tag-${c.is_freelance ? 'warn' : 'ok'}`}>{c.is_freelance ? 'Freelance' : 'Fixo'}</span>
                  </td>
                  <td style={{ padding:'9px 12px' }} onClick={e=>e.stopPropagation()}>
                    <button onClick={() => toggleActive(c.id, c.is_active !== false)} style={{ fontSize:10, padding:'3px 8px' }}>
                      {c.is_active === false ? '✓ Ativar' : '⏸ Pausar'}
                    </button>
                  </td>
                  <td style={{ padding:'9px 12px' }} onClick={e=>e.stopPropagation()}>
                    <button className="danger" onClick={() => remove(c.id, c.full_name)} style={{ fontSize:10, padding:'3px 8px' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize:11, color:'var(--text3)', marginTop:14, padding:'10px 14px', background:'var(--bg1)', borderRadius:6 }}>
        💡 Os tripulantes ativos aparecem no formulário de registro de voo na seção <strong>Tripulação deste voo</strong>. As diárias e per diems cadastrados aqui são sugeridos automaticamente — você pode sobrescrever por voo.
      </div>
    </div>
  );
}
