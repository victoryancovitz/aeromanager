import React, { useState, useEffect, useRef } from 'react';
import { getFlights, getAircraft, getUser, getSettings } from '../store';
import { getAirportByIcao } from '../airportsData';

// ── CIV Digital — IS 61-001 Revisão G (27/03/2023) ───────────
// Campos conforme SACI / CIV Digital ANAC:
// Data | Matrícula | Tipo | Origem | Destino | Decol | Pouso
// | PIC | Capota | Solo | Noturno | IFR Inst | IFR Capota
// | Navegação | Milhas Nav | Simulador | Função | CANAC Instrutor | Observações
// ─────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtHM(min) {
  if (!min || min === 0) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function totalMin(flights, field) {
  return flights.reduce((s, f) => s + (parseInt(f[field]) || 0), 0);
}

// Funções CIV conforme IS 61-001G + Portaria 14096
const FUNCOES_CIV = {
  'PIC':   { label: 'Piloto em Comando (P1)', desc: 'Responsável pelo voo' },
  'SIC':   { label: 'Segundo em Comando (SIC)', desc: 'Copiloto obrigatório' },
  'PI':    { label: 'Piloto em Instrução (I1)', desc: 'Aluno — horas = PIC quando solo' },
  'IV':    { label: 'Instrutor de Voo (V1)', desc: 'Contadas como PIC (RBAC 61.31)' },
  'IVS':   { label: 'Instrutor de Voo em Solo', desc: 'Não conta como exp. de voo' },
  'P2':    { label: 'Piloto em Comando Adicional (P2)', desc: 'Tripulação composta/revezamento' },
  'I2':    { label: 'Piloto em Instrução para Comando (I2)', desc: '' },
};

// Tipo de aeronave para CIV
const AC_CLASS = {
  single_engine: 'MONO',
  multi_engine:  'MULTI',
  turboprop:     'TP',
  jet:           'JET',
  helicopter:    'HELI',
  experimental:  'EXP',
};

export default function CIV({ onClose }) {
  const [flights, setFlights]     = useState([]);
  const [aircraft, setAircraft]   = useState([]);
  const [pilotName, setPilotName] = useState('');
  const [anacCode, setAnacCode]   = useState('');
  const [funcao, setFuncao]       = useState('PIC');
  const [filterAc, setFilterAc]   = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [showTotals, setShowTotals] = useState(true);
  const [loading, setLoading]     = useState(true);
  const printRef = useRef();

  useEffect(() => {
    Promise.all([getFlights(), getAircraft(), getUser(), getSettings()])
      .then(([fl, ac, u, s]) => {
        setFlights((fl || []).sort((a, b) => a.date.localeCompare(b.date)));
        setAircraft(ac || []);
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

  function getAcInfo(id) { return aircraft.find(a => a.id === id); }

  // Horas na função selecionada
  // PIC = flightTimeMinutes | Instrutor = flightTimeMinutes | PI = flightTimeMinutes
  // Noturno = flightTimeNight | IFR Inst = flightTimeIfr | Capota = quando IFR sob capota
  const totalAll   = totalMin(filtered, 'flightTimeMinutes');
  const totalNight = totalMin(filtered, 'flightTimeNight');
  const totalIfr   = totalMin(filtered, 'flightTimeIfr');
  const totalNm    = filtered.reduce((s, f) => s + parseFloat(f.distanceNm || 0), 0);
  const totalCycles = filtered.reduce((s, f) => s + (parseInt(f.cycles) || 1), 0);

  // CIV totals por tipo de aeronave
  const totalByClass = {};
  filtered.forEach(f => {
    const ac = getAcInfo(f.aircraftId);
    const cls = AC_CLASS[ac?.type || 'single_engine'] || 'MONO';
    if (!totalByClass[cls]) totalByClass[cls] = 0;
    totalByClass[cls] += f.flightTimeMinutes || 0;
  });

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Carregando CIV...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Controls */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="ghost" onClick={onClose}>← Voltar</button>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400 }}>CIV — Caderneta Individual de Voo</div>
          <div style={{ fontSize: 11, color: 'var(--blue)', padding: '3px 8px', background: 'var(--blue-dim)', borderRadius: 6, border: '1px solid var(--blue-mid)' }}>
            IS 61-001 Rev. G
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', marginBottom: 14 }}>
          <div className="section-title">Dados do Piloto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label>Nome completo</label>
              <input value={pilotName} onChange={e => setPilotName(e.target.value)} placeholder="YANCOVITZ, Victor Borioli" />
            </div>
            <div>
              <label>CANAC (código ANAC — 6 dígitos)</label>
              <input value={anacCode} onChange={e => setAnacCode(e.target.value)} placeholder="128972" maxLength={6} style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label>Função a bordo predominante</label>
              <select value={funcao} onChange={e => setFuncao(e.target.value)}>
                {Object.entries(FUNCOES_CIV).map(([k, v]) => (
                  <option key={k} value={k}>{k} — {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="section-title">Filtros</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showTotals} onChange={e => setShowTotals(e.target.checked)} />
                Mostrar totalizadores
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="primary" onClick={() => window.print()} style={{ padding: '10px 24px' }}>
            🖨 Imprimir / Salvar PDF
          </button>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {filtered.length} voo(s) · {fmtHM(totalAll) || '00:00'} total · {fmtHM(totalNight) || '00:00'} noturno · {fmtHM(totalIfr) || '00:00'} IFR
          </div>
        </div>
      </div>

      {/* ── PRINT AREA ─────────────────────────────────────── */}
      <div ref={printRef} className="print-area">

        {/* Cabeçalho CIV */}
        <div className="print-header">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h1>CADERNETA INDIVIDUAL DE VOO — CIV</h1>
              <div style={{ fontSize: '7.5pt', color: '#555', marginTop: 2 }}>
                IS nº 61-001 Revisão G (Portaria 10.816/SPL, 22/03/2023) · RBAC 61 · IAC 3203
              </div>
            </div>
            <div style={{ fontSize: '8pt', textAlign: 'right', color: '#333' }}>
              <div><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
              <div><strong>Sistema:</strong> AeroManager</div>
            </div>
          </div>
          <div className="meta" style={{ marginTop: 8, borderTop: '1px solid #ccc', paddingTop: 6 }}>
            <span><strong>Piloto:</strong> {pilotName || '________________________________'}</span>
            <span><strong>CANAC:</strong> {anacCode || '______'}</span>
            <span><strong>Função predominante:</strong> {funcao} — {FUNCOES_CIV[funcao]?.label}</span>
            {filterAc && aircraft.find(a => a.id === filterAc) && (
              <span><strong>Aeronave:</strong> {aircraft.find(a => a.id === filterAc)?.registration}</span>
            )}
            {dateFrom && <span><strong>De:</strong> {fmtDate(dateFrom)}</span>}
            {dateTo   && <span><strong>Até:</strong> {fmtDate(dateTo)}</span>}
          </div>
        </div>

        {/*
          Colunas CIV conforme SACI / IS 61-001G:
          Data | Matrícula | Classe/Tipo | Origem→Destino
          | Decol(UTC) | Pouso(UTC)
          | Total | PIC | Noturno | Inst(IFR) | Capota | Solo
          | Navegação | Milhas Nav
          | Função | Simulador | CANAC Instr. | Observações
        */}
        <table className="log-table" style={{ fontSize: '7pt' }}>
          <thead>
            <tr>
              <th rowSpan={2}>Data</th>
              <th rowSpan={2}>Matrícula</th>
              <th rowSpan={2}>Classe</th>
              <th rowSpan={2}>Saída / Chegada</th>
              <th rowSpan={2}>Decol.<br/>UTC</th>
              <th rowSpan={2}>Pouso<br/>UTC</th>
              <th colSpan={6} style={{ borderBottom: '1px solid #ccc' }}>Horas de Voo (hh:mm)</th>
              <th colSpan={2} style={{ borderBottom: '1px solid #ccc' }}>Navegação</th>
              <th rowSpan={2}>Função<br/><span style={{ fontWeight:400, fontSize:'6pt' }}>P14096</span></th>
              <th rowSpan={2}>Sim<br/>?</th>
              <th rowSpan={2}>CANAC<br/>Instr.</th>
              <th rowSpan={2}>Observações / Endossos</th>
            </tr>
            <tr>
              <th title="Tempo total de voo (calço a calço)">Total*</th>
              <th title="Horas como Piloto em Comando">PIC</th>
              <th title="Horas noturnas">Noturno</th>
              <th title="Horas em voo IFR — instrumento">IFR Inst.</th>
              <th title="Horas com capota — voo em IMC real">IFR Capota</th>
              <th title="Horas de voo solo">Solo</th>
              <th title="Tempo de navegação (decolagem ao pouso)">Tempo Nav.</th>
              <th title="Distância navegada em milhas náuticas">NM</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const ac  = getAcInfo(f.aircraftId);
              const dep = getAirportByIcao(f.departureIcao);
              const dst = getAirportByIcao(f.destinationIcao);
              const cls = AC_CLASS[ac?.type || 'single_engine'] || 'MONO';
              const isPIC = ['PIC','IV','IVS'].includes(funcao);
              const isSolo = funcao === 'PI'; // solo = aluno como único ocupante
              return (
                <tr key={f.id}>
                  <td>{fmtDate(f.date)}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{ac?.registration || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{cls}</td>
                  <td>
                    <div style={{ fontFamily: 'monospace' }}>{f.departureIcao} → {f.destinationIcao}</div>
                    {(dep || dst) && (
                      <div style={{ fontSize: '6pt', color: '#777' }}>
                        {dep?.city || ''}{dep && dst ? ' → ' : ''}{dst?.city || ''}
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{f.takeoffUtc || '—'}</td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{f.landingUtc || '—'}</td>
                  {/* Total (calço a calço) */}
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center' }}>{fmtHM(f.flightTimeMinutes)}</td>
                  {/* PIC */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center', color: isPIC ? '#000' : '#999' }}>
                    {isPIC ? fmtHM(f.flightTimeMinutes) : ''}
                  </td>
                  {/* Noturno */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(f.flightTimeNight)}</td>
                  {/* IFR Instrumento */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(f.flightTimeIfr)}</td>
                  {/* IFR Capota (IMC real — usuário pode registrar em notes por ora) */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center', color: '#bbb' }}>—</td>
                  {/* Solo */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center', color: isSolo ? '#000' : '#999' }}>
                    {isSolo ? fmtHM(f.flightTimeMinutes) : ''}
                  </td>
                  {/* Navegação (decolagem ao pouso = flightTimeMinutes neste contexto) */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(f.flightTimeMinutes)}</td>
                  {/* Milhas Nav */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                    {f.distanceNm ? Math.round(parseFloat(f.distanceNm)) : ''}
                  </td>
                  {/* Função */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center', fontWeight: 'bold' }}>{funcao}</td>
                  {/* Simulador */}
                  <td style={{ textAlign: 'center' }}>N</td>
                  {/* CANAC Instrutor */}
                  <td style={{ fontFamily: 'monospace', textAlign: 'center', color: '#aaa' }}>—</td>
                  {/* Observações */}
                  <td style={{ textAlign: 'left', fontSize: '6.5pt' }}>{f.logbookNotes || ''}</td>
                </tr>
              );
            })}

            {/* Totais */}
            {showTotals && (
              <tr className="total-row">
                <td colSpan={6} style={{ textAlign: 'left', paddingLeft: 8 }}>
                  TOTAL — {filtered.length} voo(s)
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center' }}>{fmtHM(totalAll)}</td>
                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                  {['PIC','IV','IVS'].includes(funcao) ? fmtHM(totalAll) : ''}
                </td>
                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(totalNight)}</td>
                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(totalIfr)}</td>
                <td style={{ textAlign: 'center' }}>—</td>
                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                  {funcao === 'PI' ? fmtHM(totalAll) : ''}
                </td>
                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(totalAll)}</td>
                <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{Math.round(totalNm)}</td>
                <td colSpan={4}></td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Nota de rodapé legal — exigida IS 61-001 */}
        <div style={{ marginTop: 8, fontSize: '6.5pt', color: '#555', borderTop: '1px solid #ccc', paddingTop: 4 }}>
          <strong>* Tempo total:</strong> calço a calço, conforme RBAC 91. Horas de Navegação (Nav.): decolagem ao pouso.{' '}
          <strong>IFR Capota:</strong> voo em IMC real sob capota — registrar manualmente em Observações quando aplicável.{' '}
          <strong>Funções:</strong> PIC=Piloto em Comando · SIC=2º em Comando · IV=Instrutor de Voo (contado como PIC, RBAC 61.31) · PI=Piloto em Instrução · P2=PIC Adicional · I2=Instrução para Comando · IS 61-001G / Portaria 14.096/SPO (14/03/2024).
        </div>

        {/* Totalizadores por classe */}
        {showTotals && Object.keys(totalByClass).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: 6 }}>Totalizadores por Classe de Aeronave (IS 61-001G sec. 5.2.3)</div>
            <table className="summary-table" style={{ fontSize: '8pt' }}>
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Horas Totais</th>
                  <th>% do Total</th>
                  <th>Voos</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(totalByClass).map(([cls, mins]) => (
                  <tr key={cls}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{cls}</td>
                    <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>{fmtHM(mins)}</td>
                    <td style={{ textAlign: 'center' }}>{totalAll > 0 ? Math.round(mins / totalAll * 100) : 0}%</td>
                    <td style={{ textAlign: 'center' }}>
                      {filtered.filter(f => AC_CLASS[getAcInfo(f.aircraftId)?.type || 'single_engine'] === cls).length}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>TOTAL GERAL</td>
                  <td style={{ fontFamily: 'monospace', textAlign: 'center', fontWeight: 'bold' }}>{fmtHM(totalAll)}</td>
                  <td style={{ textAlign: 'center' }}>100%</td>
                  <td style={{ textAlign: 'center' }}>{filtered.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Resumo executivo para processos ANAC */}
        {showTotals && (
          <div style={{ marginTop: 12, border: '1px solid #ccc', padding: '8px 12px' }}>
            <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: 6 }}>
              Resumo de Experiência — Para fins de Concessão/Revalidação de Licença (RBAC 61)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: '8pt' }}>
              {[
                { label: 'Total de horas de voo', value: fmtHM(totalAll) },
                { label: `Horas como ${FUNCOES_CIV[funcao]?.label?.split(' ')[0] || funcao}`, value: fmtHM(totalAll) },
                { label: 'Horas noturnas', value: fmtHM(totalNight) },
                { label: 'Horas IFR (instrumento)', value: fmtHM(totalIfr) },
                { label: 'Horas de navegação', value: fmtHM(totalAll) },
                { label: 'Distância total (NM)', value: Math.round(totalNm).toLocaleString('pt-BR') },
                { label: 'Pousos (ciclos)', value: totalCycles },
                { label: 'Total de voos', value: filtered.length },
              ].map(item => (
                <div key={item.label} style={{ border: '1px solid #eee', padding: '4px 8px' }}>
                  <div style={{ color: '#666', fontSize: '7pt' }}>{item.label}</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '10pt' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assinatura */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
          <div style={{ textAlign: 'center', width: 220 }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>Assinatura e Rubrica do Piloto</div>
            <div style={{ marginTop: 3, fontSize: '8pt' }}>{pilotName || '____________________'}</div>
            <div style={{ marginTop: 2, fontSize: '7pt', color: '#555' }}>CANAC nº {anacCode || '______'} · {funcao}</div>
          </div>
          <div style={{ textAlign: 'center', width: 220 }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>Instrutor / Endossante (se aplicável)</div>
            <div style={{ marginTop: 3, fontSize: '8pt' }}>____________________</div>
            <div style={{ marginTop: 2, fontSize: '7pt', color: '#555' }}>CANAC nº ______</div>
          </div>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 48 }}>Data e Local</div>
            <div style={{ marginTop: 3, fontSize: '8pt' }}>{new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div className="anac-seal">
          CIV — IS nº 61-001 Revisão G (Portaria 10.816/SPL, 22/03/2023) · RBAC nº 61 · IAC 3203 · AeroManager
        </div>
      </div>
    </div>
  );
}
