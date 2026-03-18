import React, { useState, useEffect, useRef } from 'react';
import { getFlights, getAircraft, getUser, getSettings, getCrewMembers } from '../store';
import { getAirportByIcao } from '../airportsData';

// ── Portaria 14096/SPO de 14/03/2024 ─────────────────────────
// Função a bordo: P1, P2, I1, I2, D (nova codificação alfanumérica)
// Campos obrigatórios: código ANAC, função a bordo, base contratual (remunerado)
// ─────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtHM(min) {
  if (!min) return '00:00';
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function totalMin(flights, field) {
  return flights.reduce((s, f) => s + (parseInt(f[field]) || 0), 0);
}

// Códigos de função a bordo conforme Portaria 14096
const FUNCOES_BORDO = {
  P1: 'Piloto em Comando (PIC)',
  P2: 'Piloto em Comando Adicional',
  SIC: 'Segundo em Comando (SIC)',
  I1: 'Piloto em Instrução',
  I2: 'Piloto em Instrução para Comando',
  D: 'Outro',
};

export default function Logbook({ onClose }) {
  const [flights, setFlights]     = useState([]);
  const [aircraft, setAircraft]   = useState([]);
  const [crew, setCrew]           = useState([]);
  const [pilotName, setPilotName] = useState('');
  const [anacCode, setAnacCode]   = useState('');
  const [funcaoBordo, setFuncao]  = useState('P1');
  const [format, setFormat]       = useState('caderneta');
  const [filterAc, setFilterAc]   = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [loading, setLoading]     = useState(true);
  const printRef = useRef();

  useEffect(() => {
    Promise.all([getFlights(), getAircraft(), getUser(), getSettings(), getCrewMembers()])
      .then(([fl, ac, u, s, cr]) => {
        setFlights((fl || []).sort((a, b) => a.date.localeCompare(b.date)));
        setAircraft(ac || []);
        setCrew(cr || []);
        // Carrega perfil do piloto
        const profile = s?.profile || {};
        if (profile.fullName) setPilotName(profile.fullName);
        else if (u?.email) setPilotName(u.email.split('@')[0].toUpperCase());
        if (profile.anacCode) setAnacCode(profile.anacCode);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const filtered = flights.filter(f => {
    if (filterAc && f.aircraftId !== filterAc) return false;
    if (dateFrom && f.date < dateFrom) return false;
    if (dateTo && f.date > dateTo) return false;
    return true;
  });

  function getAcInfo(id) {
    return aircraft.find(a => a.id === id);
  }

  function groupByMonth(fls) {
    const map = {};
    fls.forEach(f => {
      const key = f.date.slice(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }

  const totalFlights = filtered.length;
  const totalDay     = totalMin(filtered, 'flightTimeDay');
  const totalNight   = totalMin(filtered, 'flightTimeNight');
  const totalIfr     = totalMin(filtered, 'flightTimeIfr');
  const totalAll     = totalMin(filtered, 'flightTimeMinutes');
  const totalCycles  = filtered.reduce((s, f) => s + (parseInt(f.cycles) || 0), 0);
  const acSelected   = aircraft.find(a => a.id === filterAc);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Carregando logbook...</div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      {/* Controls */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="ghost" onClick={onClose}>← Voltar</button>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400 }}>Diário de Bordo ANAC</div>
          <div style={{ fontSize: 11, color: 'var(--blue)', padding: '3px 8px', background: 'var(--blue-dim)', borderRadius: 6, border: '1px solid var(--blue-mid)' }}>
            Portaria 14096/2024
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', marginBottom: 14 }}>
          <div className="section-title">Formato</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              ['caderneta', '📋 Diário de Bordo', 'Voos linha a linha — formato ANAC Portaria 2050/14096'],
              ['resumo',    '📊 Resumo por Período', 'Totais mensais e anuais — CIV simplificada'],
            ].map(([v, l, sub]) => (
              <div key={v} onClick={() => setFormat(v)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${format === v ? 'var(--blue-mid)' : 'var(--border)'}`, background: format === v ? 'var(--blue-dim)' : 'var(--bg2)', cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: format === v ? 'var(--blue)' : 'var(--text1)' }}>{l}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          <div className="section-title">Dados do Piloto (obrigatórios pela Portaria 14096)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label>Nome completo</label>
              <input value={pilotName} onChange={e => setPilotName(e.target.value)} placeholder="YANCOVITZ, Victor Borioli" />
            </div>
            <div>
              <label>Código ANAC (6 dígitos)</label>
              <input value={anacCode} onChange={e => setAnacCode(e.target.value)} placeholder="128972" maxLength={6} style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label>Função a bordo (Portaria 14096)</label>
              <select value={funcaoBordo} onChange={e => setFuncao(e.target.value)}>
                {Object.entries(FUNCOES_BORDO).map(([k, v]) => (
                  <option key={k} value={k}>{k} — {v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="section-title">Filtros</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label>Aeronave</label>
              <select value={filterAc} onChange={e => setFilterAc(e.target.value)}>
                <option value="">Todas</option>
                {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
              </select>
            </div>
            <div>
              <label>Data início</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label>Data fim</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="primary" onClick={() => window.print()} style={{ padding: '10px 24px' }}>
            🖨 Imprimir / Salvar PDF
          </button>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {totalFlights} voo(s) · {fmtHM(totalAll)} total · {totalCycles} pousos
          </div>
        </div>
      </div>

      {/* ── PRINT AREA ─────────────────────────────────────── */}
      <div ref={printRef} className="print-area">

        {/* Termo de abertura — exigido pela Portaria 2050 */}
        <div className="print-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>DIÁRIO DE BORDO — REPÚBLICA FEDERATIVA DO BRASIL</h1>
              <div style={{ fontSize: '8pt', color: '#555', marginTop: 2 }}>
                Conforme Portaria nº 2.050/SPO/SAR (29/06/2018) alterada pela Portaria nº 14.096/SPO (14/03/2024) e Resolução nº 457/2017
              </div>
            </div>
            <div style={{ fontSize: '8pt', textAlign: 'right', color: '#333' }}>
              <div><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
              <div><strong>Sistema:</strong> AeroManager</div>
            </div>
          </div>
          <div className="meta" style={{ marginTop: 8, borderTop: '1px solid #ccc', paddingTop: 6 }}>
            <span><strong>Piloto:</strong> {pilotName || '________________________'}</span>
            <span><strong>Cód. ANAC:</strong> {anacCode || '______'}</span>
            <span><strong>Função a bordo:</strong> {funcaoBordo} — {FUNCOES_BORDO[funcaoBordo]}</span>
            {acSelected && <span><strong>Aeronave:</strong> {acSelected.registration} / {acSelected.manufacturer} {acSelected.model}</span>}
            {dateFrom && <span><strong>De:</strong> {fmtDate(dateFrom)}</span>}
            {dateTo   && <span><strong>Até:</strong> {fmtDate(dateTo)}</span>}
          </div>
        </div>

        {/* ── CADERNETA ──────────────────────────────────────── */}
        {format === 'caderneta' && (
          <>
            {/*
              Colunas conforme Portaria 2050 art. 13 + Portaria 14096:
              Data | Matrícula | Modelo | Origem | Destino | Decolagem(UTC) | Pouso(UTC)
              | Diurno | Noturno | Instrumento | Total | IFR | Ciclos | Condição | Natureza
              | Tripulação (cód.ANAC + função P1/P2/I1/I2) | Ocorrências
            */}
            <table className="log-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Data</th>
                  <th rowSpan={2}>Matrícula</th>
                  <th rowSpan={2}>Modelo</th>
                  <th rowSpan={2}>Saída</th>
                  <th rowSpan={2}>Chegada</th>
                  <th rowSpan={2}>Decol. (UTC)</th>
                  <th rowSpan={2}>Pouso (UTC)</th>
                  <th colSpan={3}>Tempo de Voo</th>
                  <th rowSpan={2}>Total</th>
                  <th rowSpan={2}>IFR</th>
                  <th rowSpan={2}>Ciclos</th>
                  <th rowSpan={2}>Condição</th>
                  <th rowSpan={2}>Natureza</th>
                  <th rowSpan={2}>Tripulação<br/><span style={{ fontWeight: 400, fontSize: '6.5pt' }}>cód.ANAC + função (P14096)</span></th>
                  <th rowSpan={2}>Ocorrências</th>
                </tr>
                <tr>
                  <th>Diurno</th>
                  <th>Noturno</th>
                  <th>Instrumento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const ac  = getAcInfo(f.aircraftId);
                  const dep = getAirportByIcao(f.departureIcao);
                  const dst = getAirportByIcao(f.destinationIcao);
                  const NATURE = { leisure:'PV', business:'PV', training:'INST', transport:'PV', professional:'PRF' };
                  // Tripulação: se tiver crew registrado usa, senão mostra pilotname + função
                  const crewEntry = anacCode
                    ? `${anacCode}/${funcaoBordo}`
                    : `${pilotName}/${funcaoBordo}`;
                  return (
                    <tr key={f.id}>
                      <td>{fmtDate(f.date)}</td>
                      <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{ac?.registration || '—'}</td>
                      <td style={{ fontSize: '7pt' }}>{ac?.model || '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {f.departureIcao}
                        {dep ? <div style={{ fontSize: '6pt', color: '#666' }}>{dep.city}</div> : null}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {f.destinationIcao}
                        {dst ? <div style={{ fontSize: '6pt', color: '#666' }}>{dst.city}</div> : null}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{f.takeoffUtc || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{f.landingUtc || '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(f.flightTimeDay)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(f.flightTimeNight)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(f.flightTimeIfr)}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtHM(f.flightTimeMinutes)}</td>
                      <td>{f.flightConditions === 'ifr' ? 'S' : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{f.cycles || 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{(f.flightConditions || 'VFR').toUpperCase()}</td>
                      <td style={{ fontSize: '7pt' }}>{NATURE[f.purpose] || 'PV'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '7pt', whiteSpace: 'nowrap' }}>{crewEntry}</td>
                      <td style={{ textAlign: 'left', fontSize: '7pt' }}>{f.logbookNotes || ''}</td>
                    </tr>
                  );
                })}
                {/* Totais parciais por página e total geral */}
                <tr className="total-row">
                  <td colSpan={7} style={{ textAlign: 'left', paddingLeft: 8 }}>
                    TOTAL — {totalFlights} voo(s)
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalDay)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalNight)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalIfr)}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtHM(totalAll)}</td>
                  <td>—</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalCycles}</td>
                  <td colSpan={4}></td>
                </tr>
              </tbody>
            </table>

            {/* Legenda de funções (Portaria 14096) */}
            <div style={{ marginTop: 8, fontSize: '7pt', color: '#555', borderTop: '1px solid #ccc', paddingTop: 4 }}>
              <strong>Funções a bordo (Portaria 14.096/SPO, 14/03/2024):</strong>{' '}
              P1=Piloto em Comando · P2=PIC Adicional (tripulação composta/revezamento) ·
              SIC=Segundo em Comando · I1=Piloto em Instrução · I2=Piloto em Instrução para Comando · D=Outro
              {' '}| <strong>Natureza:</strong> PV=Privado · PRF=Profissional · INST=Instrução
            </div>

            {/* Bloco de assinatura — exigido pela Portaria 2050 art. 44 */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
              <div style={{ textAlign: 'center', width: 220 }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>
                  Assinatura e Rubrica do Piloto
                </div>
                <div style={{ marginTop: 3, fontSize: '8pt' }}>{pilotName || '____________________'}</div>
                <div style={{ marginTop: 2, fontSize: '7pt', color: '#555' }}>
                  ANAC nº {anacCode || '______'} · {funcaoBordo}
                </div>
              </div>
              <div style={{ textAlign: 'center', width: 220 }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>
                  Instrutor / Certificador (se aplicável)
                </div>
                <div style={{ marginTop: 3, fontSize: '8pt' }}>____________________</div>
                <div style={{ marginTop: 2, fontSize: '7pt', color: '#555' }}>ANAC nº ______</div>
              </div>
              <div style={{ textAlign: 'center', width: 200 }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>
                  Data e Local
                </div>
                <div style={{ marginTop: 3, fontSize: '8pt' }}>{new Date().toLocaleDateString('pt-BR')}</div>
              </div>
            </div>

            <div className="anac-seal">
              Documento gerado pelo AeroManager · Portaria 2.050/SPO/SAR (29/06/2018) · Portaria 14.096/SPO (14/03/2024) · Resolução ANAC nº 457/2017
            </div>
          </>
        )}

        {/* ── RESUMO POR PERÍODO ─────────────────────────────── */}
        {format === 'resumo' && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 12, fontSize: '9pt' }}>
              {[
                ['Total de Voos', totalFlights],
                ['Horas Totais', fmtHM(totalAll)],
                ['Diurno', fmtHM(totalDay)],
                ['Noturno', fmtHM(totalNight)],
                ['Instrumento (IFR)', fmtHM(totalIfr)],
                ['Pousos (Ciclos)', totalCycles],
                ['Horas VFR', fmtHM(totalAll - totalIfr)],
                ['Média/Voo', fmtHM(Math.round(totalAll / (totalFlights || 1)))],
                ['Aeronaves', new Set(filtered.map(f => f.aircraftId)).size],
                ['Aeródromos', new Set([...filtered.map(f => f.departureIcao), ...filtered.map(f => f.destinationIcao)]).size],
              ].map(([label, val]) => (
                <div key={label} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7.5pt', color: '#555' }}>{label}</div>
                  <div style={{ fontSize: '11pt', fontWeight: 'bold', marginTop: 2, fontFamily: 'monospace' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Tabela mensal */}
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Mês / Ano</th>
                  <th>Voos</th>
                  <th>Total</th>
                  <th>Diurno</th>
                  <th>Noturno</th>
                  <th>IFR (Inst.)</th>
                  <th>VFR</th>
                  <th>Ciclos</th>
                  <th>Aeronaves</th>
                  <th>Rotas (primeiras)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const months = groupByMonth(filtered);
                  let currentYear = null;
                  const rows = [];
                  const yearTotals = {};

                  months.forEach(([month, fls]) => {
                    const year = month.slice(0, 4);
                    if (!yearTotals[year]) yearTotals[year] = { flights: 0, total: 0, day: 0, night: 0, ifr: 0, cycles: 0 };
                    yearTotals[year].flights += fls.length;
                    yearTotals[year].total   += totalMin(fls, 'flightTimeMinutes');
                    yearTotals[year].day     += totalMin(fls, 'flightTimeDay');
                    yearTotals[year].night   += totalMin(fls, 'flightTimeNight');
                    yearTotals[year].ifr     += totalMin(fls, 'flightTimeIfr');
                    yearTotals[year].cycles  += fls.reduce((s, f) => s + (parseInt(f.cycles) || 0), 0);

                    if (year !== currentYear) {
                      currentYear = year;
                      rows.push(<tr key={`year-${year}`} className="year-header"><td colSpan={10}>◆ {year}</td></tr>);
                    }

                    const [y, m] = month.split('-');
                    const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
                    const acs = [...new Set(fls.map(f => aircraft.find(a => a.id === f.aircraftId)?.registration).filter(Boolean))].join(', ');
                    const routes = [...new Set(fls.map(f => `${f.departureIcao}→${f.destinationIcao}`))].slice(0, 3).join(', ');
                    const mTotal = totalMin(fls, 'flightTimeMinutes');
                    const mIfr   = totalMin(fls, 'flightTimeIfr');

                    rows.push(
                      <tr key={month}>
                        <td style={{ textAlign: 'left', textTransform: 'capitalize' }}>{monthName}/{y}</td>
                        <td>{fls.length}</td>
                        <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtHM(mTotal)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalMin(fls, 'flightTimeDay'))}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalMin(fls, 'flightTimeNight'))}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(mIfr)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(mTotal - mIfr)}</td>
                        <td>{fls.reduce((s, f) => s + (parseInt(f.cycles) || 0), 0)}</td>
                        <td style={{ fontSize: '7pt' }}>{acs}</td>
                        <td style={{ fontSize: '7pt', textAlign: 'left' }}>{routes}{fls.length > 3 ? '...' : ''}</td>
                      </tr>
                    );
                  });

                  Object.entries(yearTotals).forEach(([year, t]) => {
                    rows.push(
                      <tr key={`total-${year}`} className="total-row">
                        <td style={{ textAlign: 'left' }}>Total {year}</td>
                        <td>{t.flights}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(t.total)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(t.day)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(t.night)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(t.ifr)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmtHM(t.total - t.ifr)}</td>
                        <td>{t.cycles}</td>
                        <td colSpan={2}></td>
                      </tr>
                    );
                  });

                  rows.push(
                    <tr key="grand-total" className="total-row" style={{ borderTop: '3px solid #000' }}>
                      <td style={{ textAlign: 'left' }}>TOTAL GERAL</td>
                      <td>{totalFlights}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '10pt' }}>{fmtHM(totalAll)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalDay)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalNight)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalIfr)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtHM(totalAll - totalIfr)}</td>
                      <td>{totalCycles}</td>
                      <td colSpan={2}></td>
                    </tr>
                  );

                  return rows;
                })()}
              </tbody>
            </table>

            {/* Assinatura */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
              <div style={{ textAlign: 'center', width: 220 }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>Piloto</div>
                <div style={{ marginTop: 3, fontSize: '8pt' }}>{pilotName || '____________________'}</div>
                <div style={{ marginTop: 2, fontSize: '7pt', color: '#555' }}>ANAC nº {anacCode || '______'} · {funcaoBordo}</div>
              </div>
              <div style={{ textAlign: 'center', width: 200 }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>Data e Local</div>
                <div style={{ marginTop: 3, fontSize: '8pt' }}>{new Date().toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <div className="anac-seal">
              Relatório de Horas de Voo — AeroManager · Portaria 14.096/SPO (14/03/2024) · Resolução ANAC nº 457/2017
            </div>
          </>
        )}
      </div>
    </div>
  );
}
