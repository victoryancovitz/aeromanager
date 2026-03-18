import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { getUser } from '../store';

// ── Gerenciador de Aeroportos e Taxas ───────────────────────
// Tabela global (leitura pública) + overrides pessoais
// Tipo: público / privado / militar / heliporto
// ─────────────────────────────────────────────────────────────

const AIRPORT_TYPES = [
  { v: 'public',    label: 'Público',    color: '#378ADD' },
  { v: 'private',   label: 'Privado',    color: '#639922' },
  { v: 'military',  label: 'Militar',    color: '#888' },
  { v: 'helipad',   label: 'Heliporto',  color: '#D85A30' },
];

const EMPTY_AIRPORT = {
  icao: '', iata: '', name: '', city: '', state: '', country: 'BR',
  type: 'public', anac_category: '',
  lat: '', lng: '',
  landing_fee_brl: '', landing_fee_per_ton: false,
  parking_fee_brl_hour: '', hangar_fee_brl_day: '',
  atis_fee_brl: '', handling_fee_brl: '',
  fuel_avgas_brl_l: '', fuel_jeta1_brl_l: '',
  has_tower: false, has_app: false, has_afis: false,
  has_customs: false, has_mro: false, has_catering: false,
  has_avgas: false, has_jeta1: false,
  notes: '',
};

function fmt(v) { return v != null && v !== '' ? `R$ ${parseFloat(v).toFixed(2)}` : '—'; }

export default function AirportManager() {
  const [airports, setAirports]   = useState([]);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_AIRPORT);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('');
  const [selected, setSelected]   = useState(new Set());
  const [importMode, setImportMode] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState('');
  const [userId, setUserId]       = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const user = await getUser();
    if (user) setUserId(user.id);

    const { data: aps } = await supabase
      .from('airports_db').select('*').order('icao');
    setAirports(aps || []);

    if (user) {
      const { data: ov } = await supabase
        .from('airport_overrides').select('*').eq('user_id', user.id);
      const map = {};
      (ov || []).forEach(o => { map[o.airport_id] = o; });
      setOverrides(map);
    }
    setLoading(false);
  }

  // Merge airport with user override
  function merged(ap) {
    const ov = overrides[ap.id] || {};
    return {
      ...ap,
      landing_fee_brl:      ov.landing_fee_brl      ?? ap.landing_fee_brl,
      parking_fee_brl_hour: ov.parking_fee_brl_hour ?? ap.parking_fee_brl_hour,
      hangar_fee_brl_day:   ov.hangar_fee_brl_day   ?? ap.hangar_fee_brl_day,
      atis_fee_brl:         ov.atis_fee_brl          ?? ap.atis_fee_brl,
      fuel_avgas_brl_l:     ov.fuel_avgas_brl_l      ?? ap.fuel_avgas_brl_l,
      fuel_jeta1_brl_l:     ov.fuel_jeta1_brl_l      ?? ap.fuel_jeta1_brl_l,
      _hasOverride: !!overrides[ap.id],
    };
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return airports
      .map(merged)
      .filter(ap => {
        if (filterType && ap.type !== filterType) return false;
        if (!q) return true;
        return ap.icao.toLowerCase().includes(q) ||
               ap.name.toLowerCase().includes(q) ||
               (ap.city || '').toLowerCase().includes(q);
      });
  }, [airports, overrides, search, filterType]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startNew() {
    setForm({ ...EMPTY_AIRPORT });
    setEditing('new');
  }

  function startEdit(ap) {
    const ov = overrides[ap.id] || {};
    setForm({
      ...ap,
      // Merge overrides for display
      landing_fee_brl:      ov.landing_fee_brl      ?? ap.landing_fee_brl      ?? '',
      parking_fee_brl_hour: ov.parking_fee_brl_hour ?? ap.parking_fee_brl_hour ?? '',
      hangar_fee_brl_day:   ov.hangar_fee_brl_day   ?? ap.hangar_fee_brl_day   ?? '',
      atis_fee_brl:         ov.atis_fee_brl          ?? ap.atis_fee_brl          ?? '',
      fuel_avgas_brl_l:     ov.fuel_avgas_brl_l      ?? ap.fuel_avgas_brl_l      ?? '',
      fuel_jeta1_brl_l:     ov.fuel_jeta1_brl_l      ?? ap.fuel_jeta1_brl_l      ?? '',
    });
    setEditing(ap.id);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      icao: form.icao.toUpperCase().trim(),
      iata: form.iata?.toUpperCase().trim() || null,
      name: form.name,
      city: form.city, state: form.state, country: form.country || 'BR',
      type: form.type, anac_category: form.anac_category || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      landing_fee_brl: form.landing_fee_brl || null,
      landing_fee_per_ton: form.landing_fee_per_ton,
      parking_fee_brl_hour: form.parking_fee_brl_hour || null,
      hangar_fee_brl_day: form.hangar_fee_brl_day || null,
      atis_fee_brl: form.atis_fee_brl || null,
      handling_fee_brl: form.handling_fee_brl || null,
      fuel_avgas_brl_l: form.fuel_avgas_brl_l || null,
      fuel_jeta1_brl_l: form.fuel_jeta1_brl_l || null,
      has_tower: !!form.has_tower, has_app: !!form.has_app,
      has_afis: !!form.has_afis, has_customs: !!form.has_customs,
      has_mro: !!form.has_mro, has_catering: !!form.has_catering,
      has_avgas: !!form.has_avgas, has_jeta1: !!form.has_jeta1,
      notes: form.notes || null,
      created_by: userId, updated_by: userId,
    };

    if (editing === 'new') {
      await supabase.from('airports_db').insert(payload);
    } else {
      // Save as override if not the creator, else update directly
      const ap = airports.find(a => a.id === editing);
      if (ap?.created_by === userId) {
        await supabase.from('airports_db').update({ ...payload, updated_by: userId }).eq('id', editing);
      } else {
        // Save override only (taxas personalizadas)
        const overridePayload = {
          user_id: userId, airport_id: editing,
          landing_fee_brl: form.landing_fee_brl || null,
          parking_fee_brl_hour: form.parking_fee_brl_hour || null,
          hangar_fee_brl_day: form.hangar_fee_brl_day || null,
          atis_fee_brl: form.atis_fee_brl || null,
          fuel_avgas_brl_l: form.fuel_avgas_brl_l || null,
          fuel_jeta1_brl_l: form.fuel_jeta1_brl_l || null,
          notes: form.notes || null,
        };
        await supabase.from('airport_overrides').upsert(overridePayload, { onConflict: 'user_id,airport_id' });
      }
    }
    await load();
    setEditing(null);
  }

  async function remove(id) {
    if (!window.confirm('Remover aeroporto?')) return;
    await supabase.from('airports_db').delete().eq('id', id);
    await load();
  }

  // ── Bulk edit selected airports
  async function bulkEdit(field, value) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // Save as overrides for each
    const rows = ids.map(airport_id => ({
      user_id: userId, airport_id,
      [field]: value || null,
    }));
    await supabase.from('airport_overrides').upsert(rows, { onConflict: 'user_id,airport_id' });
    setSelected(new Set());
    await load();
  }

  // ── CSV/TSV Import
  async function handleImport() {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    const rows = [];
    for (const line of lines) {
      const p = line.split(/[,\t]/);
      if (p.length < 2) continue;
      const icao = p[0]?.trim().toUpperCase();
      if (!icao || icao.length < 3) continue;
      rows.push({
        icao,
        iata: p[1]?.trim().toUpperCase() || null,
        name: p[2]?.trim() || icao,
        city: p[3]?.trim() || null,
        state: p[4]?.trim() || null,
        country: p[5]?.trim() || 'BR',
        type: p[6]?.trim().toLowerCase() || 'public',
        landing_fee_brl: p[7] ? parseFloat(p[7]) : null,
        parking_fee_brl_hour: p[8] ? parseFloat(p[8]) : null,
        hangar_fee_brl_day: p[9] ? parseFloat(p[9]) : null,
        fuel_avgas_brl_l: p[10] ? parseFloat(p[10]) : null,
        fuel_jeta1_brl_l: p[11] ? parseFloat(p[11]) : null,
        created_by: userId, updated_by: userId,
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('airports_db')
        .upsert(rows, { onConflict: 'icao,country', ignoreDuplicates: false });
      if (error) {
        setImportResult(`Erro: ${error.message}`);
      } else {
        setImportResult(`${rows.length} aeroporto(s) importado(s) com sucesso`);
        await load();
      }
    } else {
      setImportResult('Nenhuma linha válida encontrada. Verifique o formato.');
    }
  }

  const typeInfo = (t) => AIRPORT_TYPES.find(x => x.v === t) || AIRPORT_TYPES[0];

  if (editing !== null) return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>
          {editing === 'new' ? 'Novo aeroporto' : `Editar ${form.icao}`}
        </div>
        {editing !== 'new' && airports.find(a => a.id === editing)?.created_by !== userId && (
          <span style={{ fontSize: 10, color: 'var(--amber)', background: 'var(--amber-dim)', padding: '2px 8px', borderRadius: 6 }}>
            Suas taxas personalizadas — não altera a base global
          </span>
        )}
      </div>
      <form onSubmit={submit}>
        {/* Identificação */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Identificação</div>
          <div className="g3" style={{ marginBottom: 12 }}>
            <div>
              <label>ICAO *</label>
              <input required value={form.icao} onChange={e => set('icao', e.target.value.toUpperCase())}
                placeholder="SBSP" maxLength={6} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
            </div>
            <div>
              <label>IATA</label>
              <input value={form.iata || ''} onChange={e => set('iata', e.target.value.toUpperCase())}
                placeholder="CGH" maxLength={4} style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label>Tipo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {AIRPORT_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="g2" style={{ marginBottom: 12 }}>
            <div><label>Nome do aeródromo *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Aeroporto de Congonhas" />
            </div>
            <div><label>Categoria ANAC</label>
              <select value={form.anac_category || ''} onChange={e => set('anac_category', e.target.value)}>
                <option value="">—</option>
                {['A','B','C','D','E'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="g3">
            <div><label>Cidade</label><input value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="São Paulo" /></div>
            <div><label>Estado (UF)</label><input value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="SP" maxLength={2} /></div>
            <div><label>País</label><input value={form.country || 'BR'} onChange={e => set('country', e.target.value)} placeholder="BR" maxLength={2} /></div>
          </div>
        </div>

        {/* Taxas */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Taxas e Tarifas</div>
          <div className="g3" style={{ marginBottom: 12 }}>
            <div>
              <label>Pouso (R$)</label>
              <input type="number" step="0.01" value={form.landing_fee_brl || ''} onChange={e => set('landing_fee_brl', e.target.value)} placeholder="0.00" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.landing_fee_per_ton} onChange={e => set('landing_fee_per_ton', e.target.checked)} />
                Por tonelada MTOW
              </label>
            </div>
            <div><label>Permanência (R$/hora)</label>
              <input type="number" step="0.01" value={form.parking_fee_brl_hour || ''} onChange={e => set('parking_fee_brl_hour', e.target.value)} placeholder="0.00" /></div>
            <div><label>Hangar (R$/diária)</label>
              <input type="number" step="0.01" value={form.hangar_fee_brl_day || ''} onChange={e => set('hangar_fee_brl_day', e.target.value)} placeholder="0.00" /></div>
          </div>
          <div className="g3" style={{ marginBottom: 12 }}>
            <div><label>ATIS / Auxílios (R$)</label>
              <input type="number" step="0.01" value={form.atis_fee_brl || ''} onChange={e => set('atis_fee_brl', e.target.value)} placeholder="0.00" /></div>
            <div><label>Handling (R$)</label>
              <input type="number" step="0.01" value={form.handling_fee_brl || ''} onChange={e => set('handling_fee_brl', e.target.value)} placeholder="0.00" /></div>
            <div></div>
          </div>
          <div className="g2">
            <div><label>AVGAS 100LL (R$/L)</label>
              <input type="number" step="0.01" value={form.fuel_avgas_brl_l || ''} onChange={e => set('fuel_avgas_brl_l', e.target.value)} placeholder="0.000" /></div>
            <div><label>Jet-A1 (R$/L)</label>
              <input type="number" step="0.01" value={form.fuel_jeta1_brl_l || ''} onChange={e => set('fuel_jeta1_brl_l', e.target.value)} placeholder="0.000" /></div>
          </div>
        </div>

        {/* Serviços */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Serviços disponíveis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              ['has_tower',    'Torre ATC'],
              ['has_app',      'APP / TMA'],
              ['has_afis',     'AFIS / Auto-info'],
              ['has_customs',  'Customs / Imigração'],
              ['has_mro',      'Oficina MRO'],
              ['has_catering', 'Catering'],
              ['has_avgas',    'AVGAS 100LL'],
              ['has_jeta1',    'Jet-A1'],
            ].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <label>Coordenadas e observações</label>
          <div className="g2" style={{ marginBottom: 10 }}>
            <div><label>Latitude</label><input type="number" step="0.000001" value={form.lat || ''} onChange={e => set('lat', e.target.value)} placeholder="-23.626" /></div>
            <div><label>Longitude</label><input type="number" step="0.000001" value={form.lng || ''} onChange={e => set('lng', e.target.value)} placeholder="-46.656" /></div>
          </div>
          <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Observações, restrições, horário de funcionamento..." />
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400 }}>Aeroportos & Taxas</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            Base global · {airports.length} aeródromo(s) · Suas taxas personalizadas ficam salvas separadamente
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ fontSize: 11 }} onClick={() => setImportMode(!importMode)}>↑ Importar CSV</button>
          <button className="primary" onClick={startNew}>+ Aeroporto</button>
        </div>
      </div>

      {/* Filters + bulk actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por ICAO, nome ou cidade..." style={{ width: 260 }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 140 }}>
          <option value="">Todos os tipos</option>
          {AIRPORT_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 12px', background: 'var(--blue-dim)', borderRadius: 8, border: '1px solid var(--blue-mid)' }}>
            <span style={{ fontSize: 11, color: 'var(--blue)' }}>{selected.size} selecionado(s)</span>
            <select style={{ fontSize: 11, height: 26 }} onChange={e => {
              if (!e.target.value) return;
              const [field, ...rest] = e.target.value.split(':');
              const value = prompt(`Novo valor para ${field} (R$):`);
              if (value !== null) bulkEdit(field, value);
              e.target.value = '';
            }}>
              <option value="">Editar em lote...</option>
              <option value="parking_fee_brl_hour">Permanência (R$/h)</option>
              <option value="hangar_fee_brl_day">Hangar (R$/dia)</option>
              <option value="fuel_avgas_brl_l">AVGAS (R$/L)</option>
              <option value="fuel_jeta1_brl_l">Jet-A1 (R$/L)</option>
              <option value="landing_fee_brl">Pouso (R$)</option>
            </select>
            <button style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setSelected(new Set())}>✕</button>
          </div>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{filtered.length} resultado(s)</span>
      </div>

      {/* Import panel */}
      {importMode && (
        <div style={{ padding: '14px 18px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Importar CSV / TSV</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Formato: ICAO · IATA · Nome · Cidade · Estado · País · Tipo · Pouso · Permanência/h · Hangar/dia · AVGAS/L · JetA1/L
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 8, padding: '6px 10px', background: 'var(--bg1)', borderRadius: 6 }}>
            SBSP,CGH,Congonhas,São Paulo,SP,BR,public,150.00,25.00,320.00,8.90,6.20
          </div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} style={{ width: '100%', marginBottom: 8 }} placeholder="Cole aqui os dados CSV ou TSV..." />
          {importResult && <div style={{ fontSize: 11, color: importResult.startsWith('Erro') ? 'var(--red)' : 'var(--green)', marginBottom: 8 }}>{importResult}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={handleImport}>Importar</button>
            <button onClick={() => { setImportMode(false); setImportText(''); setImportResult(''); }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)' }}>Carregando aeroportos...</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                <th style={{ padding: '8px 10px', width: 32 }}>
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(filtered.map(a => a.id)) : new Set())} />
                </th>
                {['ICAO','Tipo','Nome','Cidade','Pouso','Perman./h','Hangar/dia','AVGAS/L','JetA1/L','Serviços',''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ap => {
                const t = typeInfo(ap.type);
                const isSel = selected.has(ap.id);
                const services = [
                  ap.has_tower && 'TWR', ap.has_app && 'APP', ap.has_afis && 'AFIS',
                  ap.has_customs && 'CUST', ap.has_mro && 'MRO', ap.has_avgas && 'AVGAS', ap.has_jeta1 && 'JET',
                ].filter(Boolean);
                return (
                  <tr key={ap.id} style={{ borderBottom: '1px solid var(--border)', background: isSel ? 'var(--blue-dim)' : 'transparent' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <input type="checkbox" checked={isSel} onChange={e => {
                        const s = new Set(selected);
                        e.target.checked ? s.add(ap.id) : s.delete(ap.id);
                        setSelected(s);
                      }} />
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {ap.icao}
                      {ap._hasOverride && <span style={{ fontSize: 8, color: 'var(--blue)', marginLeft: 4, background: 'var(--blue-dim)', padding: '1px 4px', borderRadius: 4 }}>custom</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: t.color, background: t.color + '22', padding: '2px 6px', borderRadius: 5 }}>{t.label}</span>
                    </td>
                    <td style={{ padding: '8px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.name}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{ap.city || '—'}{ap.state ? ` · ${ap.state}` : ''}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{fmt(ap.landing_fee_brl)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{fmt(ap.parking_fee_brl_hour)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{fmt(ap.hangar_fee_brl_day)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{ap.fuel_avgas_brl_l ? `R$ ${parseFloat(ap.fuel_avgas_brl_l).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{ap.fuel_jeta1_brl_l ? `R$ ${parseFloat(ap.fuel_jeta1_brl_l).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {services.slice(0,4).map(s => (
                          <span key={s} style={{ fontSize: 8, color: 'var(--text2)', background: 'var(--bg2)', padding: '1px 4px', borderRadius: 4, border: '0.5px solid var(--border)' }}>{s}</span>
                        ))}
                        {services.length > 4 && <span style={{ fontSize: 8, color: 'var(--text3)' }}>+{services.length - 4}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => startEdit(ap)}>✎</button>
                        <button className="danger" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => remove(ap.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={12} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                    {search ? `Nenhum aeroporto encontrado para "${search}"` : 'Nenhum aeroporto cadastrado'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
