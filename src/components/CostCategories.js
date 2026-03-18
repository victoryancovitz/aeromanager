import React, { useState, useEffect } from 'react';
import { getCostCategories, saveCostCategory, deleteCostCategory } from '../store';

// ── Gerenciador de Categorias de Custo ───────────────────────
// Categorias livres por usuário, além das categorias padrão do sistema
// Cada categoria tem: nome, grupo, cor, ícone, ordem
// ─────────────────────────────────────────────────────────────

const GROUP_TYPES = [
  { v: 'op_direct',   label: 'Operacional direto',   color: '#4d9de0' },
  { v: 'maintenance', label: 'Manutenção',            color: '#e8a84a' },
  { v: 'fixed_op',    label: 'Fixo operacional',      color: '#3dbf8a' },
  { v: 'admin',       label: 'Administrativo',        color: '#9b7fe8' },
  { v: 'other',       label: 'Outros',                color: '#888' },
];

const RECURRENCE_TYPES = [
  { v: 'once',       label: 'Avulso (único)' },
  { v: 'daily',      label: 'Diário' },
  { v: 'weekly',     label: 'Semanal' },
  { v: 'monthly',    label: 'Mensal' },
  { v: 'quarterly',  label: 'Trimestral' },
  { v: 'annual',     label: 'Anual' },
  { v: 'per_hour',   label: 'Por hora voada' },
  { v: 'per_cycle',  label: 'Por ciclo / pouso' },
];

const PRESET_COLORS = [
  '#4d9de0','#3dbf8a','#e8a84a','#e24b4a','#9b7fe8',
  '#D85A30','#1D9E75','#639922','#BA7517','#378ADD',
  '#888','#444',
];

const PRESET_ICONS = ['✈','⛽','🔧','🛡','🏠','📋','💻','🏦','⚙','🔩','🛠','📡','🌀','👨‍✈️','📁','📉','🎓','🚨','🗺','🍽'];

const EMPTY = { name: '', groupType: 'op_direct', color: '#4d9de0', icon: '📦', sortOrder: 0, defaultRecurrence: 'once' };

export default function CostCategories({ onClose }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const cats = await getCostCategories();
    setCategories(cats);
    setLoading(false);
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startNew() {
    setForm({ ...EMPTY, sortOrder: categories.length });
    setEditing('new');
  }

  function startEdit(cat) {
    setForm({
      name: cat.name,
      groupType: cat.group_type || 'other',
      color: cat.color || '#4d9de0',
      icon: cat.icon || '📦',
      sortOrder: cat.sort_order || 0,
    });
    setEditing(cat.id);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    await saveCostCategory({ ...form, id: editing !== 'new' ? editing : undefined });
    await load();
    setEditing(null);
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm('Remover categoria? Lançamentos associados não serão afetados.')) return;
    await deleteCostCategory(id);
    await load();
  }

  async function reorder(id, direction) {
    const idx = categories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const reordered = [...categories];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    // Save new sort_order for both
    await saveCostCategory({ id: reordered[idx].id, name: reordered[idx].name, groupType: reordered[idx].group_type, color: reordered[idx].color, icon: reordered[idx].icon, sortOrder: idx });
    await saveCostCategory({ id: reordered[newIdx].id, name: reordered[newIdx].name, groupType: reordered[newIdx].group_type, color: reordered[newIdx].color, icon: reordered[newIdx].icon, sortOrder: newIdx });
    await load();
  }

  const grouped = GROUP_TYPES.map(g => ({
    ...g,
    items: categories.filter(c => {
      const gt = c.group_type || 'other';
      // handle legacy values
      const normalized = gt === 'operational' ? 'op_direct' : gt === 'reserve' ? 'other' : gt;
      return normalized === g.v;
    }),
  })).filter(g => g.items.length > 0);

  if (editing !== null) return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>
          {editing === 'new' ? 'Nova categoria' : 'Editar categoria'}
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Identificação</div>
          <div style={{ marginBottom: 12 }}>
            <label>Nome da categoria *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ex: JSSI Engine Program, Hangar SP, Seguro Casco..." />
          </div>
          <div className="g2" style={{ marginBottom: 12 }}>
            <div>
              <label>Grupo</label>
              <select value={form.groupType} onChange={e => set('groupType', e.target.value)}>
                {GROUP_TYPES.map(g => <option key={g.v} value={g.v}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label>Recorrência padrão</label>
              <select value={form.defaultRecurrence || 'once'} onChange={e => set('defaultRecurrence', e.target.value)}>
                {RECURRENCE_TYPES.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Visual</div>
          <div style={{ marginBottom: 12 }}>
            <label>Ícone</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {PRESET_ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => set('icon', ic)}
                  style={{ width: 36, height: 36, fontSize: 18, border: `2px solid ${form.icon === ic ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 8, background: form.icon === ic ? 'var(--blue-dim)' : 'var(--bg2)', cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
              <input value={form.icon} onChange={e => set('icon', e.target.value)}
                style={{ width: 70, textAlign: 'center', fontSize: 18 }} placeholder="emoji" />
            </div>
          </div>
          <div>
            <label>Cor</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? 'var(--text1)' : 'transparent'}`, cursor: 'pointer' }} />
              ))}
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                style={{ width: 36, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{form.color}</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, border: `1px solid ${form.color}55`, background: form.color + '11' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Pré-visualização</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{form.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: form.color }}>{form.name || 'Nome da categoria'}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                {GROUP_TYPES.find(g => g.v === form.groupType)?.label} · {RECURRENCE_TYPES.find(r => r.v === (form.defaultRecurrence || 'once'))?.label}
              </div>
            </div>
          </div>
        </div>

        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onClose && <button className="ghost" onClick={onClose}>← Voltar</button>}
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400 }}>Categorias de Custo</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            {categories.length} categoria(s) personalizadas · As categorias padrão do sistema não são editáveis aqui
          </div>
        </div>
        <button className="primary" onClick={startNew}>+ Nova categoria</button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)' }}>Carregando...</div>
      ) : categories.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>📦</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>Nenhuma categoria personalizada</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>
            Crie categorias para organizar seus custos além das padrão do sistema.<br />
            Exemplos: "JSSI Engine Program", "Hangar São Paulo", "Seguro Casco Frota"
          </div>
          <button className="primary" onClick={startNew}>Criar primeira categoria</button>
        </div>
      ) : (
        <div>
          {grouped.map(group => (
            <div key={group.v} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{group.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{group.items.length} item(s)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.sort((a,b) => (a.sort_order||0) - (b.sort_order||0)).map((cat, idx) => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg1)', border: '1px solid var(--border)', borderLeft: `3px solid ${cat.color || group.color}`, borderRadius: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: cat.color || 'var(--text1)' }}>{cat.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        {group.label} · Recorrência padrão: {RECURRENCE_TYPES.find(r => r.v === (cat.default_recurrence || 'once'))?.label}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button style={{ fontSize: 11, padding: '2px 6px', opacity: idx === 0 ? 0.3 : 1 }}
                        disabled={idx === 0} onClick={() => reorder(cat.id, 'up')}>↑</button>
                      <button style={{ fontSize: 11, padding: '2px 6px', opacity: idx === group.items.length - 1 ? 0.3 : 1 }}
                        disabled={idx === group.items.length - 1} onClick={() => reorder(cat.id, 'down')}>↓</button>
                      <button style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => startEdit(cat)}>✎</button>
                      <button className="danger" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => remove(cat.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System categories reference */}
      <div style={{ marginTop: 24, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Categorias padrão do sistema (não editáveis)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            'Combustível','Taxas aeroportuárias','Taxas de navegação','Handling',
            'MX Programada','MX Não Programada','Reserva Motor','Seguro',
            'Hangar','Tripulação','Licenças ANAC','Outros',
          ].map(name => (
            <span key={name} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}>{name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
