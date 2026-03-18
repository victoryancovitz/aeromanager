import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { getUser, saveEngineEventWithCost } from '../store';

// ── Eventos de Motor ─────────────────────────────────────────
// engine_events: rastreabilidade técnica + custo vinculado
// Tipos: install, remove, sell, buy, rent_in, rent_out,
//        program_enroll, program_exit, overhaul, borescope,
//        repair, trend_check
// ─────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { v: 'install',         label: 'Instalação',             group: 'lifecycle', color: '#3dbf8a' },
  { v: 'remove',          label: 'Remoção',                group: 'lifecycle', color: '#888' },
  { v: 'buy',             label: 'Compra',                 group: 'financial', color: '#378ADD' },
  { v: 'sell',            label: 'Venda',                  group: 'financial', color: '#7F77DD' },
  { v: 'rent_in',         label: 'Aluguel recebido',       group: 'financial', color: '#EF9F27' },
  { v: 'rent_out',        label: 'Aluguel cedido',         group: 'financial', color: '#D85A30' },
  { v: 'program_enroll',  label: 'Entrada em programa',    group: 'program',   color: '#1D9E75' },
  { v: 'program_exit',    label: 'Saída de programa',      group: 'program',   color: '#888' },
  { v: 'overhaul',        label: 'Revisão Geral (OH)',      group: 'maintenance', color: '#E24B4A' },
  { v: 'borescope',       label: 'Boroscópio',             group: 'maintenance', color: '#BA7517' },
  { v: 'repair',          label: 'Reparo pontual',         group: 'maintenance', color: '#E8A84A' },
  { v: 'trend_check',     label: 'Trend / Power Check',    group: 'monitoring',  color: '#4d9de0' },
];

const EMPTY_EVENT = {
  engine_position: 1,
  event_type: 'install',
  event_date: new Date().toISOString().slice(0, 10),
  airframe_hours_at_event: '',
  engine_tsn: '', engine_tso: '', engine_csn: '',
  amount_brl: '', currency: 'BRL', counterparty: '',
  program_name: '', program_coverage: '', program_rate_per_hour: '',
  rental_start: '', rental_end: '', rental_rate_type: 'hour', rental_rate: '',
  work_order: '', shop_name: '', doc_ref: '',
  notes: '',
};

export default function EngineEvents({ aircraft = [], selectedAircraftId }) {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_EVENT);
  const [filterAc, setFilterAc]   = useState(selectedAircraftId || '');
  const [filterType, setFilterType] = useState('');
  const [userId, setUserId]       = useState(null);
  const [createCost, setCreateCost] = useState(true); // auto-create linked cost

  useEffect(() => {
    loadEvents();
  }, [filterAc]);

  async function loadEvents() {
    setLoading(true);
    const user = await getUser();
    if (user) setUserId(user.id);
    let q = supabase.from('engine_events').select('*').order('event_date', { ascending: false });
    if (filterAc) q = q.eq('aircraft_id', filterAc);
    const { data } = await q;
    setEvents(data || []);
    setLoading(false);
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startNew() {
    setForm({ ...EMPTY_EVENT, aircraftId: filterAc || aircraft[0]?.id || '' });
    setEditing('new');
  }

  function startEdit(ev) {
    setForm({
      engine_position: ev.engine_position || 1,
      event_type: ev.event_type,
      event_date: ev.event_date,
      airframe_hours_at_event: ev.airframe_hours_at_event || '',
      engine_tsn: ev.engine_tsn || '', engine_tso: ev.engine_tso || '', engine_csn: ev.engine_csn || '',
      amount_brl: ev.amount_brl || '', currency: ev.currency || 'BRL', counterparty: ev.counterparty || '',
      program_name: ev.program_name || '', program_coverage: ev.program_coverage || '',
      program_rate_per_hour: ev.program_rate_per_hour || '',
      rental_start: ev.rental_start || '', rental_end: ev.rental_end || '',
      rental_rate_type: ev.rental_rate_type || 'hour', rental_rate: ev.rental_rate || '',
      work_order: ev.work_order || '', shop_name: ev.shop_name || '', doc_ref: ev.doc_ref || '',
      notes: ev.notes || '',
      aircraftId: ev.aircraft_id,
    });
    setEditing(ev.id);
  }

  async function submit(e) {
    e.preventDefault();
    const eventData = {
      id: editing !== 'new' ? editing : undefined,
      aircraft_id: form.aircraftId || filterAc,
      engine_position: parseInt(form.engine_position) || 1,
      event_type: form.event_type,
      event_date: form.event_date,
      airframe_hours_at_event: form.airframe_hours_at_event || null,
      engine_tsn: form.engine_tsn || null,
      engine_tso: form.engine_tso || null,
      engine_csn: form.engine_csn || null,
      amount_brl: form.amount_brl || null,
      currency: form.currency || 'BRL',
      counterparty: form.counterparty || null,
      program_name: form.program_name || null,
      program_coverage: form.program_coverage || null,
      program_rate_per_hour: form.program_rate_per_hour || null,
      rental_start: form.rental_start || null,
      rental_end: form.rental_end || null,
      rental_rate_type: form.rental_rate_type || null,
      rental_rate: form.rental_rate || null,
      work_order: form.work_order || null,
      shop_name: form.shop_name || null,
      doc_ref: form.doc_ref || null,
      notes: form.notes || null,
    };
    await saveEngineEventWithCost(eventData, createCost);
    await loadEvents();
    setEditing(null);
  }

  async function remove(id) {
    if (!window.confirm('Remover evento?')) return;
    await supabase.from('engine_events').delete().eq('id', id);
    await loadEvents();
  }

  const getAc = (id) => aircraft.find(a => a.id === id);
  const getType = (v) => EVENT_TYPES.find(t => t.v === v) || EVENT_TYPES[0];

  const isFinancial = ['buy','sell','rent_in','rent_out'].includes(form.event_type);
  const isProgram   = ['program_enroll','program_exit'].includes(form.event_type);
  const isRental    = ['rent_in','rent_out'].includes(form.event_type);

  const filtered = events.filter(ev => !filterType || ev.event_type === filterType);

  if (editing !== null) return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>
          {editing === 'new' ? 'Novo evento de motor' : 'Editar evento'}
        </div>
      </div>
      <form onSubmit={submit}>
        {/* Identificação */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Identificação do evento</div>
          <div className="g3" style={{ marginBottom: 12 }}>
            <div>
              <label>Aeronave *</label>
              <select required value={form.aircraftId || ''} onChange={e => set('aircraftId', e.target.value)}>
                <option value="">Selecione...</option>
                {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
              </select>
            </div>
            <div>
              <label>Posição do motor</label>
              <select value={form.engine_position} onChange={e => set('engine_position', e.target.value)}>
                <option value={0}>APU</option>
                <option value={1}>Motor #1 (único / esq.)</option>
                <option value={2}>Motor #2 (dir.)</option>
                <option value={3}>Motor #3</option>
                <option value={4}>Motor #4</option>
              </select>
            </div>
            <div>
              <label>Data do evento *</label>
              <input type="date" required value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
          </div>
          <div className="g2">
            <div>
              <label>Tipo de evento *</label>
              <select required value={form.event_type} onChange={e => set('event_type', e.target.value)}>
                {['lifecycle','financial','program','maintenance','monitoring'].map(grp => (
                  <optgroup key={grp} label={grp.charAt(0).toUpperCase() + grp.slice(1)}>
                    {EVENT_TYPES.filter(t => t.group === grp).map(t => (
                      <option key={t.v} value={t.v}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label>Horas da célula no evento</label>
              <input type="number" step="0.1" value={form.airframe_hours_at_event} onChange={e => set('airframe_hours_at_event', e.target.value)} placeholder="13.524,7" style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
        </div>

        {/* Horas do motor */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
          <div className="section-title">Estado do motor (horas / ciclos)</div>
          <div className="g3">
            <div><label>TSN (Time Since New)</label><input type="number" step="0.1" value={form.engine_tsn} onChange={e => set('engine_tsn', e.target.value)} placeholder="8.300,2" style={{ fontFamily: 'var(--font-mono)' }} /></div>
            <div><label>TSO (Time Since Overhaul)</label><input type="number" step="0.1" value={form.engine_tso} onChange={e => set('engine_tso', e.target.value)} placeholder="1.482,8" style={{ fontFamily: 'var(--font-mono)' }} /></div>
            <div><label>CSN (Cycles Since New)</label><input type="number" value={form.engine_csn} onChange={e => set('engine_csn', e.target.value)} placeholder="0" style={{ fontFamily: 'var(--font-mono)' }} /></div>
          </div>
        </div>

        {/* Campos financeiros */}
        {(isFinancial || form.amount_brl) && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
            <div className="section-title">Dados financeiros</div>
            <div className="g3">
              <div><label>Valor (R$)</label><input type="number" step="0.01" value={form.amount_brl} onChange={e => set('amount_brl', e.target.value)} placeholder="0,00" /></div>
              <div><label>Moeda</label><select value={form.currency} onChange={e => set('currency', e.target.value)}><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
              <div><label>Contraparte (empresa / pessoa)</label><input value={form.counterparty} onChange={e => set('counterparty', e.target.value)} placeholder="Empresa ABC" /></div>
            </div>
          </div>
        )}

        {/* Programa de motor */}
        {isProgram && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
            <div className="section-title">Programa de motor</div>
            <div className="g3">
              <div><label>Nome do programa</label><input value={form.program_name} onChange={e => set('program_name', e.target.value)} placeholder="JSSI, MSP, TAP, EME..." /></div>
              <div><label>Taxa (R$ ou US$ por hora)</label><input type="number" step="0.01" value={form.program_rate_per_hour} onChange={e => set('program_rate_per_hour', e.target.value)} placeholder="0,00" /></div>
              <div></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Cobertura</label>
              <input value={form.program_coverage} onChange={e => set('program_coverage', e.target.value)} placeholder="OH completo, LLP, workscope definido, on-wing..." />
            </div>
          </div>
        )}

        {/* Aluguel */}
        {isRental && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
            <div className="section-title">Detalhes do aluguel</div>
            <div className="g3">
              <div><label>Início</label><input type="date" value={form.rental_start} onChange={e => set('rental_start', e.target.value)} /></div>
              <div><label>Fim (previsto)</label><input type="date" value={form.rental_end} onChange={e => set('rental_end', e.target.value)} /></div>
              <div><label>Tipo de taxa</label>
                <select value={form.rental_rate_type} onChange={e => set('rental_rate_type', e.target.value)}>
                  <option value="hour">Por hora</option>
                  <option value="month">Por mês</option>
                  <option value="cycle">Por ciclo</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Taxa de aluguel (R$)</label>
              <input type="number" step="0.01" value={form.rental_rate} onChange={e => set('rental_rate', e.target.value)} style={{ maxWidth: 200 }} />
            </div>
          </div>
        )}

        {/* Referências */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div className="section-title">Referências e observações</div>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div><label>OS da oficina</label><input value={form.work_order} onChange={e => set('work_order', e.target.value)} placeholder="OS-2024-001" style={{ fontFamily: 'var(--font-mono)' }} /></div>
            <div><label>Oficina / MRO</label><input value={form.shop_name} onChange={e => set('shop_name', e.target.value)} placeholder="Águia Aviação Ltda." /></div>
            <div><label>Referência do documento</label><input value={form.doc_ref} onChange={e => set('doc_ref', e.target.value)} placeholder="CRS, 8130, etc." style={{ fontFamily: 'var(--font-mono)' }} /></div>
          </div>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Observações adicionais..." />
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg0)', padding: '12px 0', marginTop: 4, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar evento</button>
          <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
          {form.amount_brl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer', marginLeft: 8, padding: '6px 10px', background: 'var(--green-dim)', borderRadius: 8, border: '1px solid var(--green-mid)' }}>
              <input type="checkbox" checked={createCost} onChange={e => setCreateCost(e.target.checked)} />
              Criar custo vinculado automaticamente (R$ {parseFloat(form.amount_brl).toFixed(2)})
            </label>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400 }}>Histórico de Motor</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            Rastreabilidade técnica + financeira · {events.length} evento(s)
          </div>
        </div>
        <button className="primary" onClick={startNew}>+ Novo evento</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={filterAc} onChange={e => setFilterAc(e.target.value)} style={{ width: 220 }}>
          <option value="">Todas as aeronaves</option>
          {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos os tipos</option>
          {['lifecycle','financial','program','maintenance','monitoring'].map(grp => (
            <optgroup key={grp} label={grp}>
              {EVENT_TYPES.filter(t => t.group === grp).map(t => (
                <option key={t.v} value={t.v}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: .4 }}>⚙</div>
          <div style={{ fontSize: 13 }}>Nenhum evento registrado</div>
          <button className="primary" style={{ marginTop: 16 }} onClick={startNew}>Registrar primeiro evento</button>
        </div>
      ) : (
        <div>
          {filtered.map(ev => {
            const t = getType(ev.event_type);
            const ac = getAc(ev.aircraft_id);
            const posLabel = ev.engine_position === 0 ? 'APU' : `Motor #${ev.engine_position}`;
            return (
              <div key={ev.id} style={{ padding: '12px 16px', marginBottom: 8, background: 'var(--bg1)', border: '1px solid var(--border)', borderLeft: `3px solid ${t.color}`, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.color, background: t.color + '20', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, textAlign: 'center' }}>{posLabel}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {ac?.registration || '—'} · {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    {ev.airframe_hours_at_event && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{ev.airframe_hours_at_event}h célula</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {ev.engine_tsn && <span style={{ fontSize: 11, color: 'var(--text2)' }}>TSN: <span style={{ fontFamily: 'var(--font-mono)' }}>{ev.engine_tsn}h</span></span>}
                    {ev.engine_tso && <span style={{ fontSize: 11, color: 'var(--text2)' }}>TSO: <span style={{ fontFamily: 'var(--font-mono)' }}>{ev.engine_tso}h</span></span>}
                    {ev.amount_brl && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{ev.currency} {parseFloat(ev.amount_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                    {ev.shop_name && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{ev.shop_name}</span>}
                    {ev.program_name && <span style={{ fontSize: 11, color: 'var(--teal)', background: 'var(--teal-dim)', padding: '1px 6px', borderRadius: 5 }}>{ev.program_name}</span>}
                    {ev.work_order && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>OS: {ev.work_order}</span>}
                  </div>
                  {ev.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{ev.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => startEdit(ev)}>✎</button>
                  <button className="danger" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => remove(ev.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
