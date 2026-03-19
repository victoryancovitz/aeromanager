import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAircraft } from '../context/AircraftContext';

// ── helpers ────────────────────────────────────────────────────────────────
const toBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Leitura falhou'));
    r.readAsDataURL(file);
  });

const SYSTEM_PROMPT = `Você é um especialista em aviação brasileira. Analise a imagem de um diário de bordo e extraia TODOS os registros de voo visíveis.

Para cada voo retorne um objeto JSON com EXATAMENTE estes campos:
- date: string "YYYY-MM-DD" (converta datas PT-BR)
- origin: string ICAO ou nome do aeródromo (ex: "SBMT", "SBJD")
- destination: string ICAO ou nome
- departure_time: string "HH:MM" ou null
- arrival_time: string "HH:MM" ou null
- flight_time: número decimal em horas (ex: 1.5 = 1h30). Calcule a partir de decolagem/pouso se disponível.
- total_hours: número decimal das horas acumuladas (hodômetro) APÓS este voo, ou null
- pilot: string nome do piloto em comando, ou null
- copilot: string nome do copiloto/instrutor, ou null
- flight_rules: "VFR" ou "IFR" ou null
- remarks: string observações relevantes, ou null
- confidence: número 0-1 indicando confiança na extração desta linha

Retorne APENAS um JSON válido assim:
{"flights": [...]}

Sem markdown, sem texto fora do JSON. Se não houver voos visíveis, retorne {"flights": []}.`;

// ── API call ───────────────────────────────────────────────────────────────
async function analyzeImage(base64, mediaType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Extraia todos os voos desta página do diário de bordo.' },
          ],
        },
      ],
    }),
  });
  const data = await response.json();
  const text = data.content?.map((b) => b.text || '').join('') || '';
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return parsed.flights || [];
}

// ── sub-components ─────────────────────────────────────────────────────────
function ConfidenceBadge({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, fontSize: 11, padding: '1px 6px', fontWeight: 700, whiteSpace: 'nowrap'
    }}>
      {pct}%
    </span>
  );
}

function DuplicateBadge() {
  return (
    <span style={{
      background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b55',
      borderRadius: 4, fontSize: 11, padding: '1px 6px', fontWeight: 700
    }}>
      ⚠ Duplicado
    </span>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function LogbookImportWizard({ onClose, onImported }) {
  const { selectedAircraft } = useAircraft?.() || {};
  const [step, setStep] = useState('upload'); // upload | processing | review | done
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [flights, setFlights] = useState([]);
  const [duplicates, setDuplicates] = useState(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState({});
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const dropRef = useRef();

  // ── drag & drop ──
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer?.files || e.target.files || [])
      .filter((f) => f.type.startsWith('image/'));
    if (!dropped.length) return;
    setFiles((prev) => [...prev, ...dropped]);
    dropped.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
  }, []);

  const removeFile = (i) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ── check duplicates against existing flights ──
  const checkDuplicates = async (extracted, aircraftId) => {
    const dupeSet = new Set();
    try {
      const { data: existing } = await supabase
        .from('flights')
        .select('date, origin, destination')
        .eq('aircraft_id', aircraftId);
      if (existing) {
        extracted.forEach((f, i) => {
          const match = existing.some(
            (e) =>
              e.date === f.date &&
              (e.origin || '').toLowerCase() === (f.origin || '').toLowerCase() &&
              (e.destination || '').toLowerCase() === (f.destination || '').toLowerCase()
          );
          if (match) dupeSet.add(i);
        });
      }
    } catch (_) {}
    return dupeSet;
  };

  // ── process images ──
  const processImages = async () => {
    setStep('processing');
    setError(null);
    const all = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length, label: `Analisando imagem ${i + 1} de ${files.length}…` });
      try {
        const b64 = await toBase64(files[i]);
        const extracted = await analyzeImage(b64, files[i].type);
        all.push(...extracted);
      } catch (err) {
        console.error('Erro ao analisar imagem', i, err);
      }
    }
    // deduplicate within extracted list (same date+origin+dest)
    const seen = new Set();
    const unique = all.filter((f) => {
      const key = `${f.date}|${f.origin}|${f.destination}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // sort by date
    unique.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    setFlights(unique);

    // check against DB
    const aircraftId = selectedAircraft?.id;
    if (aircraftId) {
      const dupeSet = await checkDuplicates(unique, aircraftId);
      setDuplicates(dupeSet);
      // default: skip all duplicates
      const skipMap = {};
      dupeSet.forEach((i) => { skipMap[i] = true; });
      setSkipDuplicates(skipMap);
    }
    setStep('review');
  };

  // ── import to DB ──
  const handleImport = async () => {
    setImporting(true);
    const aircraftId = selectedAircraft?.id;
    const { data: { user } } = await supabase.auth.getUser();

    const toInsert = flights
      .filter((_, i) => !skipDuplicates[i])
      .map((f) => ({
        aircraft_id: aircraftId,
        user_id: user?.id,
        date: f.date,
        origin: f.origin || null,
        destination: f.destination || null,
        departure_time: f.departure_time || null,
        arrival_time: f.arrival_time || null,
        flight_time: f.flight_time || null,
        total_hours: f.total_hours || null,
        pilot_name: f.pilot || null,
        copilot_name: f.copilot || null,
        flight_rules: f.flight_rules || 'VFR',
        remarks: f.remarks || null,
        imported_from: 'logbook_photo',
      }));

    try {
      const { error: err } = await supabase.from('flights').insert(toInsert);
      if (err) throw err;
      setResult({ imported: toInsert.length, skipped: flights.length - toInsert.length });
      setStep('done');
      if (onImported) onImported(toInsert.length);
    } catch (err) {
      setError('Erro ao importar: ' + err.message);
    }
    setImporting(false);
  };

  // ── styles ──
  const S = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    },
    modal: {
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16,
      width: '100%', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
    },
    header: {
      padding: '20px 24px', borderBottom: '1px solid #1e293b',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    title: { color: '#f1f5f9', fontWeight: 700, fontSize: 18, margin: 0 },
    subtitle: { color: '#64748b', fontSize: 13, marginTop: 2 },
    body: { flex: 1, overflowY: 'auto', padding: 24 },
    footer: {
      padding: '16px 24px', borderTop: '1px solid #1e293b',
      display: 'flex', justifyContent: 'flex-end', gap: 10,
    },
    btn: (variant = 'primary') => ({
      padding: '9px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer',
      border: 'none', transition: 'all .15s',
      ...(variant === 'primary' ? { background: '#3b82f6', color: '#fff' } : {}),
      ...(variant === 'secondary' ? { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' } : {}),
      ...(variant === 'success' ? { background: '#22c55e', color: '#fff' } : {}),
      ...(variant === 'danger' ? { background: '#ef4444', color: '#fff' } : {}),
    }),
    dropzone: {
      border: '2px dashed #334155', borderRadius: 12, padding: '40px 24px',
      textAlign: 'center', cursor: 'pointer', transition: 'all .2s',
      background: '#0f172a',
    },
    previewGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 16,
    },
    previewItem: {
      position: 'relative', borderRadius: 8, overflow: 'hidden',
      border: '1px solid #334155', aspectRatio: '4/3',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      textAlign: 'left', padding: '8px 10px', color: '#64748b',
      fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
      borderBottom: '1px solid #1e293b',
    },
    td: { padding: '9px 10px', borderBottom: '1px solid #0f172a55', color: '#cbd5e1', verticalAlign: 'middle' },
    progressBar: {
      background: '#1e293b', borderRadius: 8, height: 6, overflow: 'hidden', marginTop: 12,
    },
  };

  // ── STEP: upload ──
  if (step === 'upload') return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div>
            <p style={S.title}>📖 Importar do Diário de Bordo</p>
            <p style={S.subtitle}>Tire fotos das páginas e a IA extrai os voos automaticamente</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={S.body}>
          <div
            ref={dropRef}
            style={S.dropzone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => document.getElementById('lb-file-input').click()}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <p style={{ color: '#94a3b8', fontWeight: 600, margin: 0 }}>Arraste fotos aqui ou clique para selecionar</p>
            <p style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>JPG, PNG, HEIC • Uma ou várias páginas</p>
            <input id="lb-file-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onDrop} />
          </div>

          {previews.length > 0 && (
            <>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 16, marginBottom: 4 }}>
                {files.length} {files.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}
              </p>
              <div style={S.previewGrid}>
                {previews.map((url, i) => (
                  <div key={i} style={S.previewItem}>
                    <img src={url} alt={`p${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      style={{
                        position: 'absolute', top: 4, right: 4, background: '#ef4444', border: 'none',
                        color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 12,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <p style={{ color: '#ef4444', marginTop: 12, fontSize: 13 }}>⚠ {error}</p>}
        </div>
        <div style={S.footer}>
          <button style={S.btn('secondary')} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.btn('primary'), opacity: files.length ? 1 : 0.4, cursor: files.length ? 'pointer' : 'not-allowed' }}
            disabled={!files.length}
            onClick={processImages}
          >
            🔍 Analisar {files.length > 0 ? `${files.length} ${files.length === 1 ? 'imagem' : 'imagens'}` : 'imagens'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP: processing ──
  if (step === 'processing') return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 440, alignItems: 'center', padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20, animation: 'spin 2s linear infinite' }}>🔍</div>
        <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
        <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18, margin: 0 }}>Analisando com IA…</p>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>{progress.label}</p>
        <div style={S.progressBar}>
          <div style={{
            height: '100%', background: '#3b82f6', borderRadius: 8,
            width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
            transition: 'width .4s ease',
          }} />
        </div>
        <p style={{ color: '#475569', fontSize: 12, marginTop: 10 }}>
          {progress.current} / {progress.total} página{progress.total !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );

  // ── STEP: review ──
  if (step === 'review') {
    const toImport = flights.filter((_, i) => !skipDuplicates[i]);
    return (
      <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={S.modal}>
          <div style={S.header}>
            <div>
              <p style={S.title}>✅ Revisão — {flights.length} voo{flights.length !== 1 ? 's' : ''} encontrado{flights.length !== 1 ? 's' : ''}</p>
              <p style={S.subtitle}>
                {toImport.length} para importar
                {duplicates.size > 0 && ` · ${duplicates.size} duplicado${duplicates.size !== 1 ? 's' : ''} detectado${duplicates.size !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={S.body}>
            {flights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
                <p style={{ fontWeight: 600 }}>Nenhum voo encontrado nas imagens</p>
                <p style={{ fontSize: 13 }}>Tente com fotos mais nítidas ou em melhor iluminação.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Data</th>
                      <th style={S.th}>Origem → Destino</th>
                      <th style={S.th}>Dep / Pou</th>
                      <th style={S.th}>Tempo</th>
                      <th style={S.th}>H. Total</th>
                      <th style={S.th}>Piloto</th>
                      <th style={S.th}>Regra</th>
                      <th style={S.th}>Conf.</th>
                      <th style={S.th}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flights.map((f, i) => {
                      const isDupe = duplicates.has(i);
                      const willSkip = skipDuplicates[i];
                      return (
                        <tr key={i} style={{
                          background: isDupe ? (willSkip ? '#1e293b88' : '#f59e0b08') : 'transparent',
                          opacity: willSkip ? 0.45 : 1,
                          transition: 'all .15s',
                        }}>
                          <td style={S.td}>{f.date || '—'}</td>
                          <td style={S.td}>
                            <span style={{ color: '#94a3b8' }}>{f.origin || '?'}</span>
                            <span style={{ color: '#475569', margin: '0 4px' }}>→</span>
                            <span style={{ color: '#94a3b8' }}>{f.destination || '?'}</span>
                          </td>
                          <td style={{ ...S.td, fontSize: 12, color: '#64748b' }}>
                            {f.departure_time || '—'} / {f.arrival_time || '—'}
                          </td>
                          <td style={S.td}>
                            {f.flight_time != null
                              ? `${Math.floor(f.flight_time)}h${String(Math.round((f.flight_time % 1) * 60)).padStart(2, '0')}`
                              : '—'}
                          </td>
                          <td style={{ ...S.td, color: '#64748b' }}>
                            {f.total_hours != null ? f.total_hours.toFixed(1) + 'h' : '—'}
                          </td>
                          <td style={{ ...S.td, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.pilot || '—'}
                          </td>
                          <td style={S.td}>
                            <span style={{
                              background: f.flight_rules === 'IFR' ? '#6366f122' : '#22c55e22',
                              color: f.flight_rules === 'IFR' ? '#818cf8' : '#4ade80',
                              borderRadius: 4, fontSize: 11, padding: '1px 6px', fontWeight: 700,
                            }}>
                              {f.flight_rules || 'VFR'}
                            </span>
                          </td>
                          <td style={S.td}><ConfidenceBadge value={f.confidence} /></td>
                          <td style={{ ...S.td, minWidth: 90 }}>
                            {isDupe ? (
                              <button
                                onClick={() => setSkipDuplicates((prev) => ({ ...prev, [i]: !prev[i] }))}
                                style={{
                                  ...S.btn(willSkip ? 'secondary' : 'danger'),
                                  padding: '4px 10px', fontSize: 11,
                                }}
                              >
                                {willSkip ? '+ Incluir' : '✕ Pular'}
                              </button>
                            ) : (
                              <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Novo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {duplicates.size > 0 && (
              <div style={{
                marginTop: 16, background: '#f59e0b11', border: '1px solid #f59e0b33',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fbbf24',
              }}>
                ⚠ {duplicates.size} voo{duplicates.size !== 1 ? 's' : ''} já existe{duplicates.size !== 1 ? 'm' : ''} no banco (mesma data + rota).
                {' '}Você pode incluí-los clicando em <strong>+ Incluir</strong> nas linhas marcadas.
              </div>
            )}

            {error && <p style={{ color: '#ef4444', marginTop: 12, fontSize: 13 }}>⚠ {error}</p>}
          </div>
          <div style={S.footer}>
            <button style={S.btn('secondary')} onClick={() => { setStep('upload'); setFlights([]); setDuplicates(new Set()); }}>
              ← Voltar
            </button>
            <button
              style={{
                ...S.btn('success'),
                opacity: (toImport.length > 0 && !importing) ? 1 : 0.4,
                cursor: (toImport.length > 0 && !importing) ? 'pointer' : 'not-allowed',
              }}
              disabled={!toImport.length || importing}
              onClick={handleImport}
            >
              {importing ? '⏳ Importando…' : `✈ Importar ${toImport.length} voo${toImport.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: done ──
  if (step === 'done') return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 440, alignItems: 'center', padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 22, margin: 0 }}>Importação concluída!</p>
        <p style={{ color: '#64748b', fontSize: 15, marginTop: 10 }}>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>{result?.imported}</span> voo{result?.imported !== 1 ? 's' : ''} importado{result?.imported !== 1 ? 's' : ''} com sucesso.
          {result?.skipped > 0 && <><br /><span style={{ color: '#f59e0b' }}>{result.skipped}</span> duplicado{result.skipped !== 1 ? 's' : ''} ignorado{result.skipped !== 1 ? 's' : ''}.</>}
        </p>
        <button style={{ ...S.btn('primary'), marginTop: 28, padding: '12px 36px', fontSize: 15 }} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );

  return null;
}
