import React, { useState, useEffect, useRef } from 'react';
import { tracker, getTrackerState, exportGPX } from '../tracker';
import { getAircraft, saveCost, getFlights } from '../store';

const STATUS_CONFIG = {
  idle:            { label: 'Pronto para voar',   color: '#5a6080', bg: '#1e2230',  dot: '#5a6080' },
  waiting_takeoff: { label: 'Aguardando decolagem', color: '#f5a623', bg: '#3d2800', dot: '#f5a623' },
  airborne:        { label: 'EM VOO',              color: '#3dd68c', bg: '#0d3320',  dot: '#3dd68c' },
  landed:          { label: 'Pousou — confirmar',  color: '#4a9eff', bg: '#1e3a5f',  dot: '#4a9eff' },
};

function formatDuration(minutes) {
  if (!minutes || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m.toString().padStart(2,'0')}min`;
}

function timeDiffMin(from, to) {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
}

export default function FlightTrackerPage({ reload, setPage }) {
  const [aircraft, setAircraft] = useState([]);
  useEffect(() => {
    getAircraft().then(data => {
      setAircraft(data || []);
      if (data?.length) setSelectedAc(prev => prev || data[0].id);
    });

  // Buscar hobbs_end do ultimo voo ao trocar de aeronave
  useEffect(() => {
    if (!selectedAc) return;
    getFlights().then(flights => {
      const mine = flights.filter(f => f.aircraftId === selectedAc && f.hobbsEnd)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      if (mine.length > 0) setHobbsStart(String(mine[0].hobbsEnd));
    }).catch(() => {});
  }, [selectedAc]);
  }, []);
  const [state, setState] = useState(getTrackerState);
  const [selectedAc, setSelectedAc] = useState(aircraft[0]?.id || '');
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmForm, setConfirmForm] = useState({});
  const [fuel, setFuel] = useState({ liters: '', pricePerLiter: '', vendor: '' });
  const [saving, setSaving] = useState(false);
  const [hobbsStart, setHobbsStart] = useState('');
  const [hobbsEnd,   setHobbsEnd  ] = useState('');
  const [saved, setSaved] = useState(null);
  const unsubRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    unsubRef.current = tracker.subscribe(newState => {
      setState(newState);
      if (newState.status === 'landed') setShowConfirm(true);
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (state.status === 'airborne' && state.takeoffTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - new Date(state.takeoffTime)) / 60000));
      }, 10000);
    } else {
      clearInterval(timerRef.current);
      if (state.status !== 'airborne') setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [state.status, state.takeoffTime]);

  useEffect(() => {
    if (state.status === 'landed') {
      const mins = timeDiffMin(state.takeoffTime, state.landingTime);
      setConfirmForm({
        departureIcao:   state.departureIcao  || '',
        destinationIcao: (state.destinationIcao && state.destinationIcao.length===4) ? state.destinationIcao : '',
        flightTimeMinutes: mins,
        distanceNm:      state.distanceNm || 0,
        cruiseAltitudeFt: state.cruiseAltitudeFt || 0,
        flightConditions: 'vfr',
        purpose:         'leisure',
        logbookNotes:    '',
      });
    }
  }, [state.status]);

  async function startTracking() {
    if (!selectedAc) return;
    try {
      await tracker.start(selectedAc);
    } catch (e) {
      alert(`Erro ao iniciar GPS: ${e.message}\n\nVerifique se o app tem permissão de localização nas configurações do iPhone.`);
    }
  }

  async function confirmAndSave() {
    setSaving(true);
    try {
      const saved = await tracker.confirmFlight({ ...confirmForm, hobbsStart: hobbsStart ? parseFloat(hobbsStart) : null, hobbsEnd: hobbsEnd ? parseFloat(hobbsEnd) : null });
      // Auto-create fuel cost if filled
      if (fuel.liters && fuel.pricePerLiter) {
        await saveCost({
          aircraftId:    state.aircraftId,
          flightId:      saved.id,
          category:      'fuel',
          costType:      'variable',
          amountBrl:     parseFloat(fuel.liters) * parseFloat(fuel.pricePerLiter),
          description:   `AVGAS — ${fuel.liters}L @ R$${fuel.pricePerLiter}`,
          referenceDate: saved.date,
          vendor:        fuel.vendor || '',
        });
      }
      reload();
      setSaved(saved);
      setShowConfirm(false);
      setState({ status: 'idle' });
    } catch(e) {
      alert('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  }

  function discard() {
    if (window.confirm('Descartar o voo rastreado? Os dados de GPS serão perdidos.')) {
      tracker.discard();
      setShowConfirm(false);
      setSaved(null);
    }
  }

  function downloadGPX() {
    const gpx = exportGPX();
    if (!gpx) return;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `voo_${new Date().toISOString().slice(0,10)}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sc = STATUS_CONFIG[state.status] || STATUS_CONFIG.idle;
  const ac = aircraft.find(a => a.id === (state.aircraftId || selectedAc));

  // ── SAVED CONFIRMATION ────────────────────────────────────────
  if (saved) return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✈</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#3dd68c', marginBottom: 8 }}>Voo salvo!</div>
      <div style={{ fontSize: 14, color: '#9aa0b8', marginBottom: 24 }}>
        {saved.departureIcao} → {saved.destinationIcao} · {formatDuration(saved.flightTimeMinutes)}
      </div>
      <div style={{ background: '#0d3320', border: '1px solid #3dd68c44', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
        {[
          ['Diário de bordo', '✓ Criado'],
          ['Horímetro', '✓ Atualizado'],
          ['Ciclos', '✓ +1 pouso'],
          ['Manutenção', '✓ Horas deduzidas'],
          ['Custo combustível', fuel.liters ? '✓ Lançado automaticamente' : '— não preenchido'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e2230', fontSize: 13 }}>
            <span style={{ color: '#9aa0b8' }}>{k}</span>
            <span style={{ color: '#3dd68c', fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="primary" onClick={() => { setSaved(null); setPage('flights'); }}>Ver voos →</button>
        <button onClick={() => setSaved(null)}>Novo voo</button>
        <button onClick={downloadGPX}>⬇ GPX</button>
      </div>
    </div>
  );

  // ── CONFIRM FLIGHT OVERLAY ────────────────────────────────────
  if (showConfirm) return (
    <div style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🛬</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Pouso detectado!</div>
        <div style={{ fontSize: 13, color: '#9aa0b8', marginTop: 4 }}>Confirme os dados do voo antes de salvar</div>
      </div>

      <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div className="section-title">Dados do voo</div>
        <div className="g3" style={{ marginBottom: 12 }}>
          <div><label>Origem (ICAO)</label>
            <input value={confirmForm.departureIcao || ''} onChange={e => setConfirmForm(f => ({...f, departureIcao: e.target.value.toUpperCase()}))} placeholder="SBBR" maxLength={4} />
          </div>
          <div><label>Destino (ICAO)</label>
            <input value={confirmForm.destinationIcao || ''} onChange={e => setConfirmForm(f => ({...f, destinationIcao: e.target.value.toUpperCase()}))} placeholder="SBGR" maxLength={4} />
          </div>
          <div><label>Duração (min)</label>
            <input type="number" value={confirmForm.flightTimeMinutes || ''} onChange={e => setConfirmForm(f => ({...f, flightTimeMinutes: parseInt(e.target.value)||0}))} />
          </div>
        </div>
        <div className="g3" style={{ marginBottom: 12 }}>
          <div><label>Distância (nm)</label>
            <input type="number" step="0.1" value={confirmForm.distanceNm || ''} onChange={e => setConfirmForm(f => ({...f, distanceNm: parseFloat(e.target.value)||0}))} />
          </div>
          <div><label>Alt. cruzeiro (ft)</label>
            <input type="number" value={confirmForm.cruiseAltitudeFt || ''} onChange={e => setConfirmForm(f => ({...f, cruiseAltitudeFt: parseInt(e.target.value)||0}))} />
          </div>
          <div><label>Condição</label>
            <select value={confirmForm.flightConditions} onChange={e => setConfirmForm(f => ({...f, flightConditions: e.target.value}))}>
              <option value="vfr">VFR</option>
              <option value="ifr">IFR</option>
              <option value="mixed">Misto</option>
            </select>
          </div>
        </div>
        <div><label>Finalidade</label>
          <select value={confirmForm.purpose} onChange={e => setConfirmForm(f => ({...f, purpose: e.target.value}))}>
            <option value="leisure">Lazer</option>
            <option value="training">Instrução</option>
            <option value="transport">Transporte</option>
            <option value="professional">Profissional</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div className="section-title">Combustível (opcional)</div>
        <div className="g3">
          <div><label>Litros abastecidos</label>
            <input type="number" step="0.1" value={fuel.liters} onChange={e => setFuel(f=>({...f,liters:e.target.value}))} placeholder="80" />
          </div>
          <div><label>R$/litro</label>
            <input type="number" step="0.01" value={fuel.pricePerLiter} onChange={e => setFuel(f=>({...f,pricePerLiter:e.target.value}))} placeholder="8.50" />
          </div>
          <div><label>Fornecedor</label>
            <input value={fuel.vendor} onChange={e => setFuel(f=>({...f,vendor:e.target.value}))} placeholder="Posto" />
          </div>
        </div>
        {fuel.liters && fuel.pricePerLiter && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#0d3320', borderRadius: 8, fontSize: 12, color: '#3dd68c' }}>
            Custo combustível: <strong>R$ {(parseFloat(fuel.liters) * parseFloat(fuel.pricePerLiter)).toFixed(2).replace('.',',')}</strong> — será lançado automaticamente
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
        <div className="section-title">Fases do voo (GPS)</div>
        {state.phases?.filter(p => p.startTime && p.endTime).map((p, i) => {
          const mins = timeDiffMin(p.startTime, p.endTime);
          const labels = { climb: 'Subida', cruise: 'Cruzeiro', descent: 'Descida' };
          const colors = { climb: '#f5a623', cruise: '#4a9eff', descent: '#9b6dff' };
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #1e2230', fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[p.phase], flexShrink: 0 }} />
              <div style={{ flex: 1, color: '#9aa0b8' }}>{labels[p.phase]}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: colors[p.phase] }}>{formatDuration(mins)}</div>
              <div style={{ color: '#5a6080', fontSize: 11 }}>{Math.round(p.startAltFt||0)}→{Math.round(p.endAltFt||0)}ft</div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: '#9aa0b8' }}>Pontos GPS registrados</span>
          <span style={{ color: '#4a9eff', fontFamily: "'JetBrains Mono',monospace" }}>{state.gpsTrackPoints || getTrackerState().gpsTrackPoints || '—'}</span>
        </div>
      </div>

  <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
    <div className="section-title">Horimetro Hobbs &mdash; opcional</div>
    <div className="g3">
      <div><label>Leitura inicial</label>
        <input type="number" step="0.1" value={hobbsStart} onChange={e => setHobbsStart(e.target.value)} placeholder="847.5" />
      </div>
      <div><label>Leitura final</label>
        <input type="number" step="0.1" value={hobbsEnd} onChange={e => setHobbsEnd(e.target.value)} placeholder="849.2" />
      </div>
      <div><label>Delta Hobbs</label>
        <div style={{ padding: '9px 12px', background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: hobbsStart && hobbsEnd && parseFloat(hobbsEnd) > parseFloat(hobbsStart) ? '#4a9eff' : '#5a6080' }}>
          {hobbsStart && hobbsEnd && parseFloat(hobbsEnd) > parseFloat(hobbsStart) ? '+' + (parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1) + ' h' : '-- h'}
        </div>
      </div>
    </div>
    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#5a6080' }}>Hobbs inclui taxi e aquecimento. Diferente das horas de voo. Essencial para TBO real.</p>
  </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="primary" style={{ flex: 2 }} onClick={confirmAndSave} disabled={saving}>
          {saving ? 'Salvando...' : '✓ Confirmar e salvar voo'}
        </button>
        <button style={{ flex: 1 }} onClick={discard}>Descartar</button>
      </div>
    </div>
  );

  // ── MAIN TRACKER SCREEN ───────────────────────────────────────
  return (
    <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>

      {/* Status banner */}
      <div style={{ background: sc.bg, border: `1px solid ${sc.color}44`, borderRadius: 14, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc.dot, boxShadow: `0 0 8px ${sc.dot}`, animation: state.status==='airborne'?'pulse 2s infinite':'' }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: sc.color }}>{sc.label}</div>
        </div>

        {state.status === 'airborne' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16 }}>
            {[
              { label: 'Tempo de voo', value: formatDuration(elapsed), color: '#3dd68c' },
              { label: 'Velocidade', value: `${state.currentSpeedKt || 0} kt`, color: '#4a9eff' },
              { label: 'Altitude', value: `${(state.currentAltFt || 0).toLocaleString('pt-BR')} ft`, color: '#f5a623' },
              { label: 'Distância', value: `${(state.distanceNm || 0).toFixed(1)} nm`, color: '#9b6dff' },
              { label: 'Razao V/S', value: (state.currentVsFpm > 0 ? '+' : '') + (state.currentVsFpm || 0) + ' ft/min', color: state.currentVsFpm > 200 ? '#3dd68c' : state.currentVsFpm < -200 ? '#ff6b6b' : '#9aa0b8' },
              { label: 'Alt AGL', value: (state.currentAltAGL || 0).toLocaleString('pt-BR') + ' ft', color: '#f5a623' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0f1117', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#5a6080', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {state.status === 'waiting_takeoff' && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#f5a623' }}>
            GPS ativo · Aguardando você decolar...
            <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 4 }}>A decolagem será detectada automaticamente quando a velocidade superar 40 kt</div>
          </div>
        )}
      </div>

      {/* Aircraft selector (only when idle) */}
      {state.status === 'idle' && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
          <div className="section-title">Selecionar aeronave</div>
          {aircraft.length === 0 ? (
            <div style={{ fontSize: 12, color: '#5a6080' }}>Cadastre uma aeronave primeiro</div>
          ) : (
            <select value={selectedAc} onChange={e => setSelectedAc(e.target.value)}>
              {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Aircraft info (when tracking) */}
      {state.status !== 'idle' && ac && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1e2230', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{ac.registration}</div>
          <div style={{ fontSize: 12, color: '#9aa0b8' }}>{ac.manufacturer} {ac.model}</div>
          {state.departureIcao && (
            <div style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#4a9eff' }}>
              {state.departureIcao} → {state.destinationIcao || '...'}
            </div>
          )}
        </div>
      )}

      {/* How it works (idle) */}
      {state.status === 'idle' && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
          <div className="section-title">Como funciona</div>
          {[
            ['1', 'Selecione a aeronave', 'Escolha qual aeronave você vai voar'],
            ['2', 'Toque em Iniciar voo', 'O GPS começa a rastrear em segundo plano'],
            ['3', 'Voe normalmente', 'Coloque o celular no bolso — decolagem e pouso detectados automaticamente'],
            ['4', 'Confirme ao pousar', 'Aparece uma tela com os dados pré-preenchidos para você revisar'],
            ['5', 'Tudo atualizado', 'Diário de bordo, horímetro, manutenção e custo criados automaticamente'],
          ].map(([n, title, desc]) => (
            <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#4a9eff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
                <div style={{ fontSize: 11, color: '#9aa0b8', marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: '8px 12px', background: '#3d2800', borderRadius: 8, fontSize: 11, color: '#f5a623' }}>
            ⚠ Mantenha o celular com bateria suficiente. O GPS consome ~15% de bateria por hora.
          </div>
        </div>
      )}

      {/* Action button */}
      {state.status === 'idle' && (
        <button
          className="primary"
          style={{ width: '100%', padding: '16px', fontSize: 16, fontWeight: 700, borderRadius: 12 }}
          onClick={startTracking}
          disabled={!selectedAc}
        >
          ✈ Iniciar rastreamento de voo
        </button>
      )}

      {state.status === 'waiting_takeoff' && (
        <button
          className="danger"
          style={{ width: '100%', padding: '14px', fontSize: 14, borderRadius: 12 }}
          onClick={discard}
        >
          Cancelar rastreamento
        </button>
      )}

      {state.status === 'airborne' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{ flex: 2, padding: '14px', fontSize: 14, fontWeight: 600, background: '#4a9eff', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}
            onClick={() => setShowConfirm(true)}
          >
            🛬 Registrar pouso manual
          </button>
          <button className="danger" style={{ flex: 1, borderRadius: 12 }} onClick={discard}>Cancelar</button>
        </div>
      )}

    </div>
  );
}
