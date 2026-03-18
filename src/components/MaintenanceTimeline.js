import React, { useState, useMemo } from 'react';

const STATUS_COLOR = {
  overdue:  { bg: 'var(--red-dim)',    border: 'var(--red)',    text: 'var(--red)',    label: 'Vencido' },
  due_soon: { bg: 'var(--amber-dim)',  border: 'var(--amber)',  text: 'var(--amber)',  label: 'Próximo' },
  current:  { bg: 'var(--green-dim)', border: 'var(--green)',  text: 'var(--green)',  label: 'Em dia' },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / 86400000);
}

function hoursUntil(nextHours, currentHours) {
  if (!nextHours || !currentHours) return null;
  return parseFloat(nextHours) - parseFloat(currentHours);
}

export default function MaintenanceTimeline({ maintenance=[], aircraft=[] }) {
  const [viewMode, setViewMode] = useState('timeline'); // timeline | list
  const [filterAc, setFilterAc] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const enriched = useMemo(() => {
    return maintenance
      .filter(m => !filterAc || m.aircraftId === filterAc)
      .map(m => {
        const ac = aircraft.find(a => a.id === m.aircraftId);
        const currentHours = parseFloat(ac?.baseAirframeHours || 0) + parseFloat(ac?.totalFlightHours || 0);
        const hLeft = hoursUntil(m.nextDueHours, currentHours);
        const dLeft = daysUntil(m.nextDueDate);

        let status = m.status || 'current';
        if (hLeft !== null) status = hLeft <= 0 ? 'overdue' : hLeft <= 10 ? 'due_soon' : 'current';
        if (dLeft !== null) {
          if (dLeft <= 0) status = 'overdue';
          else if (dLeft <= 30 && status !== 'overdue') status = 'due_soon';
        }

        // Urgency score for sorting
        let urgency = 999;
        if (status === 'overdue') urgency = -1;
        else if (hLeft !== null && hLeft < urgency) urgency = hLeft;
        else if (dLeft !== null && dLeft < urgency) urgency = dLeft;

        return { ...m, ac, currentHours, hLeft, dLeft, status, urgency };
      })
      .filter(m => filterStatus === 'all' || m.status === filterStatus)
      .sort((a, b) => a.urgency - b.urgency);
  }, [maintenance, aircraft, filterAc, filterStatus]);

  const counts = useMemo(() => ({
    overdue:  enriched.filter(m => m.status === 'overdue').length,
    due_soon: enriched.filter(m => m.status === 'due_soon').length,
    current:  enriched.filter(m => m.status === 'current').length,
  }), [enriched]);

  const totalCostPending = enriched
    .filter(m => m.status !== 'current')
    .reduce((s, m) => s + parseFloat(m.estimatedCostBrl || 0), 0);

  // Group by month for timeline view
  const byMonth = useMemo(() => {
    const groups = {};
    const now = new Date();
    enriched.forEach(m => {
      let monthKey;
      if (m.status === 'overdue') {
        monthKey = 'VENCIDO';
      } else if (m.nextDueDate) {
        const d = new Date(m.nextDueDate + 'T12:00:00');
        monthKey = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      } else if (m.hLeft !== null && m.hLeft > 0) {
        // Estimate month based on average hours per month
        const hoursPerMonth = 20; // rough estimate
        const monthsOut = Math.floor(m.hLeft / hoursPerMonth);
        const est = new Date(now);
        est.setMonth(est.getMonth() + monthsOut);
        monthKey = est.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) + ' (est.)';
      } else {
        monthKey = 'Sem data definida';
      }
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(m);
    });
    return groups;
  }, [enriched]);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: 'var(--text1)' }}>Linha do Tempo de Manutenção</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {maintenance.length} item(ns) · Custo pendente: <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>R$ {Math.round(totalCostPending).toLocaleString('pt-BR')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setViewMode('timeline')} style={{ fontSize: 11, padding: '6px 14px', background: viewMode === 'timeline' ? 'var(--blue-dim)' : 'var(--bg2)', color: viewMode === 'timeline' ? 'var(--blue)' : 'var(--text3)', borderColor: viewMode === 'timeline' ? 'var(--blue-mid)' : 'var(--border)' }}>📅 Linha do tempo</button>
          <button onClick={() => setViewMode('list')} style={{ fontSize: 11, padding: '6px 14px', background: viewMode === 'list' ? 'var(--blue-dim)' : 'var(--bg2)', color: viewMode === 'list' ? 'var(--blue)' : 'var(--text3)', borderColor: viewMode === 'list' ? 'var(--blue-mid)' : 'var(--border)' }}>📋 Lista</button>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'overdue',  label: 'Vencidos',     color: 'var(--red)',   bg: 'var(--red-dim)' },
          { key: 'due_soon', label: 'Próx. 30 dias', color: 'var(--amber)', bg: 'var(--amber-dim)' },
          { key: 'current',  label: 'Em dia',        color: 'var(--green)', bg: 'var(--green-dim)' },
        ].map(s => (
          <div
            key={s.key}
            onClick={() => setFilterStatus(f => f === s.key ? 'all' : s.key)}
            style={{ background: filterStatus === s.key ? s.bg : 'var(--bg1)', border: `1px solid ${filterStatus === s.key ? s.color : 'var(--border)'}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', transition: 'all .2s' }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 400, color: s.color, marginBottom: 4 }}>{counts[s.key]}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {aircraft.length > 1 && (
          <select value={filterAc} onChange={e => setFilterAc(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todas as aeronaves</option>
            {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration}</option>)}
          </select>
        )}
        {filterStatus !== 'all' && (
          <button className="ghost" onClick={() => setFilterStatus('all')} style={{ fontSize: 11 }}>
            ✕ Limpar filtro
          </button>
        )}
      </div>

      {enriched.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔧</div>
          <div style={{ fontWeight: 500 }}>Nenhum item encontrado</div>
        </div>
      ) : viewMode === 'timeline' ? (
        // Timeline view
        <div>
          {Object.entries(byMonth).map(([month, items]) => (
            <div key={month} style={{ marginBottom: 28 }}>
              {/* Month header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: month === 'VENCIDO' ? 'var(--red)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', whiteSpace: 'nowrap' }}>{month}</div>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {items.reduce((s, m) => s + parseFloat(m.estimatedCostBrl || 0), 0) > 0
                    ? `R$ ${Math.round(items.reduce((s,m)=>s+parseFloat(m.estimatedCostBrl||0),0)).toLocaleString('pt-BR')}`
                    : ''}
                </div>
              </div>

              {/* Items */}
              <div style={{ paddingLeft: 0 }}>
                {items.map(m => {
                  const sc = STATUS_COLOR[m.status];
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                      {/* Timeline dot + line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc.border, flexShrink: 0, boxShadow: m.status !== 'current' ? `0 0 6px ${sc.border}` : 'none' }} />
                        <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />
                      </div>

                      {/* Card */}
                      <div style={{ flex: 1, background: m.status !== 'current' ? sc.bg : 'var(--bg1)', border: `1px solid ${m.status !== 'current' ? sc.border + '66' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text1)', marginBottom: 3 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              {m.ac && <span>{m.ac.registration}</span>}
                              {m.hLeft !== null && (
                                <span style={{ color: m.hLeft <= 0 ? 'var(--red)' : m.hLeft <= 10 ? 'var(--amber)' : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                                  {m.hLeft <= 0 ? `${Math.abs(m.hLeft).toFixed(0)}h vencido` : `${m.hLeft.toFixed(0)}h restantes`}
                                </span>
                              )}
                              {m.dLeft !== null && (
                                <span style={{ color: m.dLeft <= 0 ? 'var(--red)' : m.dLeft <= 30 ? 'var(--amber)' : 'var(--text3)' }}>
                                  {m.dLeft <= 0 ? `${Math.abs(m.dLeft)} dias vencido` : `${m.dLeft} dias`}
                                </span>
                              )}
                              {m.nextDueDate && <span>{new Date(m.nextDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                            </div>
                            {m.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>{m.notes}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}44` }}>{sc.label}</span>
                            {m.estimatedCostBrl > 0 && (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
                                R$ {parseFloat(m.estimatedCostBrl).toLocaleString('pt-BR')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List view
        <div>
          {enriched.map(m => {
            const sc = STATUS_COLOR[m.status];
            return (
              <div key={m.id} style={{ background: 'var(--bg1)', border: `1px solid var(--border)`, borderLeft: `3px solid ${sc.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text1)', marginBottom: 3 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {m.ac && <span>{m.ac.registration}</span>}
                    {m.hLeft !== null && <span style={{ fontFamily: 'var(--font-mono)', color: m.hLeft <= 0 ? 'var(--red)' : m.hLeft <= 10 ? 'var(--amber)' : 'var(--text3)' }}>{m.hLeft.toFixed(0)}h {m.hLeft <= 0 ? 'vencido' : 'restantes'}</span>}
                    {m.dLeft !== null && <span style={{ color: m.dLeft <= 0 ? 'var(--red)' : m.dLeft <= 30 ? 'var(--amber)' : 'var(--text3)' }}>{m.dLeft <= 0 ? `${Math.abs(m.dLeft)} dias vencido` : `${m.dLeft} dias`}</span>}
                    {m.nextDueDate && <span>{new Date(m.nextDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.text }}>{sc.label}</span>
                  {m.estimatedCostBrl > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>R$ {parseFloat(m.estimatedCostBrl).toLocaleString('pt-BR')}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
