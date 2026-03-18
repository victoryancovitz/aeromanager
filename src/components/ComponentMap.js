import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { getUser, bulkUpdateComponents } from '../store';

// ── Mapa de Controle de Componentes (MCC) ───────────────────
// Baseado no formato da Águia Aviação / ANAC
// Campos: Nomenclatura, P/N, N/S, TLV, TBO, TSN, TSO, CSN, CSO
// Vencimento por Horas (HS/T) e por Data
// ─────────────────────────────────────────────────────────────

const EMPTY_COMPONENT = {
  nomenclature: '',
  pn: '',
  ns: '',
  tlv: '',          // Tempo Limite de Vida (ex: "20 anos", "10 Anos")
  tbo: '',          // Time Between Overhaul (ex: "1.700 Hs / 12 Anos")
  tsn: '',          // Time Since New (horas totais da peça)
  tso: '',          // Time Since Overhaul (horas desde última revisão)
  csn: '',          // Cycles Since New
  cso: '',          // Cycles Since Overhaul
  dueHours: '',     // Vencimento em horas (HS/T)
  dueDate: '',      // Vencimento por data (DATA)
  dueCondition: '', // "On condition", "N/A"
  shop: '',         // Empresa que fez o serviço
  notes: '',        // Observações
  category: 'engine', // Categoria
};

const CATEGORIES = [
  { v: 'engine',     label: 'Motor / Propulsão',   color: '#e05c5c' },
  { v: 'propeller',  label: 'Hélice / Governador', color: '#e8a84a' },
  { v: 'landing',    label: 'Trem de Pouso',        color: '#4d9de0' },
  { v: 'avionics',   label: 'Aviônica / Elétrica',  color: '#9b7fe8' },
  { v: 'fuel',       label: 'Sistema Combustível',  color: '#3dbf8a' },
  { v: 'hydraulic',  label: 'Hidráulico / Pneum.',  color: '#3dc4c0' },
  { v: 'structure',  label: 'Estrutura / Célula',   color: '#c4945a' },
  { v: 'safety',     label: 'Segurança / Emergência',color:'#888' },
  { v: 'docs',       label: 'Documentos / Cert.',   color: '#b0a0c8' },
  { v: 'other',      label: 'Outros',               color: '#aaa' },
];

function parseHours(str) {
  if (!str) return null;
  const m = String(str).replace(',', '.').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function hoursLeft(dueHours, currentHours) {
  const due = parseHours(dueHours);
  const cur = parseHours(currentHours);
  if (!due || !cur) return null;
  return due - cur;
}

function daysLeft(dateStr) {
  if (!dateStr || dateStr === '----') return null;
  try {
    const d = new Date(dateStr.split('/').reverse().join('-'));
    return Math.ceil((d - new Date()) / 86400000);
  } catch { return null; }
}

function StatusBadge({ hl, dl }) {
  let color = 'var(--green)', bg = 'var(--green-dim)', label = 'Em dia';
  if ((hl !== null && hl <= 0) || (dl !== null && dl <= 0)) {
    color = 'var(--red)'; bg = 'var(--red-dim)'; label = 'VENCIDO';
  } else if ((hl !== null && hl <= 50) || (dl !== null && dl <= 30)) {
    color = 'var(--amber)'; bg = 'var(--amber-dim)'; label = 'PRÓXIMO';
  }
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, padding: '2px 7px', background: bg, borderRadius: 6 }}>
      {label}
    </span>
  );
}

export default function ComponentMap({ aircraft = [], reload }) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_COMPONENT);
  const [filterAc, setFilterAc] = useState(aircraft[0]?.id || '');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'calendar' | 'timeline'
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkInspecting, setBulkInspecting] = useState(false);
  const [inspectionData, setInspectionData] = useState({ date: new Date().toISOString().slice(0,10), tso: '', shop: '', notes: '' });

  useEffect(() => {
    loadComponents();
  }, [filterAc]);

  async function loadComponents() {
    setLoading(true);
    // timeout de segurança: nunca fica travado mais de 8s
    const timer = setTimeout(() => setLoading(false), 8000);
    try {
      const user = await getUser();
      if (!user) { clearTimeout(timer); setLoading(false); return; }
      let q = supabase.from('components').select('*').eq('user_id', user.id).order('category').order('nomenclature');
      if (filterAc) q = q.eq('aircraft_id', filterAc);
      const { data, error } = await q;
      if (error) {
        console.error('ComponentMap load error:', error);
        setComponents([]);
      } else {
        setComponents(data || []);
      }
    } catch(e) {
      console.error('ComponentMap exception:', e);
      setComponents([]);
    }
    clearTimeout(timer);
    setLoading(false);
  }

  const ac = aircraft.find(a => a.id === filterAc);
  const currentHours = ac ? (parseFloat(ac.baseAirframeHours || 0) + parseFloat(ac.totalFlightHours || 0)) : 0;

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startNew() {
    setForm({ ...EMPTY_COMPONENT, aircraftId: filterAc });
    setEditing('new');
  }

  function startEdit(c) {
    setForm({
      nomenclature: c.nomenclature || '',
      pn: c.pn || '', ns: c.ns || '',
      tlv: c.tlv || '', tbo: c.tbo || '',
      tsn: c.tsn || '', tso: c.tso || '',
      csn: c.csn || '', cso: c.cso || '',
      dueHours: c.due_hours || '',
      dueDate: c.due_date || '',
      dueCondition: c.due_condition || '',
      shop: c.shop || '',
      notes: c.notes || '',
      category: c.category || 'other',
    });
    setEditing(c.id);
  }

  async function submit(e) {
    e.preventDefault();
    const user = await getUser();
    const row = {
      user_id: user.id,
      aircraft_id: filterAc,
      nomenclature: form.nomenclature,
      pn: form.pn, ns: form.ns,
      tlv: form.tlv, tbo: form.tbo,
      tsn: form.tsn, tso: form.tso,
      csn: form.csn, cso: form.cso,
      due_hours: form.dueHours,
      due_date: form.dueDate || null,
      due_condition: form.dueCondition,
      shop: form.shop,
      notes: form.notes,
      category: form.category,
    };
    if (editing === 'new') {
      await supabase.from('components').insert(row);
    } else {
      await supabase.from('components').update(row).eq('id', editing);
    }
    await loadComponents();
    setEditing(null);
  }

  async function remove(id) {
    if (!window.confirm('Remover componente?')) return;
    await supabase.from('components').delete().eq('id', id);
    await loadComponents();
  }

  async function applyBulkInspection() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // For each selected component, recalculate dueHours based on TBO
    // tso is reset to 0 (just overhauled/inspected), and dueHours = currentHours + remaining TBO
    const ac = aircraft.find(a => a.id === filterAc);
    const currentHours = ac ? (parseFloat(ac.baseAirframeHours || 0) + parseFloat(ac.totalFlightHours || 0)) : 0;
    const patch = {
      tso: inspectionData.tso || '0',
      shop: inspectionData.shop || null,
      notes: inspectionData.notes || null,
    };
    await bulkUpdateComponents(ids, patch);
    setSelected(new Set());
    setBulkInspecting(false);
    setInspectionData({ date: new Date().toISOString().slice(0,10), tso: '', shop: '', notes: '' });
    await loadComponents();
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  }

  // ── Enrich with status ─────────────────────────────────────
  const enriched = useMemo(() => components.map(c => {
    const hl = hoursLeft(c.due_hours, currentHours);
    const dl = daysLeft(c.due_date);
    let status = 'current';
    if ((hl !== null && hl <= 0) || (dl !== null && dl <= 0)) status = 'overdue';
    else if ((hl !== null && hl <= 50) || (dl !== null && dl <= 30)) status = 'due_soon';
    return { ...c, hl, dl, status };
  }), [components, currentHours]);

  const filtered = enriched.filter(c => {
    if (filterCat && c.category !== filterCat) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const counts = {
    overdue:  enriched.filter(c => c.status === 'overdue').length,
    due_soon: enriched.filter(c => c.status === 'due_soon').length,
    current:  enriched.filter(c => c.status === 'current').length,
  };

  // ── CSV/text import parser ─────────────────────────────────
  async function handleImport() {
    const lines = importText.trim().split('\n').filter(l => l.trim() && !l.startsWith('NOMENCLATURA') && !l.startsWith('MAPA') && !l.startsWith('AERONAVE') && !l.startsWith('HS TOTAIS') && !l.startsWith('MANUAL') && !l.startsWith('GOIÂNIA') && !l.startsWith('OBS:') && !l.startsWith('Página'));
    const parsed = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const nom = parts[0]?.trim();
      if (!nom || nom.length < 3) continue;
      const pn = parts[1]?.trim() || '';
      const ns = parts[2]?.trim() || '';
      const tlv = parts[3]?.trim() || '';
      const tbo = parts[4]?.trim() || '';
      const tsn = parts[5]?.trim() || '';
      const tso = parts[6]?.trim() || '';
      const dueHoursRaw = parts[9]?.trim() || '';
      const dueDateRaw = parts[11]?.trim() || '';
      const shop = parts[12]?.trim() || '';

      // Auto-detect category from nomenclature
      const n = nom.toLowerCase();
      let category = 'other';
      if (n.includes('motor') && !n.includes('elétrico')) category = 'engine';
      else if (n.includes('hélice') || n.includes('governador')) category = 'propeller';
      else if (n.includes('trem') || n.includes('flap') || n.includes('atuador')) category = 'landing';
      else if (n.includes('magneto') || n.includes('alternador') || n.includes('transponder') || n.includes('altímetro') || n.includes('elt') || n.includes('bússola')) category = 'avionics';
      else if (n.includes('combustível') || n.includes('bomba') || n.includes('válvula') || n.includes('filtro')) category = 'fuel';
      else if (n.includes('vácuo')) category = 'hydraulic';
      else if (n.includes('parafuso') || n.includes('selos') || n.includes('asa') || n.includes('cintos') || n.includes('mangueir')) category = 'structure';
      else if (n.includes('extintor') || n.includes('bateria')) category = 'safety';
      else if (n.includes('licença') || n.includes('seguro') || n.includes('certificado') || n.includes('inspeção')) category = 'docs';

      // Parse due hours — "8.517.4 Hs" → need to handle Brazilian number format
      const dueHours = dueHoursRaw.replace(/\s*Hs?.*/i, '').trim();
      const dueDate = dueDateRaw && dueDateRaw !== '----' && /\d{2}\/\d{2}\/\d{4}/.test(dueDateRaw) ? dueDateRaw : '';
      const dueCondition = dueHoursRaw.toLowerCase().includes('condition') || dueDateRaw?.toLowerCase().includes('condition') ? 'On condition' : '';

      parsed.push({ nomenclature: nom, pn, ns, tlv, tbo, tsn, tso, dueHours: dueHours !== '----' ? dueHours : '', dueDate, dueCondition, shop, category });
    }
    setImportResult(`${parsed.length} componentes identificados`);

    if (parsed.length > 0 && filterAc) {
      const user = await getUser();
      const rows = parsed.map(p => ({ user_id: user.id, aircraft_id: filterAc, ...p, csn:'', cso:'', notes:'' }));
      await supabase.from('components').insert(rows);
      await loadComponents();
      setImporting(false);
      setImportText('');
    }
  }

  // ── Calendar view — by month ───────────────────────────────
  const calendarItems = useMemo(() => {
    const map = {};
    enriched.forEach(c => {
      if (!c.due_date) return;
      const key = c.due_date.slice(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  }, [enriched]);

  if (editing !== null) return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:400 }}>
          {editing === 'new' ? 'Novo componente' : 'Editar componente'}
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
          <div className="section-title">Identificação</div>
          <div style={{ marginBottom:12 }}>
            <label>Nomenclatura *</label>
            <input required value={form.nomenclature} onChange={e=>set('nomenclature',e.target.value)} placeholder="Motor / Continental IO-550-B" />
          </div>
          <div className="g3" style={{ marginBottom:12 }}>
            <div><label>P/N (Part Number)</label><input value={form.pn} onChange={e=>set('pn',e.target.value)} placeholder="IO-550-B" style={{ fontFamily:'var(--font-mono)' }} /></div>
            <div><label>N/S (Serial Number)</label><input value={form.ns} onChange={e=>set('ns',e.target.value)} placeholder="675669" style={{ fontFamily:'var(--font-mono)' }} /></div>
            <div><label>Categoria</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)}>
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
          <div className="section-title">Limites (TLV / TBO)</div>
          <div className="g2" style={{ marginBottom:12 }}>
            <div><label>TLV (Tempo Limite de Vida)</label><input value={form.tlv} onChange={e=>set('tlv',e.target.value)} placeholder="20 Anos, 10 Anos..." /></div>
            <div><label>TBO (Time Between Overhaul)</label><input value={form.tbo} onChange={e=>set('tbo',e.target.value)} placeholder="1.700 Hs / 12 Anos" /></div>
          </div>
          <div className="g2">
            <div><label>TSN (Time Since New — horas totais)</label><input value={form.tsn} onChange={e=>set('tsn',e.target.value)} placeholder="8.300.2" style={{ fontFamily:'var(--font-mono)' }} /></div>
            <div><label>TSO (Time Since Overhaul)</label><input value={form.tso} onChange={e=>set('tso',e.target.value)} placeholder="1.482.8" style={{ fontFamily:'var(--font-mono)' }} /></div>
          </div>
        </div>

        <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
          <div className="section-title">Vencimento</div>
          <div className="g3" style={{ marginBottom:12 }}>
            <div><label>Vencimento em Horas (HS/T)</label><input value={form.dueHours} onChange={e=>set('dueHours',e.target.value)} placeholder="8.517.4" style={{ fontFamily:'var(--font-mono)' }} /></div>
            <div><label>Vencimento por Data</label><input type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)} /></div>
            <div><label>Condição especial</label><input value={form.dueCondition} onChange={e=>set('dueCondition',e.target.value)} placeholder="On condition, N/A" /></div>
          </div>
          <div>
            <label>Empresa que realizou o serviço (Oficina)</label>
            <input value={form.shop} onChange={e=>set('shop',e.target.value)} placeholder="Águia Aviação e Manutenção Ltda." />
          </div>
        </div>

        <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
          <label>Observações</label>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="TCM, Registro Americano, horas seguem motor removido em 2016..." />
        </div>

        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar</button>
          <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Mapa de Controle de Componentes</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
            MCC — conforme padrão ANAC · {ac?.registration || 'Selecione a aeronave'} {ac ? `· ${currentHours.toFixed(1)}h totais` : ''}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ fontSize:11 }} onClick={() => setImporting(true)}>↑ Importar MCC</button>
          {aircraft.length > 0 && <button className="primary" onClick={startNew}>+ Componente</button>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select value={filterAc} onChange={e=>setFilterAc(e.target.value)} style={{ width:200 }}>
          {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ width:180 }}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ width:140 }}>
          <option value="">Todos status</option>
          <option value="overdue">Vencidos</option>
          <option value="due_soon">Próximos</option>
          <option value="current">Em dia</option>
        </select>

        {/* View toggle */}
        <div style={{ marginLeft:'auto', display:'flex', gap:4, background:'var(--bg2)', borderRadius:8, padding:3 }}>
          {[['list','☰ Lista'],['calendar','📅 Calendário'],['timeline','⟿ Timeline']].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)} style={{ padding:'5px 12px', borderRadius:6, border:'none', fontSize:11, fontWeight:500, cursor:'pointer', background:view===v?'var(--bg1)':'transparent', color:view===v?'var(--text1)':'var(--text3)', boxShadow:view===v?'0 1px 3px rgba(0,0,0,.15)':'' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Status cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Vencidos',  count:counts.overdue,  color:'var(--red)',   bg:'var(--red-dim)' },
          { label:'Próximos (50h / 30 dias)', count:counts.due_soon, color:'var(--amber)', bg:'var(--amber-dim)' },
          { label:'Em dia',    count:counts.current,  color:'var(--green)', bg:'var(--green-dim)' },
        ].map(s => (
          <div key={s.label} onClick={()=>setFilterStatus(filterStatus===s.label.split(' ')[0].toLowerCase()?'':s.label==='Vencidos'?'overdue':s.label.startsWith('Próx')?'due_soon':'current')}
            style={{ padding:'12px 16px', background:s.bg, border:`1px solid ${s.color}44`, borderRadius:10, display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:28, color:s.color, fontWeight:400 }}>{s.count}</div>
            <div style={{ fontSize:11, color:s.color, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── BULK BAR ─────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="bulk-bar" style={{ marginBottom:12 }}>
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ width:14, height:14 }} />
          <span>{selected.size} selecionado(s)</span>
          <button style={{ fontSize:11, padding:'4px 12px', background:'var(--blue-dim)', color:'var(--blue)', border:'1px solid var(--blue-mid)', borderRadius:6 }}
            onClick={() => setBulkInspecting(true)}>✓ Registrar inspeção em lote</button>
          <button className="destructive" style={{ fontSize:11, padding:'4px 12px' }} onClick={async () => {
            if (!window.confirm(`Remover ${selected.size} componente(s)?`)) return;
            for (const id of selected) await supabase.from('components').delete().eq('id', id);
            setSelected(new Set()); loadComponents();
          }}>🗑 Remover {selected.size}</button>
          <button className="ghost" style={{ fontSize:11 }} onClick={() => setSelected(new Set())}>Cancelar</button>
        </div>
      )}

      {/* ── BULK INSPECTION MODAL ────────────────────────────── */}
      {bulkInspecting && (
        <div style={{ padding:'16px 20px', marginBottom:14, background:'var(--bg2)', border:'1px solid var(--blue-mid)', borderRadius:12 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--blue)', marginBottom:10 }}>
            Registrar inspeção em {selected.size} componente(s)
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>
            Atualiza TSO (Time Since Overhaul) de todos os itens selecionados. Útil após inspeção programada que reseta o contador de vários componentes de uma vez.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:12 }}>
            <div><label>Data da inspeção</label><input type="date" value={inspectionData.date} onChange={e => setInspectionData(d => ({...d, date: e.target.value}))} /></div>
            <div><label>Novo TSO (horas desde OH)</label><input type="number" step="0.1" value={inspectionData.tso} onChange={e => setInspectionData(d => ({...d, tso: e.target.value}))} placeholder="0.0 (reset)" style={{ fontFamily:'var(--font-mono)' }} /></div>
            <div><label>Oficina responsável</label><input value={inspectionData.shop} onChange={e => setInspectionData(d => ({...d, shop: e.target.value}))} placeholder="Águia Aviação Ltda." /></div>
            <div><label>Observações</label><input value={inspectionData.notes} onChange={e => setInspectionData(d => ({...d, notes: e.target.value}))} placeholder="OS, referência..." /></div>
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
            Componentes afetados: {Array.from(selected).map(id => components.find(c => c.id === id)?.nomenclature).filter(Boolean).slice(0,5).join(', ')}{selected.size > 5 ? `... +${selected.size-5}` : ''}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="primary" onClick={applyBulkInspection}>Aplicar em {selected.size} componente(s)</button>
            <button onClick={() => setBulkInspecting(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Import modal */}
      {importing && (
        <div style={{ padding:'16px 20px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Importar MCC — Cole o conteúdo da planilha (TSV/CSV)</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>
            Abra o PDF em Excel ou Google Sheets, selecione todas as linhas e cole aqui. Colunas esperadas: Nomenclatura · P/N · N/S · TLV · TBO · TSN · TSO · CSN · CSO · HS/T · C/T · DATA · OBS
          </div>
          <textarea value={importText} onChange={e=>setImportText(e.target.value)} rows={8} style={{ width:'100%', marginBottom:8 }} placeholder={"Motor / Continental IO-550-B\tIO-550-B\t675669\t\t1.700 Hs / 12 Anos\t8.300.2 Hs\t1.482.8 Hs\t\t\t8.517.4 Hs\tN/A\t09/04/2022\tTCM"} />
          {importResult && <div style={{ fontSize:11, color:'var(--green)', marginBottom:8 }}>{importResult}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <button className="primary" onClick={handleImport}>Importar</button>
            <button onClick={() => { setImporting(false); setImportText(''); setImportResult(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading && <div style={{ color:'var(--text3)', fontSize:13, padding:'40px 0', textAlign:'center' }}>Carregando componentes...</div>}

      {/* ── LIST VIEW ────────────────────────────────────────── */}
      {!loading && view === 'list' && (
        <div>
          {CATEGORIES.filter(cat => filtered.some(c => c.category === cat.v)).map(cat => {
            const items = filtered.filter(c => c.category === cat.v);
            return (
              <div key={cat.v} style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.08em' }}>{cat.label}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{items.length} item(ns)</div>
                </div>
                <div className="card" style={{ overflow:'hidden', padding:0 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'var(--bg2)' }}>
                        <th style={{ padding:'7px 10px', width:32, borderBottom:'1px solid var(--border)' }}>
                          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                            onChange={toggleSelectAll} style={{ width:13, height:13 }} />
                        </th>
                        {['Nomenclatura','P/N','N/S','TBO','TSN','TSO','Vence (Hs)','Vence (Data)','Oficina','Status',''].map((h,i) => (
                          <th key={i} style={{ padding:'7px 10px', textAlign:'left', fontSize:9.5, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(c => {
                        const hl = c.hl;
                        const dl = c.dl;
                        const isSel = selected.has(c.id);
                        const rowBg = isSel ? 'var(--blue-dim)' : c.status==='overdue'?'var(--red-dim)':c.status==='due_soon'?'var(--amber-dim)':'transparent';
                        return (
                          <tr key={c.id} style={{ borderBottom:'1px solid var(--border)', background:rowBg }}>
                            <td style={{ padding:'7px 10px' }}>
                              <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.id)} style={{ width:13, height:13 }} />
                            </td>
                            <td style={{ padding:'7px 10px', fontWeight:500, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={c.nomenclature}>{c.nomenclature}</td>
                            <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text2)' }}>{c.pn || '—'}</td>
                            <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text2)' }}>{c.ns || '—'}</td>
                            <td style={{ padding:'7px 10px', color:'var(--text2)' }}>{c.tbo || '—'}</td>
                            <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:10 }}>{c.tsn || '—'}</td>
                            <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:10 }}>{c.tso || '—'}</td>
                            <td style={{ padding:'7px 10px', fontFamily:'var(--font-mono)', fontSize:10, color: hl !== null && hl <= 50 ? 'var(--amber)' : hl !== null && hl <= 0 ? 'var(--red)' : 'var(--text1)' }}>
                              {c.due_hours || c.due_condition || '—'}
                              {hl !== null && <div style={{ fontSize:9, color:'var(--text3)' }}>{hl > 0 ? `${hl.toFixed(0)}h restantes` : `${Math.abs(hl).toFixed(0)}h vencido`}</div>}
                            </td>
                            <td style={{ padding:'7px 10px', fontSize:10, color: dl !== null && dl <= 30 ? 'var(--amber)' : dl !== null && dl <= 0 ? 'var(--red)' : 'var(--text1)' }}>
                              {c.due_date ? new Date(c.due_date).toLocaleDateString('pt-BR') : '—'}
                              {dl !== null && <div style={{ fontSize:9, color:'var(--text3)' }}>{dl > 0 ? `${dl}d` : `${Math.abs(dl)}d vencido`}</div>}
                            </td>
                            <td style={{ padding:'7px 10px', color:'var(--text3)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={c.shop}>{c.shop || '—'}</td>
                            <td style={{ padding:'7px 10px' }}><StatusBadge hl={hl} dl={dl} /></td>
                            <td style={{ padding:'7px 10px' }}>
                              <div style={{ display:'flex', gap:4 }}>
                                <button style={{ fontSize:10, padding:'2px 8px' }} onClick={()=>startEdit(c)}>✎</button>
                                <button className="danger" style={{ fontSize:10, padding:'2px 8px' }} onClick={()=>remove(c.id)}>✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:.4 }}>🔩</div>
              <div style={{ fontSize:14 }}>Nenhum componente cadastrado</div>
              <div style={{ fontSize:12, marginTop:6 }}>Adicione componentes individualmente ou importe um MCC existente</div>
              <div style={{ marginTop:16, display:'flex', gap:8, justifyContent:'center' }}>
                <button onClick={()=>setImporting(true)}>↑ Importar MCC</button>
                {aircraft.length > 0 && <button className="primary" onClick={startNew}>+ Primeiro componente</button>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CALENDAR VIEW ────────────────────────────────────── */}
      {!loading && view === 'calendar' && (
        <div>
          {calendarItems.length === 0 ? (
            <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>Nenhum componente com vencimento por data cadastrado</div>
          ) : calendarItems.map(([month, items]) => {
            const [y, m] = month.split('-');
            const monthLabel = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
            const hasOverdue = items.some(c => c.status === 'overdue');
            const hasSoon = items.some(c => c.status === 'due_soon');
            return (
              <div key={month} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', textTransform:'capitalize' }}>{monthLabel}</div>
                  {hasOverdue && <span style={{ fontSize:9, color:'var(--red)', background:'var(--red-dim)', padding:'1px 6px', borderRadius:6, fontWeight:700 }}>VENCIDO</span>}
                  {hasSoon && !hasOverdue && <span style={{ fontSize:9, color:'var(--amber)', background:'var(--amber-dim)', padding:'1px 6px', borderRadius:6, fontWeight:700 }}>PRÓXIMO</span>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:8 }}>
                  {items.map(c => {
                    const s = c.status === 'overdue' ? { color:'var(--red)', bg:'var(--red-dim)', b:'var(--red)' } :
                              c.status === 'due_soon' ? { color:'var(--amber)', bg:'var(--amber-dim)', b:'var(--amber)' } :
                              { color:'var(--green)', bg:'transparent', b:'var(--border)' };
                    return (
                      <div key={c.id} style={{ padding:'10px 14px', background:s.bg, border:`1px solid ${s.b}44`, borderRadius:10, cursor:'pointer' }} onClick={()=>startEdit(c)}>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--text1)', marginBottom:3 }}>{c.nomenclature}</div>
                        <div style={{ fontSize:10, color:'var(--text2)' }}>
                          {c.due_date && new Date(c.due_date).toLocaleDateString('pt-BR')}
                          {c.dl !== null && <span style={{ color:s.color }}> · {c.dl > 0 ? `${c.dl} dias` : `${Math.abs(c.dl)}d vencido`}</span>}
                        </div>
                        {c.shop && <div style={{ fontSize:9, color:'var(--text3)', marginTop:2 }}>{c.shop}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TIMELINE VIEW ────────────────────────────────────── */}
      {!loading && view === 'timeline' && (
        <div>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>
            Componentes ordenados por horas restantes até vencimento · Base: {currentHours.toFixed(1)}h totais da aeronave
          </div>
          {enriched
            .filter(c => c.hl !== null)
            .sort((a,b) => (a.hl||0) - (b.hl||0))
            .map(c => {
              const maxH = parseHours(c.due_hours) || 1;
              const pct = Math.min(Math.max((currentHours / maxH) * 100, 0), 100);
              const s = c.status === 'overdue' ? 'var(--red)' : c.status === 'due_soon' ? 'var(--amber)' : 'var(--green)';
              return (
                <div key={c.id} style={{ marginBottom:10, padding:'10px 14px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>{c.nomenclature}</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {c.tbo && <span style={{ fontSize:10, color:'var(--text3)' }}>TBO: {c.tbo}</span>}
                      <StatusBadge hl={c.hl} dl={c.dl} />
                    </div>
                  </div>
                  <div style={{ height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:s, borderRadius:3, transition:'width .3s' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)' }}>
                    <span style={{ fontFamily:'var(--font-mono)' }}>{currentHours.toFixed(0)}h atual</span>
                    <span style={{ color:s, fontFamily:'var(--font-mono)' }}>{c.hl !== null ? (c.hl > 0 ? `${c.hl.toFixed(0)}h restantes` : `${Math.abs(c.hl).toFixed(0)}h VENCIDO`) : ''}</span>
                    <span style={{ fontFamily:'var(--font-mono)' }}>Vence: {c.due_hours}h</span>
                  </div>
                </div>
              );
            })}
          {enriched.filter(c => c.hl !== null).length === 0 && (
            <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>Nenhum componente com vencimento em horas cadastrado</div>
          )}
        </div>
      )}
    </div>
  );
}
