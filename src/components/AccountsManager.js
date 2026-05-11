// AccountsManager.js — contas financeiras (bancos, cartões, caixa) usadas em custos e reembolsos
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';

const TYPE_OPTIONS = [
  { value: 'bank',          label: 'Conta Bancária' },
  { value: 'credit_card',   label: 'Cartão de Crédito' },
  { value: 'debit_card',    label: 'Cartão de Débito' },
  { value: 'cash',          label: 'Caixa' },
  { value: 'wire_intl',     label: 'Transferência Internacional' },
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t.label]));
const TYPE_COLOR = {
  bank: 'var(--blue)', credit_card: 'var(--purple)',
  debit_card: 'var(--green)', cash: 'var(--amber)', wire_intl: 'var(--red)',
};
const CURRENCIES = ['BRL', 'USD', 'EUR'];

const EMPTY = {
  name: '',
  account_type: 'bank',
  bank_name: '',
  last_four: '',
  currency: 'BRL',
  is_default: false,
  is_active: true,
  notes: '',
};

export default function AccountsManager() {
  const [accounts, setAccounts] = useState([]);
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
      const { data, error: e } = await supabase
        .from('financial_accounts')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      if (e) throw e;
      setAccounts(data || []);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  function startNew() { setForm({ ...EMPTY }); setEditing('new'); setError(''); }
  function startEdit(a) {
    setForm({
      name: a.name || '',
      account_type: a.account_type || 'bank',
      bank_name: a.bank_name || '',
      last_four: a.last_four || '',
      currency: a.currency || 'BRL',
      is_default: !!a.is_default,
      is_active: a.is_active !== false,
      notes: a.notes || '',
    });
    setEditing(a.id); setError('');
  }
  function cancel() { setEditing(null); setError(''); }

  async function save(e) {
    e.preventDefault(); setError('');
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return; }
    if (form.last_four && !/^\d{0,4}$/.test(form.last_four.trim())) {
      setError('Últimos 4 dígitos: apenas números (até 4).'); return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado.');
      const row = {
        user_id: user.id,
        name: form.name.trim(),
        account_type: form.account_type,
        bank_name: form.bank_name.trim() || null,
        last_four: form.last_four.trim() || null,
        currency: form.currency || 'BRL',
        is_default: !!form.is_default,
        is_active: !!form.is_active,
        notes: form.notes.trim() || null,
      };
      if (form.is_default) {
        await supabase.from('financial_accounts')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', editing === 'new' ? '00000000-0000-0000-0000-000000000000' : editing);
      }
      if (editing === 'new') {
        const { error: err } = await supabase.from('financial_accounts').insert(row);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('financial_accounts').update(row).eq('id', editing);
        if (err) throw err;
      }
      setEditing(null);
      await load();
    } catch(err) { setError(err.message); }
    setSaving(false);
  }

  async function remove(id, name) {
    if (!window.confirm(`Remover conta "${name}"?`)) return;
    setError('');
    try {
      const { error: e } = await supabase.from('financial_accounts').delete().eq('id', id);
      if (e) throw e;
      await load();
    } catch(err) { setError(err.message); }
  }

  const filtered = useMemo(() => accounts.filter(a => {
    if (!showInactive && a.is_active === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.name||'').toLowerCase().includes(q)
      || (a.bank_name||'').toLowerCase().includes(q)
      || (a.last_four||'').includes(q)
      || (TYPE_LABEL[a.account_type]||'').toLowerCase().includes(q);
  }), [accounts, search, showInactive]);

  if (editing !== null) {
    return (
      <div style={{ padding:24, maxWidth:760 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={cancel}>← Voltar</button>
          <div style={{ fontSize:16, fontWeight:700 }}>{editing==='new' ? 'Nova conta financeira' : 'Editar conta'}</div>
        </div>

        {error && (
          <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:13 }}>{error}</div>
        )}

        <form onSubmit={save}>
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Identificação</div>
            <div className="g3" style={{ marginBottom:14 }}>
              <div style={{ gridColumn:'1/3' }}>
                <label>Nome *</label>
                <input required value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} placeholder="Itaú PJ — Yancovitz Aviation" />
              </div>
              <div>
                <label>Tipo *</label>
                <select value={form.account_type} onChange={e=>setForm(f=>({...f, account_type:e.target.value}))}>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="g3" style={{ marginBottom:14 }}>
              <div><label>Banco / Emissor</label><input value={form.bank_name} onChange={e=>setForm(f=>({...f, bank_name:e.target.value}))} placeholder="Itaú, Bradesco, Visa Infinite…" /></div>
              <div><label>Últimos 4 dígitos</label><input value={form.last_four} onChange={e=>setForm(f=>({...f, last_four:e.target.value}))} placeholder="1234" maxLength={4} /></div>
              <div>
                <label>Moeda</label>
                <select value={form.currency} onChange={e=>setForm(f=>({...f, currency:e.target.value}))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="g3">
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={!!form.is_default} onChange={e=>setForm(f=>({...f, is_default:e.target.checked}))} /> Conta padrão
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f, is_active:e.target.checked}))} /> Ativa
              </label>
              <div></div>
            </div>
          </div>

          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Notas</div>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} rows={3} placeholder="Observações internas (limites, regras de uso, titularidade…)" />
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button type="button" className="ghost" onClick={cancel} disabled={saving}>Cancelar</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Contas Financeiras</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Bancos, cartões e caixas usadas para pagar despesas operacionais.</div>
        </div>
        <button className="primary" onClick={startNew}>+ Nova conta</button>
      </div>

      {error && (
        <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:13 }}>{error}</div>
      )}

      <div className="card" style={{ padding:'12px 16px', marginBottom:14, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar por nome, banco, últimos 4…"
          style={{ flex:'1 1 280px', minWidth:200 }}
        />
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer', color:'var(--text2)' }}>
          <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} /> Mostrar inativas
        </label>
        <div style={{ fontSize:11, color:'var(--text3)' }}>{filtered.length} / {accounts.length}</div>
      </div>

      {loading ? (
        <div style={{ padding:'40px 0', textAlign:'center', color:'var(--text3)', fontSize:12 }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)', fontSize:12 }}>
          {accounts.length === 0
            ? 'Nenhuma conta cadastrada. Crie a primeira para começar a lançar custos.'
            : 'Nenhuma conta encontrada com este filtro.'}
        </div>
      ) : (
        <div style={{ display:'grid', gap:8 }}>
          {filtered.map(a => (
            <div key={a.id} className="card" style={{
              padding:'12px 16px', display:'flex', alignItems:'center', gap:14,
              opacity: a.is_active === false ? .55 : 1,
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{a.name}</span>
                  <span style={{
                    fontSize:10, padding:'2px 7px', borderRadius:4,
                    background:'var(--bg1)', color: TYPE_COLOR[a.account_type] || 'var(--text3)',
                    border:`1px solid ${TYPE_COLOR[a.account_type] || 'var(--bg2)'}33`, fontWeight:600,
                  }}>{TYPE_LABEL[a.account_type] || a.account_type}</span>
                  <span className="tag-mono" style={{ fontSize:10 }}>{a.currency || 'BRL'}</span>
                  {a.is_default && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.4)', color:'var(--blue)', fontWeight:600 }}>Padrão</span>}
                  {a.is_active === false && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'var(--bg1)', border:'1px solid var(--bg2)', color:'var(--text3)', fontWeight:600 }}>Inativa</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>
                  {a.bank_name || '—'}{a.last_four ? ` •••• ${a.last_four}` : ''}
                </div>
              </div>
              <button className="ghost" onClick={()=>startEdit(a)} style={{ fontSize:11 }}>Editar</button>
              <button className="ghost" onClick={()=>remove(a.id, a.name)} style={{ fontSize:11, color:'var(--red)' }}>Excluir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
