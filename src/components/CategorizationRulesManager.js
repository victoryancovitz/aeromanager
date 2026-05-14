import React, { useEffect, useState } from 'react';
import {
  listCategorizationRules, saveCategorizationRule, deleteCategorizationRule,
  getCostCategories,
} from '../store';

// Catálogo built-in (espelha Costs.js / CostInbox.js)
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

const MATCH_TYPES = [
  { v: 'vendor_exact',         label: 'Fornecedor (igual a)',         hint: 'Casa quando o nome do fornecedor é exatamente igual' },
  { v: 'vendor_contains',      label: 'Fornecedor (contém)',          hint: 'Casa quando o nome contém o texto (parcial)' },
  { v: 'cnpj',                 label: 'CNPJ',                          hint: 'Casa pelo CNPJ do fornecedor (formato livre)' },
  { v: 'description_contains', label: 'Descrição (contém)',           hint: 'Casa quando a descrição contém o texto' },
];

const COST_TYPES = [
  { v: 'variable', label: 'Variável' },
  { v: 'fixed',    label: 'Fixo' },
  { v: 'reserve',  label: 'Reserva' },
  { v: 'capital',  label: 'Capital' },
];

const RECURRENCES = [
  { v: 'once',      label: 'Avulso' },
  { v: 'monthly',   label: 'Mensal' },
  { v: 'quarterly', label: 'Trimestral' },
  { v: 'annual',    label: 'Anual' },
  { v: 'per_hour',  label: 'Por hora voada' },
];

const EMPTY = {
  matchType: 'vendor_exact',
  matchValue: '',
  suggestedCategory: 'other',
  suggestedCostType: 'variable',
  suggestedRecurrence: 'once',
  suggestedSplitRule: '',
  autoApply: false,
};

export default function CategorizationRulesManager({ onClose }) {
  const [rules, setRules]         = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const allCats = [
    ...BUILTIN_CATS,
    ...customCats.map(c => ({
      v: `custom_${c.id}`, label: c.name,
      group: c.group_type || 'other', icon: c.icon || '📦',
    })),
  ];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const [rs, cats] = await Promise.all([listCategorizationRules(), getCostCategories()]);
      setRules(rs);
      setCustomCats(cats);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startNew() { setForm(EMPTY); setEditing('new'); }

  function startEdit(r) {
    setForm({
      matchType:           r.match_type,
      matchValue:          r.match_value,
      suggestedCategory:   r.suggested_category || 'other',
      suggestedCostType:   r.suggested_cost_type || 'variable',
      suggestedRecurrence: r.suggested_recurrence || 'once',
      suggestedSplitRule:  r.suggested_split_rule || '',
      autoApply:           !!r.auto_apply,
    });
    setEditing(r.id);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.matchValue.trim()) return;
    setSaving(true); setError('');
    try {
      await saveCategorizationRule({ ...form, id: editing !== 'new' ? editing : undefined });
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm('Remover regra? Lançamentos já classificados continuam intactos.')) return;
    try { await deleteCategorizationRule(id); await load(); }
    catch (e) { setError(e.message); }
  }

  async function toggleAutoApply(r) {
    try {
      await saveCategorizationRule({
        id: r.id,
        matchType: r.match_type,
        matchValue: r.match_value,
        suggestedCategory: r.suggested_category,
        suggestedCostType: r.suggested_cost_type,
        suggestedRecurrence: r.suggested_recurrence,
        suggestedSplitRule: r.suggested_split_rule,
        autoApply: !r.auto_apply,
      });
      await load();
    } catch (e) { setError(e.message); }
  }

  if (editing !== null) {
    const matchHint = MATCH_TYPES.find(m => m.v === form.matchType)?.hint;
    return (
      <div style={{ padding: 24, maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>
            {editing === 'new' ? 'Nova regra de classificação' : 'Editar regra'}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red-mid)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
            <div className="section-title">Condição</div>
            <div className="g2" style={{ marginBottom: 12 }}>
              <div>
                <label>Tipo de comparação *</label>
                <select value={form.matchType} onChange={e => set('matchType', e.target.value)}>
                  {MATCH_TYPES.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label>Valor a procurar *</label>
                <input required value={form.matchValue} onChange={e => set('matchValue', e.target.value)}
                  placeholder="Ex: SHELL AVIATION" />
              </div>
            </div>
            {matchHint && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{matchHint}</div>}
          </div>

          <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
            <div className="section-title">Sugestão (o que aplicar quando casar)</div>
            <div className="g2" style={{ marginBottom: 12 }}>
              <div>
                <label>Categoria</label>
                <select value={form.suggestedCategory} onChange={e => set('suggestedCategory', e.target.value)}>
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
                <label>Tipo de custo</label>
                <select value={form.suggestedCostType} onChange={e => set('suggestedCostType', e.target.value)}>
                  {COST_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="g2">
              <div>
                <label>Recorrência</label>
                <select value={form.suggestedRecurrence} onChange={e => set('suggestedRecurrence', e.target.value)}>
                  {RECURRENCES.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label>Regra de rateio</label>
                <select value={form.suggestedSplitRule} onChange={e => set('suggestedSplitRule', e.target.value)}>
                  <option value="">— manter padrão —</option>
                  <option value="equal">Igual entre sócios</option>
                  <option value="proportional_hours">Proporcional a horas</option>
                  <option value="direct">Direto a um sócio</option>
                  <option value="exempt">Isento do rateio</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: 16, border: form.autoApply ? '1px solid var(--green-mid)' : '1px solid var(--border)', background: form.autoApply ? 'var(--green-dim)' : 'transparent' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.autoApply} onChange={e => set('autoApply', e.target.checked)} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.autoApply ? 'var(--green)' : 'var(--text1)' }}>
                  Auto-aprovar (pular inbox)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  Quando ligado, custos que casarem com esta regra vão direto pra lista oficial sem passar pela revisão. Use só pra fornecedores em que você confia 100%.
                </div>
              </div>
            </label>
          </div>

          <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onClose && <button className="ghost" onClick={onClose}>← Voltar</button>}
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400 }}>Regras de Classificação</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            {rules.length} regra(s) · {rules.filter(r => r.auto_apply).length} auto-aprovam · {rules.reduce((s, r) => s + (r.hit_count || 0), 0)} aplicações totais
          </div>
        </div>
        <button className="primary" onClick={startNew}>+ Nova regra</button>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red-mid)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Carregando…</div>
      ) : rules.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>✦</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>Nenhuma regra ainda</div>
          <div style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.7 }}>
            Crie regras pra que a IA classifique automaticamente custos repetitivos.<br/>
            Exemplos: "SHELL AVIATION → Combustível", "AVCERT → Seguro anual mensal".
          </div>
          <button className="primary" onClick={startNew}>Criar primeira regra</button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['Tipo','Valor','→ Categoria','Auto','Aplicações','Última aplicação',''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map(r => {
                const cat = allCats.find(x => x.v === r.suggested_category);
                const grp = cat ? GROUPS[cat.group] : null;
                const mt  = MATCH_TYPES.find(m => m.v === r.match_type);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--text2)', fontSize: 11, whiteSpace: 'nowrap' }}>{mt?.label || r.match_type}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)' }}>{r.match_value}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {grp && <span style={{ fontSize: 10, padding: '2px 6px', background: `${grp.color}22`, color: grp.color, borderRadius: 6, fontWeight: 600, marginRight: 6 }}>{grp.label}</span>}
                      {cat?.icon} {cat?.label || r.suggested_category}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!r.auto_apply} onChange={() => toggleAutoApply(r)} />
                        <span style={{ fontSize: 10, color: r.auto_apply ? 'var(--green)' : 'var(--text3)', fontWeight: 600 }}>
                          {r.auto_apply ? 'SIM' : 'não'}
                        </span>
                      </label>
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{r.hit_count || 0}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {r.last_hit_at ? new Date(r.last_hit_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <button style={{ fontSize: 11, padding: '3px 8px', marginRight: 6 }} onClick={() => startEdit(r)}>Editar</button>
                      <button className="danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => remove(r.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text2)' }}>Como funciona:</strong> Quando você manda um recibo pra Caixa de entrada, a IA consulta estas regras na ordem de mais usadas → menos usadas. A primeira que casar sugere a categoria automaticamente. Regras com <strong>Auto SIM</strong> pulam a revisão e vão direto pra lista oficial.
      </div>
    </div>
  );
}
