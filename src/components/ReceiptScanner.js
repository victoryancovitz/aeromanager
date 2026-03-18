import React, { useState, useRef } from 'react';
import { getAircraft, getFlights, getMissions, saveCost, saveCostForJourney, recordFuelPrice, getSettings } from '../store';

const CATEGORIES = {
  fuel: 'Combustível', hangar: 'Hangar / Tie-down', insurance: 'Seguro',
  scheduled_mx: 'Manutenção programada', unscheduled_mx: 'Manutenção corretiva',
  airport_fees: 'Taxas aeroportuárias', nav_fees: 'Taxas de navegação',
  crew: 'Tripulação', admin: 'Administrativo', other: 'Outros',
};

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Analyze receipt via IA — handles both PDF and images
async function analyzeReceipt(base64, mediaType, isPdf) {
  const prompt = `Analyze this Brazilian aviation receipt/invoice and extract ALL information.
Return ONLY valid JSON, absolutely no markdown or explanation:
{
  "vendor": "",
  "date": "YYYY-MM-DD",
  "amount": 0.00,
  "currency": "BRL",
  "category": "fuel|hangar|insurance|scheduled_mx|unscheduled_mx|airport_fees|nav_fees|crew|admin|other",
  "description": "",
  "aircraft_registration": "",
  "airport_icao": "",
  "airport_name": "",
  "fuel_liters": null,
  "fuel_price_per_liter": null,
  "fuel_type": "avgas_100ll|jet_a1|null",
  "invoice_number": "",
  "cnpj_vendor": "",
  "due_date": "YYYY-MM-DD or null",
  "confidence": "high|medium|low"
}

IMPORTANT extraction rules:
- aircraft_registration: look for "Matrícula", "Aeronave", or PT-/PR-/PS-/PP- prefixes anywhere in the document
- airport_icao: look for 4-letter ICAO codes (SBBR, SBSP, SDAM, SBGR etc) or airport names
- fuel_liters: total liters/volume of fuel purchased (look for "L", "litros", "QUANT.")  
- fuel_price_per_liter: price per liter (look for "V.UNITARIO", "R$/L", "preço unitário")
- invoice_number: NF-e number, nota fiscal number
- due_date: payment due date ("vencimento", "data pagamento")
- For NF-e documents: the total is in "VALOR TOTAL DA NOTA"
- category: if document mentions AVGAS, Jet-A, combustível → "fuel"
- description: create a clear description like "AVGAS 40L @ R$13,35/L — SDAM"
- confidence: "high" if clear NF-e or official invoice`;

  const content = [];
  if (isPdf) {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
  } else {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
  }
  content.push({ type: 'text', text: prompt });

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('API key não configurada. Configure no CoPiloto IA.');
    throw new Error(err.error?.message || `Erro da API: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const match = clean.match(/\{[\s\S]+\}/);
  if (match) try { return JSON.parse(match[0]); } catch {}
  throw new Error('IA não retornou JSON válido');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function ReceiptScanner({ onClose, onSaved }) {
  const [step,        setStep]        = useState('upload');
  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [base64,      setBase64]      = useState(null);
  const [isPdf,       setIsPdf]       = useState(false);
  const [extracted,   setExtracted]   = useState(null);
  const [aircraft,    setAircraft]    = useState([]);
  const [flights,     setFlights]     = useState([]);
  const [missions,    setMissions]    = useState([]);
  const [serverKey,   setServerKey]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [form,        setForm]        = useState({
    aircraftId: '', flightId: '', missionId: '',
    updateFuelPrice: true,
  });

  const fileRef   = useRef();
  const cameraRef = useRef();

  React.useEffect(() => {
    Promise.all([getAircraft(), getFlights(), getMissions(), getSettings()]).then(([ac, fl, ms, s]) => {
      setAircraft(ac || []);
      setFlights((fl || []).slice(0, 50)); // last 50 flights
      setMissions((ms || []).slice(0, 30));
      if (ac?.length) setForm(f => ({ ...f, aircraftId: ac[0].id }));
    });
    // Check server key
    fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    }).then(r => r.json()).then(d => setServerKey(!d.error?.type?.includes('auth'))).catch(() => setServerKey(false));
  }, []);

  // Auto-detect aircraft from registration in NF
  React.useEffect(() => {
    if (!extracted?.aircraft_registration || !aircraft.length) return;
    const reg = extracted.aircraft_registration.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const found = aircraft.find(ac => ac.registration.replace(/[^A-Z0-9]/gi, '').toUpperCase() === reg);
    if (found) setForm(f => ({ ...f, aircraftId: found.id }));
  }, [extracted, aircraft]);

  async function handleFile(f) {
    if (!f) return;
    const pdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    setIsPdf(pdf);
    setFile(f);
    if (!pdf) setPreview(URL.createObjectURL(f));
    const b64 = await fileToBase64(f);
    setBase64(b64);
    setStep('preview');
  }

  async function analyze() {
    if (!base64) return;
    setLoading(true);
    setError('');
    try {
      const mt = file?.type || 'image/jpeg';
      const data = await analyzeReceipt(base64, mt, isPdf);
      setExtracted(data);
      setStep('review');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function save() {
    if (!extracted) return;
    setLoading(true);
    setError('');
    try {
      const cost = {
        aircraftId:    form.aircraftId || null,
        flightId:      form.flightId   || null,
        missionId:     form.missionId  || null,
        category:      extracted.category || 'other',
        costType:      'variable',
        amountBrl:     parseFloat(extracted.amount) || 0,
        description:   extracted.description || extracted.vendor || 'Recibo digitalizado',
        referenceDate: extracted.date || new Date().toISOString().slice(0, 10),
        vendor:        extracted.vendor || '',
        invoiceNumber: extracted.invoice_number || null,
      };

      await saveCost(cost);

      // Auto-update fuel price in airport
      if (form.updateFuelPrice && extracted.category === 'fuel' && extracted.airport_icao && extracted.fuel_price_per_liter) {
        await recordFuelPrice({
          icao:         extracted.airport_icao,
          pricePerLiter: parseFloat(extracted.fuel_price_per_liter),
          liters:        parseFloat(extracted.fuel_liters) || 0,
          fuelType:      extracted.fuel_type === 'jet_a1' ? 'jet_a1' : 'avgas_100ll',
          vendor:        extracted.vendor || '',
          date:          extracted.date || new Date().toISOString().slice(0, 10),
          flightId:      form.flightId || null,
        });
      }

      onSaved?.();
      setStep('done');
    } catch (e) {
      setError(`Erro ao salvar: ${e.message}`);
    }
    setLoading(false);
  }

  function upd(k, v) { setExtracted(e => ({ ...e, [k]: v })); }

  // Filter flights/missions by selected aircraft
  const acFlights  = form.aircraftId ? flights.filter(f => f.aircraftId === form.aircraftId) : flights;
  const acMissions = form.aircraftId ? missions.filter(m => m.aircraftId === form.aircraftId) : missions;

  const hasKey = serverKey;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:1001, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 20px', overflowY:'auto' }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:580, padding:26 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--amber-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🧾</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:17 }}>Digitalizar NF / Recibo</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>PDF ou foto → lançamento automático com IA</div>
          </div>
          <button className="ghost" onClick={onClose} style={{ fontSize:16 }}>✕</button>
        </div>

        {error && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)', display:'flex', gap:8 }}>
            <span style={{ flex:1 }}>{error}</span>
            <button className="ghost" style={{ fontSize:11 }} onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* ── UPLOAD ──────────────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            {!hasKey && (
              <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:12, color:'var(--amber)' }}>
                ⚠ API não configurada no servidor. Configure no CoPiloto IA.
              </div>
            )}
            <input ref={fileRef}   type="file" accept="image/*,.pdf" capture={false}       style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
            <input ref={cameraRef} type="file" accept="image/*"      capture="environment" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                { icon:'📷', label:'Tirar foto',    ref:cameraRef },
                { icon:'🖼', label:'Imagem/PDF',    ref:fileRef   },
                { icon:'📄', label:'NF-e PDF',      ref:fileRef   },
              ].map((btn, i) => (
                <button key={i} onClick={() => btn.ref.current?.click()}
                  style={{ padding:'20px 8px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg2)', display:'flex', flexDirection:'column', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <span style={{ fontSize:26 }}>{btn.icon}</span>
                  <span style={{ fontSize:11, color:'var(--text2)' }}>{btn.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', lineHeight:1.7 }}>
              NF-e, recibos, comprovantes de hangar, faturas de manutenção<br/>
              A IA extrai automaticamente: aeronave, litros, preço, aeroporto
            </div>
          </div>
        )}

        {/* ── PREVIEW ─────────────────────────────────────────── */}
        {step === 'preview' && (
          <div>
            {preview ? (
              <img src={preview} alt="Recibo" style={{ width:'100%', borderRadius:10, marginBottom:14, maxHeight:280, objectFit:'contain', background:'var(--bg2)' }} />
            ) : (
              <div style={{ padding:'30px', textAlign:'center', background:'var(--bg2)', borderRadius:10, marginBottom:14 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:13, color:'var(--text2)', fontWeight:500 }}>{file?.name}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{(file?.size/1024).toFixed(0)} KB — PDF pronto para análise</div>
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button className="primary" onClick={analyze} disabled={loading || !hasKey} style={{ flex:1, padding:'12px', fontSize:14 }}>
                {loading ? '🧠 Analisando...' : '✦ Analisar com IA'}
              </button>
              <button onClick={() => { setStep('upload'); setPreview(null); setBase64(null); setFile(null); }}>Trocar</button>
            </div>
          </div>
        )}

        {/* ── REVIEW ──────────────────────────────────────────── */}
        {step === 'review' && extracted && (
          <div>
            {/* AI confidence banner */}
            <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:8, fontSize:12, color:'var(--green)' }}>
              ✓ Dados extraídos — confiança: <strong>{extracted.confidence === 'high' ? 'Alta' : extracted.confidence === 'medium' ? 'Média' : 'Baixa'}</strong>. Revise antes de salvar.
            </div>

            {/* Fuel highlight */}
            {extracted.category === 'fuel' && extracted.fuel_liters && (
              <div style={{ marginBottom:14, padding:'12px 16px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>LITROS</div>
                  <div style={{ fontSize:18, fontWeight:600, fontFamily:'var(--font-mono)', color:'var(--blue)' }}>{extracted.fuel_liters}L</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>R$/LITRO</div>
                  <div style={{ fontSize:18, fontWeight:600, fontFamily:'var(--font-mono)', color:'var(--blue)' }}>R$ {parseFloat(extracted.fuel_price_per_liter||0).toFixed(2)}</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>AEROPORTO</div>
                  <div style={{ fontSize:14, fontWeight:600, fontFamily:'var(--font-mono)', color:'var(--blue)' }}>{extracted.airport_icao || '—'}</div>
                </div>
              </div>
            )}

            {/* Editable fields */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label>Valor total (R$)</label>
                  <input type="number" step="0.01" value={extracted.amount || ''} onChange={e => upd('amount', parseFloat(e.target.value))}
                    style={{ fontFamily:'var(--font-mono)', fontSize:16, fontWeight:500, color:'var(--blue)' }} />
                </div>
                <div>
                  <label>Data</label>
                  <input type="date" value={extracted.date || ''} onChange={e => upd('date', e.target.value)} />
                </div>
              </div>

              <div>
                <label>Fornecedor</label>
                <input value={extracted.vendor || ''} onChange={e => upd('vendor', e.target.value)} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label>Categoria</label>
                  <select value={extracted.category || 'other'} onChange={e => upd('category', e.target.value)}>
                    {Object.entries(CATEGORIES).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label>Nº da Nota</label>
                  <input value={extracted.invoice_number || ''} onChange={e => upd('invoice_number', e.target.value)} style={{ fontFamily:'var(--font-mono)' }} />
                </div>
              </div>

              <div>
                <label>Descrição</label>
                <input value={extracted.description || ''} onChange={e => upd('description', e.target.value)} />
              </div>

              {/* Link to aircraft / flight / mission */}
              <div style={{ padding:'12px 14px', background:'var(--bg2)', borderRadius:10 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Vincular a</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div>
                    <label style={{ fontSize:11 }}>Aeronave</label>
                    <select value={form.aircraftId} onChange={e => setForm(f => ({ ...f, aircraftId:e.target.value, flightId:'', missionId:'' }))}>
                      <option value="">— Sem aeronave —</option>
                      {aircraft.map(ac => (
                        <option key={ac.id} value={ac.id}>
                          {ac.registration} — {ac.model}
                          {extracted.aircraft_registration && ac.registration.includes(extracted.aircraft_registration.slice(-4)) ? ' ✓' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11 }}>Voo (opcional)</label>
                    <select value={form.flightId} onChange={e => setForm(f => ({ ...f, flightId:e.target.value }))}>
                      <option value="">— Sem voo —</option>
                      {acFlights.map(f => (
                        <option key={f.id} value={f.id}>{f.date} · {f.departureIcao}→{f.destinationIcao}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11 }}>Missão (opcional)</label>
                    <select value={form.missionId} onChange={e => setForm(f => ({ ...f, missionId:e.target.value }))}>
                      <option value="">— Sem missão —</option>
                      {acMissions.map(m => (
                        <option key={m.id} value={m.id}>{m.dateStart} · {m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Fuel price auto-update toggle */}
              {extracted.category === 'fuel' && extracted.airport_icao && extracted.fuel_price_per_liter && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:8 }}>
                  <input type="checkbox" id="updateFuel" checked={form.updateFuelPrice} onChange={e => setForm(f => ({ ...f, updateFuelPrice:e.target.checked }))} />
                  <label htmlFor="updateFuel" style={{ fontSize:12, color:'var(--green)', cursor:'pointer', marginBottom:0 }}>
                    Atualizar preço do combustível em {extracted.airport_icao} (R$ {parseFloat(extracted.fuel_price_per_liter).toFixed(2)}/L)
                  </label>
                </div>
              )}

              {/* Due date warning */}
              {extracted.due_date && (
                <div style={{ padding:'8px 14px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:12, color:'var(--amber)' }}>
                  ⏰ Vencimento: {fmtDate(extracted.due_date)}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button className="primary" onClick={save} disabled={loading} style={{ flex:1, padding:'12px' }}>
                {loading ? 'Salvando...' : '✓ Lançar despesa'}
              </button>
              <button onClick={() => setStep('preview')}>← Voltar</button>
            </div>
          </div>
        )}

        {/* ── DONE ────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'30px 20px' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>✅</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:20, color:'var(--green)', marginBottom:8 }}>Despesa lançada!</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:24, lineHeight:1.7 }}>
              Custo registrado no módulo financeiro.
              {form.flightId && <><br/>Vinculado ao voo selecionado.</>}
              {form.missionId && <><br/>Vinculado à missão selecionada.</>}
              {form.updateFuelPrice && extracted?.airport_icao && <><br/>Preço do combustível em {extracted.airport_icao} atualizado.</>}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button className="primary" onClick={() => { setStep('upload'); setPreview(null); setExtracted(null); setFile(null); }}>
                Digitalizar outro
              </button>
              <button onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
