import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { getUser } from '../store';

// ── Helpers ───────────────────────────────────────────────────
function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function fmtH(h) {
  if (!h) return '0h00';
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2,'0')}`;
}

const ORIGIN_LABELS = {
  cost_overpayment: { icon: '💳', label: 'Pagamento de custo',    color: 'var(--blue)'   },
  hour_exchange:    { icon: '⏱',  label: 'Troca de horas',        color: 'var(--amber)'  },
  cross_aircraft:   { icon: '✈',  label: 'Uso de outra aeronave', color: 'var(--purple)' },
  manual:           { icon: '✏️',  label: 'Lançamento manual',     color: 'var(--text2)'  },
};

const STATUS_LABELS = {
  pending:        { label: 'Pendente',       color: 'var(--amber)', bg: 'var(--amber-dim)' },
  settled_money:  { label: 'Quitado (R$)',   color: 'var(--green)', bg: 'var(--green-dim)' },
  settled_hours:  { label: 'Quitado (h)',    color: 'var(--green)', bg: 'var(--green-dim)' },
  partial:        { label: 'Parcial',        color: 'var(--blue)',  bg: 'var(--blue-dim)'  },
  cancelled:      { label: 'Cancelado',      color: 'var(--text3)', bg: 'var(--bg3)'       },
};

// ── Store calls ───────────────────────────────────────────────
async function getLedger(aircraftIds) {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .in('aircraft_id', aircraftIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getAgreements(aircraftIds) {
  const { data, error } = await supabase
    .from('aircraft_agreements')
    .select('*')
    .in('aircraft_a_id', aircraftIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveLedgerEntry(entry) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = {
    user_id:           user.id,
    aircraft_id:       entry.aircraft_id || null,
    creditor_name:     entry.creditor_name,
    creditor_user_id:  entry.creditor_user_id || null,
    debtor_name:       entry.debtor_name,
    debtor_user_id:    entry.debtor_user_id || null,
    amount_brl:        parseFloat(entry.amount_brl) || 0,
    hours_credit:      parseFloat(entry.hours_credit) || 0,
    origin_type:       entry.origin_type || 'manual',
    origin_cost_id:    entry.origin_cost_id || null,
    origin_flight_id:  entry.origin_flight_id || null,
    status:            'pending',
    description:       entry.description || '',
    notes:             entry.notes || '',
  };
  const { data, error } = await supabase.from('credit_ledger').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function settleEntry(id, method, amountSettled, hoursSettled, notes) {
  const status = method === 'money' ? 'settled_money'
    : method === 'hours' ? 'settled_hours' : 'partial';
  const { error } = await supabase.from('credit_ledger').update({
    status,
    amount_settled: parseFloat(amountSettled) || 0,
    hours_settled:  parseFloat(hoursSettled)  || 0,
    settled_at:     new Date().toISOString(),
    settled_notes:  notes || null,
  }).eq('id', id);
  if (error) throw error;
}

async function saveAgreement(ag) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = {
    aircraft_a_id:   ag.aircraft_a_id,
    user_a_id:       user.id,
    aircraft_b_registration: ag.aircraft_b_registration || '',
    owner_b_name:    ag.owner_b_name || '',
    owner_b_email:   ag.owner_b_email || '',
    rate_type:       ag.rate_type || 'hour_for_hour',
    rate_a_per_hour: parseFloat(ag.rate_a_per_hour) || null,
    rate_b_per_hour: parseFloat(ag.rate_b_per_hour) || null,
    status:          'active',
    notes:           ag.notes || '',
  };
  const { data, error } = await supabase.from('aircraft_agreements').insert(row).select().single();
  if (error) throw error;
  return data;
}

// ── SETTLE MODAL ──────────────────────────────────────────────
function SettleModal({ entry, onClose, onSaved }) {
  const [method,  setMethod]  = useState('money');
  const [amount,  setAmount]  = useState(entry.amount_brl - (entry.amount_settled || 0));
  const [hours,   setHours]   = useState(entry.hours_credit - (entry.hours_settled || 0));
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await settleEntry(entry.id, method,
        method === 'money' ? amount : 0,
        method === 'hours' ? hours  : 0,
        notes
      );
      onSaved();
      onClose();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const remaining = {
    brl:   entry.amount_brl   - (entry.amount_settled   || 0),
    hours: entry.hours_credit - (entry.hours_settled    || 0),
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, maxWidth:460, width:'100%', padding:26 }}>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:18, marginBottom:4 }}>Registrar liquidação</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>
          <strong>{entry.creditor_name}</strong> recebe de <strong>{entry.debtor_name}</strong>
        </div>

        {/* Pending amounts */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
          {remaining.brl > 0 && (
            <div style={{ padding:'10px 14px', borderRadius:9, background:'var(--bg2)', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>VALOR PENDENTE</div>
              <div style={{ fontSize:18, fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--amber)' }}>{fmtBRL(remaining.brl)}</div>
            </div>
          )}
          {remaining.hours > 0 && (
            <div style={{ padding:'10px 14px', borderRadius:9, background:'var(--bg2)', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>HORAS PENDENTES</div>
              <div style={{ fontSize:18, fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--amber)' }}>{fmtH(remaining.hours)}</div>
            </div>
          )}
        </div>

        {/* Method */}
        <div style={{ marginBottom:14 }}>
          <label>Forma de liquidação</label>
          <div style={{ display:'flex', gap:8 }}>
            {[
              ['money', '💵 Dinheiro'],
              ['hours', '⏱ Horas de voo'],
              ['partial', '📊 Parcial'],
            ].map(([v, l]) => (
              <button key={v} onClick={() => setMethod(v)}
                style={{ flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${method===v?'var(--blue)':'var(--border)'}`, background:method===v?'var(--blue-dim)':'var(--bg2)', color:method===v?'var(--blue)':'var(--text2)', fontSize:12, cursor:'pointer', fontWeight:method===v?600:400 }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {(method === 'money' || method === 'partial') && remaining.brl > 0 && (
          <div style={{ marginBottom:12 }}>
            <label>Valor quitado (R$)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ fontFamily:'var(--font-mono)', fontSize:16 }} />
          </div>
        )}
        {(method === 'hours' || method === 'partial') && remaining.hours > 0 && (
          <div style={{ marginBottom:12 }}>
            <label>Horas quitadas</label>
            <input type="number" step="0.1" value={hours} onChange={e => setHours(e.target.value)}
              style={{ fontFamily:'var(--font-mono)', fontSize:16 }} />
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label>Observação (opcional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Transferido via Pix em 18/03/2026" />
        </div>

        {error && <div style={{ marginBottom:10, fontSize:12, color:'var(--red)' }}>{error}</div>}

        <div style={{ display:'flex', gap:10 }}>
          <button className="primary" onClick={handleSave} disabled={saving} style={{ flex:1 }}>
            {saving ? 'Salvando...' : '✓ Registrar liquidação'}
          </button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── NEW ENTRY MODAL ───────────────────────────────────────────
function NewEntryModal({ aircraft, owners, onClose, onSaved }) {
  const EMPTY = { creditor_name:'', debtor_name:'', amount_brl:'', hours_credit:'', origin_type:'manual', description:'', notes:'' };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k,v) { setForm(f=>({...f,[k]:v})); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await saveLedgerEntry({ ...form, aircraft_id: aircraft?.id });
      onSaved(); onClose();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const ownerNames = owners.map(o => o.display_name);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, maxWidth:500, width:'100%', padding:26 }}>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:18, marginBottom:18 }}>Novo crédito / débito</div>

        <form onSubmit={handleSave}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label>Quem tem o crédito (pagou)</label>
              <select value={form.creditor_name} onChange={e=>set('creditor_name',e.target.value)} required>
                <option value="">— Selecione —</option>
                {ownerNames.map(n=><option key={n} value={n}>{n}</option>)}
                <option value="__custom">Outro (digitar)</option>
              </select>
              {form.creditor_name === '__custom' && <input placeholder="Nome" onChange={e=>set('creditor_name',e.target.value)} style={{ marginTop:6 }} />}
            </div>
            <div>
              <label>Quem deve (usou / recebeu)</label>
              <select value={form.debtor_name} onChange={e=>set('debtor_name',e.target.value)} required>
                <option value="">— Selecione —</option>
                {ownerNames.map(n=><option key={n} value={n}>{n}</option>)}
                <option value="__custom">Outro (digitar)</option>
              </select>
              {form.debtor_name === '__custom' && <input placeholder="Nome" onChange={e=>set('debtor_name',e.target.value)} style={{ marginTop:6 }} />}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label>Tipo</label>
            <select value={form.origin_type} onChange={e=>set('origin_type',e.target.value)}>
              {Object.entries(ORIGIN_LABELS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label>Valor em R$ (0 se for só horas)</label>
              <input type="number" step="0.01" value={form.amount_brl} onChange={e=>set('amount_brl',e.target.value)} style={{ fontFamily:'var(--font-mono)' }} />
            </div>
            <div>
              <label>Horas de crédito (0 se for só R$)</label>
              <input type="number" step="0.1" value={form.hours_credit} onChange={e=>set('hours_credit',e.target.value)} style={{ fontFamily:'var(--font-mono)' }} />
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label>Descrição *</label>
            <input required value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Ex: Victor pagou inspeção 100h — Carlos deve 30%" />
          </div>
          <div style={{ marginBottom:16 }}>
            <label>Observações</label>
            <textarea rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} />
          </div>

          {error && <div style={{ marginBottom:10, fontSize:12, color:'var(--red)' }}>{error}</div>}

          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" className="primary" disabled={saving} style={{ flex:1 }}>
              {saving ? 'Salvando...' : '✓ Registrar crédito'}
            </button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function CreditLedger({ aircraft, allAircraft }) {
  const [entries,     setEntries]    = useState([]);
  const [agreements,  setAgreements] = useState([]);
  const [owners,      setOwners]     = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');
  const [settling,    setSettling]   = useState(null);
  const [showNew,     setShowNew]    = useState(false);
  const [filter,      setFilter]     = useState('pending');

  const aircraftIds = (allAircraft || [aircraft]).filter(Boolean).map(a => a?.id).filter(Boolean);

  const load = useCallback(async () => {
    if (!aircraftIds.length) return;
    setLoading(true); setError('');
    try {
      const [ledger, ags] = await Promise.all([
        getLedger(aircraftIds),
        getAgreements(aircraftIds),
      ]);
      setEntries(ledger);
      setAgreements(ags);

      // Load co-owners for current aircraft
      if (aircraft?.id) {
        const { data } = await supabase
          .from('aircraft_co_owners')
          .select('*')
          .eq('aircraft_id', aircraft.id)
          .is('left_at', null);
        setOwners(data || []);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [aircraftIds.join(','), aircraft?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.status === filter);

  // Balance per person
  const balances = {};
  entries.filter(e => e.status === 'pending' || e.status === 'partial').forEach(e => {
    // Creditor gets positive balance
    if (!balances[e.creditor_name]) balances[e.creditor_name] = { brl: 0, hours: 0 };
    balances[e.creditor_name].brl   += (e.amount_brl   || 0) - (e.amount_settled   || 0);
    balances[e.creditor_name].hours += (e.hours_credit || 0) - (e.hours_settled    || 0);
    // Debtor gets negative balance
    if (!balances[e.debtor_name]) balances[e.debtor_name] = { brl: 0, hours: 0 };
    balances[e.debtor_name].brl   -= (e.amount_brl   || 0) - (e.amount_settled   || 0);
    balances[e.debtor_name].hours -= (e.hours_credit || 0) - (e.hours_settled    || 0);
  });

  const pendingCount = entries.filter(e => e.status === 'pending' || e.status === 'partial').length;
  const pendingBRL   = entries.filter(e => e.status === 'pending' || e.status === 'partial')
    .reduce((s,e) => s + ((e.amount_brl || 0) - (e.amount_settled || 0)), 0);

  return (
    <div style={{ padding:'20px 24px' }}>

      {settling && (
        <SettleModal entry={settling} onClose={() => setSettling(null)} onSaved={load} />
      )}
      {showNew && (
        <NewEntryModal aircraft={aircraft} owners={owners} onClose={() => setShowNew(false)} onSaved={load} />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:20 }}>Créditos & Débitos</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
            Controle de quem pagou, quem deve e trocas de horas
          </div>
        </div>
        <button className="primary" onClick={() => setShowNew(true)}>+ Registrar crédito</button>
      </div>

      {error && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      {!loading && Object.keys(balances).length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
            Saldos pendentes
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {Object.entries(balances).map(([name, bal]) => {
              const isCredit = bal.brl > 0;
              return (
                <div key={name} style={{ padding:'12px 16px', borderRadius:12, background:'var(--bg2)', border:`1.5px solid ${isCredit?'var(--green-mid)':'var(--red-mid)'}`, minWidth:180 }}>
                  <div style={{ fontSize:11, fontWeight:600, marginBottom:6, color:'var(--text2)' }}>{name.split(' ')[0]}</div>
                  <div style={{ fontSize:18, fontWeight:700, fontFamily:'var(--font-mono)', color: isCredit ? 'var(--green)' : 'var(--red)' }}>
                    {isCredit ? '+' : ''}{fmtBRL(Math.abs(bal.brl))}
                  </div>
                  {bal.hours !== 0 && (
                    <div style={{ fontSize:11, color: bal.hours > 0 ? 'var(--green)' : 'var(--red)', marginTop:2 }}>
                      {bal.hours > 0 ? '+' : ''}{fmtH(Math.abs(bal.hours))} em horas
                    </div>
                  )}
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>
                    {isCredit ? '← a receber' : '→ a pagar'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agreements */}
      {agreements.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
            Acordos de troca entre aeronaves
          </div>
          {agreements.map(ag => (
            <div key={ag.id} style={{ padding:'12px 16px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:22 }}>✈</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>
                  {aircraft?.registration || 'Aeronave'} ↔ {ag.aircraft_b_registration || 'Aeronave B'}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                  {ag.rate_type === 'hour_for_hour' ? '1h por 1h (qualquer aeronave)' :
                   ag.rate_type === 'value_based'   ? `Baseado em valor: R$${ag.rate_a_per_hour}/h ↔ R$${ag.rate_b_per_hour}/h` :
                   'Taxa customizada'}
                  {ag.rate_type === 'value_based' && ag.rate_a_per_hour && ag.rate_b_per_hour && (
                    <span style={{ marginLeft:8, color:'var(--blue)' }}>
                      (equivalência: 1h na B = {(ag.rate_b_per_hour/ag.rate_a_per_hour).toFixed(1)}h na A)
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background: ag.status==='active'?'var(--green-dim)':'var(--bg3)', color: ag.status==='active'?'var(--green)':'var(--text3)', fontWeight:500 }}>
                {ag.status === 'active' ? 'Ativo' : ag.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {[
          ['pending',  `Pendentes${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['all',      'Todos'],
          ['settled_money', 'Quitado R$'],
          ['settled_hours', 'Quitado h'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${filter===id?'var(--blue)':'var(--border)'}`, background:filter===id?'var(--blue-dim)':'transparent', color:filter===id?'var(--blue)':'var(--text3)', fontSize:12, cursor:'pointer', fontWeight:filter===id?600:400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Entries */}
      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          {filter === 'pending' ? 'Nenhum crédito pendente — tudo quitado!' : 'Nenhum registro encontrado.'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(entry => {
            const origin = ORIGIN_LABELS[entry.origin_type] || ORIGIN_LABELS.manual;
            const status = STATUS_LABELS[entry.status] || STATUS_LABELS.pending;
            const isPending = entry.status === 'pending' || entry.status === 'partial';
            const pendingBRL   = (entry.amount_brl   || 0) - (entry.amount_settled   || 0);
            const pendingHours = (entry.hours_credit || 0) - (entry.hours_settled    || 0);

            return (
              <div key={entry.id} style={{ padding:'14px 18px', borderRadius:12, background:'var(--bg1)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{origin.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, marginBottom:3 }}>{entry.description}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', display:'flex', gap:10, flexWrap:'wrap' }}>
                      <span style={{ color:'var(--green)' }}>↑ {entry.creditor_name}</span>
                      <span>→</span>
                      <span style={{ color:'var(--amber)' }}>↓ {entry.debtor_name}</span>
                      <span>·</span>
                      <span>{fmtDate(entry.created_at)}</span>
                      {entry.notes && <span>· {entry.notes.slice(0,60)}{entry.notes.length>60?'…':''}</span>}
                    </div>
                  </div>
                  {/* Amounts */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    {pendingBRL > 0.01 && (
                      <div style={{ fontSize:16, fontWeight:700, fontFamily:'var(--font-mono)', color: isPending ? 'var(--amber)' : 'var(--green)' }}>
                        {fmtBRL(isPending ? pendingBRL : entry.amount_brl)}
                      </div>
                    )}
                    {pendingHours > 0.01 && (
                      <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color: isPending ? 'var(--amber)' : 'var(--green)' }}>
                        {fmtH(isPending ? pendingHours : entry.hours_credit)}
                      </div>
                    )}
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:12, background: status.bg, color: status.color, marginTop:4, display:'inline-block', fontWeight:500 }}>
                      {status.label}
                    </span>
                  </div>
                  {/* Settle button */}
                  {isPending && (
                    <button className="primary" style={{ fontSize:11, padding:'6px 12px', flexShrink:0 }}
                      onClick={() => setSettling(entry)}>
                      Quitar
                    </button>
                  )}
                </div>
                {/* Settled info */}
                {entry.settled_at && (
                  <div style={{ marginTop:8, padding:'6px 10px', borderRadius:7, background:'var(--green-dim)', fontSize:11, color:'var(--green)' }}>
                    ✓ Quitado em {fmtDate(entry.settled_at)}{entry.settled_notes ? ` — ${entry.settled_notes}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
