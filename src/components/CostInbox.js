import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  listInboxCosts, approveCost, rejectCost, deleteCost,
  listCategorizationRules, saveCategorizationRule,
  getCostCategories, getReceiptSignedUrl,
} from '../store';

// Catálogo built-in (espelha o que está em Costs.js — categorias do sistema).
const BUILTIN_CATS = [
  { v:'fuel',           label:'Combustível',          group:'op_direct',   icon:'⛽' },
  { v:'airport_fees',   label:'Taxas aeroportuárias', group:'op_direct',   icon:'🏛' },
  { v:'nav_fees',       label:'Taxas de navegação',   group:'op_direct',   icon:'🗺' },
  { v:'handling',       label:'Handling / Ground',    group:'op_direct',   icon:'🛒' },
  { v:'catering',       label:'Catering',             group:'op_direct',   icon:'🍽' },
  { v:'overflight',     label:'Sobrevoo / Permissões',group:'op_direct',   icon:'✈' },
  { v:'scheduled_mx',   label:'MX Programada',        group:'maintenance', icon:'🔧' },
  { v:'unscheduled_mx', label:'MX Não Programada',    group:'maintenance', icon:'🚨' },
  { v:'engine_reserve', label:'Reserva Motor (TBO)',  group:'maintenance', icon:'🔩' },
  { v:'prop_reserve',   label:'Reserva Hélice (TBO)', group:'maintenance', icon:'🌀' },
  { v:'apu_reserve',    label:'Reserva APU',          group:'maintenance', icon:'⚙' },
  { v:'avionics_mx',    label:'Aviônica / Elétrica',  group:'maintenance', icon:'📡' },
  { v:'airframe_mx',    label:'Célula / Estrutural',  group:'maintenance', icon:'🛠' },
  { v:'insurance',      label:'Seguro aeronáutico',   group:'fixed_op',    icon:'🛡' },
  { v:'hangar',         label:'Hangar / Tie-down',    group:'fixed_op',    icon:'🏠' },
  { v:'crew',           label:'Tripulação (fixo)',    group:'fixed_op',    icon:'👨‍✈️' },
  { v:'crew_variable',  label:'Tripulação (variável)',group:'fixed_op',    icon:'👨‍✈️' },
  { v:'training',       label:'Treinamento / Sim',    group:'fixed_op',    icon:'🎓' },
  { v:'subscriptions',  label:'Assinaturas / Software',group:'admin',      icon:'💻' },
  { v:'licenses',       label:'Licenças / CMA / ANAC',group:'admin',       icon:'📋' },
  { v:'admin',          label:'Administrativo geral', group:'admin',       icon:'📁' },
  { v:'financing',      label:'Financiamento / Leasing',group:'admin',     icon:'🏦' },
  { v:'depreciation',   label:'Depreciação',          group:'other',       icon:'📉' },
  { v:'other',          label:'Outros',               group:'other',       icon:'📦' },
];

const GROUPS = {
  op_direct:   { label:'Operacional direto', color:'#4d9de0' },
  maintenance: { label:'Manutenção',         color:'#e8a84a' },
  fixed_op:    { label:'Fixo operacional',   color:'#3dbf8a' },
  admin:       { label:'Administrativo',     color:'#9b7fe8' },
  other:       { label:'Outros',             color:'#888' },
};

const CHANNEL_LABEL = {
  web:      { label: 'Manual', icon: '✏️' },
  scan:     { label: 'Foto/PDF', icon: '🧾' },
  email:    { label: 'E-mail', icon: '✉️' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  api:      { label: 'API', icon: '🔌' },
};

const CONFIDENCE_STYLE = {
  high:   { color: 'var(--green)', bg: 'var(--green-dim)', label: 'Alta confiança' },
  medium: { color: 'var(--amber)', bg: 'var(--amber-dim)', label: 'Média confiança' },
  low:    { color: 'var(--red)',   bg: 'var(--red-dim)',   label: 'Baixa confiança' },
};

function fmtBrl(v) {
  return 'R$ ' + parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default function CostInbox({ aircraft = [], onChanged }) {
  const [items, setItems]           = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [rules, setRules]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [busy, setBusy]             = useState(false);
  const [openId, setOpenId]         = useState(null);
  const [edits, setEdits]           = useState({});       // { [costId]: patch }
  const [signedUrls, setSignedUrls] = useState({});       // { [costId]: url }
  const [proposeRule, setProposeRule] = useState({});     // { [costId]: bool }

  const allCats = useMemo(() => [
    ...BUILTIN_CATS,
    ...customCats.map(c => ({
      v: `custom_${c.id}`, label: c.name,
      group: c.group_type || 'other', icon: c.icon || '📦', custom: true,
    })),
  ], [customCats]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [list, cats, rs] = await Promise.all([
        listInboxCosts(), getCostCategories(), listCategorizationRules(),
      ]);
      setItems(list);
      setCustomCats(cats);
      setRules(rs);
      // Aplica regra automaticamente: se vendor casa com regra existente, sugere
      const initialEdits = {};
      list.forEach(c => {
        const matched = rs.find(r =>
          (r.match_type === 'vendor_exact'    && (c.vendor||'').toUpperCase() === (r.match_value||'').toUpperCase()) ||
          (r.match_type === 'vendor_contains' && (c.vendor||'').toUpperCase().includes((r.match_value||'').toUpperCase()))
        );
        if (matched) {
          initialEdits[c.id] = {
            category:    matched.suggested_category || c.category,
            costType:    matched.suggested_cost_type || c.costType,
            recurrence:  matched.suggested_recurrence || c.recurrence,
            _ruleId:     matched.id,
          };
        }
      });
      setEdits(initialEdits);
      // Carrega URLs assinadas dos comprovantes
      const urls = {};
      await Promise.all(list.filter(c => c.receiptUrl).map(async c => {
        try { urls[c.id] = await getReceiptSignedUrl(c.receiptUrl); } catch {}
      }));
      setSignedUrls(urls);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function getEdit(c, key) {
    return edits[c.id]?.[key] !== undefined ? edits[c.id][key] : c[key];
  }
  function setEdit(costId, key, value) {
    setEdits(e => ({ ...e, [costId]: { ...(e[costId] || {}), [key]: value } }));
  }

  async function approve(c) {
    setBusy(true); setError('');
    try {
      const patch = {
        ...c,
        ...(edits[c.id] || {}),
      };
      delete patch._ruleId;
      await approveCost(c.id, patch);
      // Se pediu pra criar regra com esse vendor, salva
      if (proposeRule[c.id] && c.vendor) {
        await saveCategorizationRule({
          matchType:           'vendor_exact',
          matchValue:          c.vendor.trim(),
          suggestedCategory:   patch.category,
          suggestedCostType:   patch.costType,
          suggestedRecurrence: patch.recurrence,
          autoApply:           false,
        });
      }
      await load();
      onChanged?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function reject(c) {
    if (!window.confirm('Rejeitar este custo? Ficará como "rejected" (não some, mas não conta).')) return;
    setBusy(true);
    try { await rejectCost(c.id); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function discard(c) {
    if (!window.confirm('Apagar este custo permanentemente? Esta ação não pode ser desfeita.')) return;
    setBusy(true);
    try { await deleteCost(c.id); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (loading) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Carregando inbox…
    </div>
  );

  if (items.length === 0) return (
    <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
      <div style={{ fontSize: 38, marginBottom: 12 }}>📥</div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Inbox vazia</div>
      <div style={{ fontSize: 12, lineHeight: 1.7 }}>
        Custos enviados via foto/PDF, e-mail ou WhatsApp aparecem aqui<br/>
        para revisão antes de entrarem na lista oficial.
      </div>
    </div>
  );

  return (
    <div>
      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red-mid)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text3)' }}>
        {items.length} custo(s) aguardando revisão · {rules.length} regra(s) ativa(s)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(c => {
          const isOpen = openId === c.id;
          const ch = CHANNEL_LABEL[c.submittedVia] || CHANNEL_LABEL.web;
          const conf = CONFIDENCE_STYLE[c.aiConfidence];
          const ac = aircraft.find(a => a.id === c.aircraftId);
          const cat = allCats.find(x => x.v === getEdit(c, 'category')) || allCats.find(x => x.v === 'other');
          const grp = cat ? GROUPS[cat.group] : null;
          const matchedRule = edits[c.id]?._ruleId ? rules.find(r => r.id === edits[c.id]._ruleId) : null;

          return (
            <div key={c.id} style={{
              background: 'var(--bg1)',
              border: `1px solid ${isOpen ? 'var(--blue-mid)' : 'var(--border)'}`,
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'border-color .2s',
            }}>
              {/* Header / resumo */}
              <div onClick={() => setOpenId(isOpen ? null : c.id)} style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                background: isOpen ? 'var(--bg2)' : 'transparent',
              }}>
                <span style={{ fontSize: 20 }}>{cat?.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                    {c.vendor || c.description || 'Sem descrição'}
                    {matchedRule && (
                      <span title="Regra aplicada automaticamente" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--blue-dim)', color: 'var(--blue)', fontWeight: 600 }}>
                        ✦ regra
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{ch.icon} {ch.label}</span>
                    {ac && <span>· {ac.registration}</span>}
                    {grp && <span style={{ color: grp.color }}>· {cat.label}</span>}
                    {c.referenceDate && <span>· {new Date(c.referenceDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                {conf && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: conf.bg, color: conf.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {conf.label}
                  </span>
                )}
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--blue)', fontSize: 14, whiteSpace: 'nowrap' }}>
                  {fmtBrl(c.amountBrl)}
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {/* Detalhes / edição */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: signedUrls[c.id] ? '160px 1fr' : '1fr', gap: 14 }}>
                    {signedUrls[c.id] && (
                      <a href={signedUrls[c.id]} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                        {/\.(png|jpe?g|gif|webp)$/i.test(c.receiptUrl || '') ? (
                          <img src={signedUrls[c.id]} alt="comprovante" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ padding: 28, background: 'var(--bg2)', borderRadius: 8, textAlign: 'center', fontSize: 28 }}>📄</div>
                        )}
                      </a>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>
                          “{c.description}”
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Categoria</label>
                          <select value={getEdit(c, 'category')} onChange={e => setEdit(c.id, 'category', e.target.value)} style={{ width: '100%' }}>
                            {Object.entries(GROUPS).map(([gk, gv]) => (
                              <optgroup key={gk} label={gv.label}>
                                {allCats.filter(x => x.group === gk).map(x => (
                                  <option key={x.v} value={x.v}>{x.icon} {x.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Aeronave</label>
                          <select value={getEdit(c, 'aircraftId') || ''} onChange={e => setEdit(c.id, 'aircraftId', e.target.value)} style={{ width: '100%' }}>
                            <option value="">— sem aeronave —</option>
                            {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Valor (R$)</label>
                          <input type="number" step="0.01" value={getEdit(c, 'amountBrl') || ''} onChange={e => setEdit(c.id, 'amountBrl', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Data</label>
                          <input type="date" value={getEdit(c, 'referenceDate') || ''} onChange={e => setEdit(c.id, 'referenceDate', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Tipo</label>
                          <select value={getEdit(c, 'costType') || 'variable'} onChange={e => setEdit(c.id, 'costType', e.target.value)}>
                            <option value="variable">Variável</option>
                            <option value="fixed">Fixo</option>
                            <option value="reserve">Reserva</option>
                            <option value="capital">Capital</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Fornecedor</label>
                          <input value={getEdit(c, 'vendor') || ''} onChange={e => setEdit(c.id, 'vendor', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Nº NF</label>
                          <input value={getEdit(c, 'invoiceNumber') || ''} onChange={e => setEdit(c.id, 'invoiceNumber', e.target.value)} />
                        </div>
                      </div>

                      {/* Sugestão de regra */}
                      {c.vendor && !matchedRule && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!proposeRule[c.id]} onChange={e => setProposeRule(p => ({ ...p, [c.id]: e.target.checked }))} />
                          <span>
                            Aprender: sempre que <strong>{c.vendor}</strong> aparecer, sugerir <strong>{cat?.label}</strong>
                          </span>
                        </label>
                      )}

                      {/* Ações */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button className="primary" onClick={() => approve(c)} disabled={busy} style={{ flex: 1 }}>
                          ✓ Aprovar e mover pra lista
                        </button>
                        <button onClick={() => reject(c)} disabled={busy} className="ghost">
                          Rejeitar
                        </button>
                        <button onClick={() => discard(c)} disabled={busy} className="danger">
                          ✕ Apagar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
