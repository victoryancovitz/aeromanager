import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getFuelPrices } from '../store';

const FBO_DB = {
  // Brasil
  'SBGR': [{ name:'Shell Aviation GRU', email:'ops@shell-gru.com.br', phone:'+55 11 2445-3000', services:['fuel','handling','catering','crew_car'] },
           { name:'BRA Aviation Services', email:'handling@bra-gru.com.br', phone:'+55 11 2445-2100', services:['handling','catering'] }],
  'SBKP': [{ name:'Air BP Campinas', email:'aviation@airbp-vcp.com.br', phone:'+55 19 3725-5500', services:['fuel','handling'] }],
  'SBJD': [{ name:'Posto Jundiaí Aviation', email:'ops@jundiai-aviation.com.br', phone:'+55 11 4523-1200', services:['fuel','handling'] }],
  'SBSP': [{ name:'ExecuJet Congonhas', email:'ops@execujet-cgh.com.br', phone:'+55 11 5090-7000', services:['fuel','handling','catering','hangar'] }],
  'SBCT': [{ name:'Air BP Curitiba', email:'cwr@airbp-cwb.com.br', phone:'+55 41 3381-1800', services:['fuel','handling'] }],
  'SBPA': [{ name:'Shell Aviation Porto Alegre', email:'poa@shell-aviation.com.br', services:['fuel','handling','catering'] }],
  // Internacional
  'KOPF': [{ name:'World Fuel Services OPF', email:'aviation@wfsc-opf.com', phone:'+1 305 871 2345', services:['fuel','handling','catering','crew_car','hotel'] },
           { name:'Sheltair OPF', email:'ops@sheltair-opf.com', phone:'+1 305 871-3000', services:['handling','catering','hangar'] }],
  'KMIA': [{ name:'Signature Flight Support MIA', email:'mia@signatureflight.com', phone:'+1 305 871-0000', services:['fuel','handling','catering','crew_car','hotel'] }],
  'LIRF': [{ name:'ExecuJet Rome', email:'rome@execujet.com', phone:'+39 06 6595-6000', services:['fuel','handling','catering','hotel'] },
           { name:'Eni Jet FCO', email:'aviation@enijet-fco.it', services:['fuel'] }],
  'MMTO': [{ name:'Interjet FBO Toluca', email:'ops@interjet-tol.mx', phone:'+52 722 279-0500', services:['fuel','handling','catering'] }],
  'SCEL': [{ name:'ExecuJet Santiago', email:'scl@execujet.com', phone:'+56 2 2690-1700', services:['fuel','handling','catering','hotel'] }],
};

const SERVICE_LABELS = { fuel:'Combustível', handling:'Handling', catering:'Catering', crew_car:'Carro tripulação', hangar:'Hangar', hotel:'Hotel' };
const SERVICE_ICONS  = { fuel:'⛽', handling:'🛬', catering:'🍽', crew_car:'🚗', hangar:'🏗', hotel:'🏨' };

function buildEmail(type, data) {
  const { fbo, aircraft, icao, date, etd, eta, pax, fuelLiters, fuelType, cateringReq, handlingNotes, operator } = data;
  const dateStr = date ? new Date(date+'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }) : 'TBD';

  if (type === 'fuel_quote') return {
    subject: `Fuel Quote Request — ${aircraft} — ${icao} — ${dateStr}`,
    body: `Dear ${fbo.name} Operations Team,

We would like to request a fuel quote for the following operation:

AIRCRAFT:    ${aircraft}
REGISTRATION: ${aircraft}
OPERATOR:    ${operator || 'Private Operation'}
AIRPORT:     ${icao}
DATE:        ${dateStr}
ETD:         ${etd || 'TBD'} UTC

FUEL REQUIREMENTS:
Type:        ${fuelType === 'jet_a1' ? 'Jet-A1 / Jet A' : 'AVGAS 100LL'}
Quantity:    ${fuelLiters ? `${fuelLiters} liters (approx. ${Math.round(fuelLiters/3.785)} USG)` : 'Full uplift / as required'}

Could you please provide:
1. Current fuel price per liter (USD or local currency)
2. Into-plane fees / throughput charges
3. Availability confirmation for the requested date

Please reply to this email or contact us at your earliest convenience.

Thank you,
${operator || 'Flight Operations'}`,
  };

  if (type === 'handling') return {
    subject: `Handling Request — ${aircraft} — ${icao} — ${dateStr}`,
    body: `Dear ${fbo.name} Handling Team,

We hereby request ground handling services for the following operation:

FLIGHT DETAILS
Aircraft:      ${aircraft}
Airport:       ${icao}
Date:          ${dateStr}
ETA:           ${eta || 'TBD'} UTC
ETD:           ${etd || 'TBD'} UTC
Passengers:    ${pax || 0} PAX + crew
Flight type:   Private / General Aviation

SERVICES REQUIRED
${fuelLiters ? `☐ Fuel: ${fuelType === 'jet_a1' ? 'Jet-A1' : 'AVGAS 100LL'} — ${fuelLiters}L approx.` : ''}
☐ Marshalling / parking
☐ GPU (if available)
☐ Potable water
☐ Lavatory service
${cateringReq ? `☐ Catering (see details below)` : ''}
${handlingNotes ? `\nADDITIONAL NOTES:\n${handlingNotes}` : ''}

CATERING REQUEST${cateringReq ? `\n${cateringReq}` : '\nNone required'}

Please confirm availability and send handling confirmation with:
- Parking position / hangar
- Contact frequency or phone for arrival
- Any slot requirements or restrictions

Thank you,
${operator || 'Flight Operations'}`,
  };

  if (type === 'catering') return {
    subject: `Catering Request — ${aircraft} — ${icao} — ${dateStr}`,
    body: `Dear ${fbo.name} Catering Team,

Please arrange catering for the following flight:

AIRCRAFT:    ${aircraft}
AIRPORT:     ${icao}  
DATE:        ${dateStr}
DEPARTURE:   ${etd || 'TBD'} UTC
PAX:         ${pax || 1} passengers + crew

CATERING ORDER
${cateringReq || `Please provide standard executive catering for ${(pax||1) + 2} persons:
- Breakfast / light snacks
- Beverages (water, juice, soft drinks)
- Coffee, tea
- Dietary requirements: None`}

Delivery requested: 1 hour before ETD (${etd ? `${etd} UTC` : 'TBD'})

Please confirm order and send invoice to: ${operator || 'operations@aircraft.com'}

Thank you,
${operator || 'Flight Operations'}`,
  };
}

export default function FBOModule({ aircraft }) {
  const [selectedAc, setSelectedAc] = useState(aircraft[0]?.id || '');
  const [icao, setIcao]             = useState('');
  const [date, setDate]             = useState(new Date().toISOString().slice(0,10));
  const [etd, setEtd]               = useState('');
  const [eta, setEta]               = useState('');
  const [pax, setPax]               = useState(2);
  const [fuelLiters, setFuelLiters] = useState('');
  const [cateringReq, setCateringReq] = useState('');
  const [handlingNotes, setHandlingNotes] = useState('');
  const [emailType, setEmailType]   = useState('handling');
  const [selectedFBO, setSelectedFBO] = useState(null);
  const [generatedEmail, setGeneratedEmail] = useState(null);
  const [apiKey, setApiKey]         = useState('');
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [lastPrices, setLastPrices] = useState({});
  const [showCustomFBO, setShowCustomFBO] = useState(false);
  const [customFBO, setCustomFBO]   = useState({ name:'', email:'', services:['fuel','handling'] });

  const ac = aircraft.find(a => a.id === selectedAc);

  useEffect(() => {
    getSettings().then(s => setApiKey(s?.apiKey || ''));
    getFuelPrices().then(prices => {
      const map = {};
      (prices||[]).forEach(p => { if (!map[p.icao] || p.date > map[p.icao].date) map[p.icao] = p; });
      setLastPrices(map);
    });
  }, []);

  const fbosAtIcao = icao ? (FBO_DB[icao.toUpperCase()] || []) : [];
  const lastPrice = icao && lastPrices[icao.toUpperCase()];

  function generate() {
    if (!selectedFBO && !customFBO.name) return;
    const fbo = selectedFBO || customFBO;
    const data = {
      fbo, aircraft: ac?.registration || '?',
      icao: icao.toUpperCase(), date, etd, eta, pax,
      fuelLiters: fuelLiters || null,
      fuelType: ac?.fuelType || 'jet_a1',
      cateringReq, handlingNotes,
      operator: '',
    };
    const email = buildEmail(emailType, data);
    setGeneratedEmail(email);
  }

  async function enhanceWithAI() {
    if (!apiKey || !generatedEmail) return;
    setAiEnhancing(true);
    try {
      const res = await fetch('/api/claude', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model:'claude-opus-4-6', max_tokens:1000,
          messages:[{ role:'user', content:`Improve this aviation FBO email to be more professional and concise. Keep all the technical information but make it sound more like it was written by an experienced flight operations manager. Keep in English. Return only the improved email body, no subject line:\n\n${generatedEmail.body}` }]
        }),
      });
      const data = await res.json();
      const improved = data.content?.[0]?.text || generatedEmail.body;
      setGeneratedEmail(e => ({ ...e, body: improved }));
    } catch(e) { console.error(e); }
    setAiEnhancing(false);
  }

  function copyEmail() {
    if (!generatedEmail) return;
    navigator.clipboard.writeText(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
  }

  function openMailto() {
    if (!generatedEmail || !selectedFBO?.email) return;
    const mailto = `mailto:${selectedFBO.email}?subject=${encodeURIComponent(generatedEmail.subject)}&body=${encodeURIComponent(generatedEmail.body)}`;
    window.open(mailto);
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>FBO & Cotações</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>Cotações de combustível, handling requests e emails para FBOs</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Left: Form */}
        <div>
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Dados do voo</div>
            <div style={{ marginBottom:12 }}>
              <label>Aeronave</label>
              <select value={selectedAc} onChange={e => setSelectedAc(e.target.value)}>
                {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
              </select>
            </div>
            <div className="g2" style={{ marginBottom:12 }}>
              <div>
                <label>ICAO do aeroporto</label>
                <input value={icao} onChange={e => setIcao(e.target.value.toUpperCase())} placeholder="KOPF, SBGR, LIRF..." maxLength={4} style={{ fontFamily:'var(--font-mono)', textTransform:'uppercase', fontWeight:500, letterSpacing:'.05em' }} />
              </div>
              <div>
                <label>Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="g2" style={{ marginBottom:12 }}>
              <div><label>ETD (UTC)</label><input value={etd} onChange={e => setEtd(e.target.value)} placeholder="14:30" /></div>
              <div><label>ETA (UTC)</label><input value={eta} onChange={e => setEta(e.target.value)} placeholder="10:00" /></div>
            </div>
            <div className="g2">
              <div><label>Passageiros</label><input type="number" min="0" value={pax} onChange={e => setPax(parseInt(e.target.value)||0)} /></div>
              <div>
                <label>Combustível (litros)</label>
                <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} placeholder={`${ac?.fuelType === 'jet_a1' ? 'Jet-A1' : 'AVGAS'}`} />
              </div>
            </div>
            {lastPrice && (
              <div style={{ marginTop:8, padding:'6px 10px', background:'var(--green-dim)', borderRadius:7, fontSize:11, color:'var(--green)' }}>
                Último preço registrado em {icao}: <strong>R$ {parseFloat(lastPrice.price_per_liter).toFixed(2)}/L</strong> ({lastPrice.vendor || 'desconhecido'} — {new Date(lastPrice.date).toLocaleDateString('pt-BR')})
              </div>
            )}
          </div>

          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div className="section-title">Tipo de email</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
              {[['handling','🛬 Handling'],['fuel_quote','⛽ Cotação'],['catering','🍽 Catering']].map(([v,l]) => (
                <button key={v} onClick={() => setEmailType(v)} style={{ padding:'10px 8px', borderRadius:9, fontSize:11, fontWeight:500, background: emailType===v?'var(--blue-dim)':'var(--bg2)', color: emailType===v?'var(--blue)':'var(--text2)', border:`1px solid ${emailType===v?'var(--blue-mid)':'var(--border)'}` }}>{l}</button>
              ))}
            </div>
            {(emailType === 'catering' || emailType === 'handling') && (
              <div style={{ marginBottom:12 }}>
                <label>Catering / notas especiais</label>
                <textarea value={cateringReq} onChange={e => setCateringReq(e.target.value)} placeholder="Ex: 3 PAX — sem glúten, 1 vegetariano. 2 garrafas de vinho branco seco. Café e biscoitos para tripulação." style={{ minHeight:80 }} />
              </div>
            )}
            {emailType === 'handling' && (
              <div>
                <label>Notas de handling</label>
                <textarea value={handlingNotes} onChange={e => setHandlingNotes(e.target.value)} placeholder="Ex: Necessitamos GPU. Passageiro VIP — privacidade solicitada. Carga a bordo: malas executivas." style={{ minHeight:60 }} />
              </div>
            )}
          </div>

          {/* FBO selection */}
          <div className="card" style={{ padding:'16px 20px' }}>
            <div className="section-title">FBO de destino</div>
            {fbosAtIcao.length > 0 ? (
              <div style={{ marginBottom:12 }}>
                {fbosAtIcao.map((fbo, i) => (
                  <div key={i} onClick={() => setSelectedFBO(fbo)} style={{ padding:'10px 12px', borderRadius:9, border:`1px solid ${selectedFBO?.name===fbo.name?'var(--blue-mid)':'var(--border)'}`, background: selectedFBO?.name===fbo.name?'var(--blue-dim)':'var(--bg2)', cursor:'pointer', marginBottom:7 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--text1)' }}>{fbo.name}</div>
                        {fbo.email && <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--font-mono)', marginTop:1 }}>{fbo.email}</div>}
                      </div>
                      <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'flex-end' }}>
                        {fbo.services.map(s => <span key={s} style={{ fontSize:11 }} title={SERVICE_LABELS[s]}>{SERVICE_ICONS[s]}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
                {icao ? `Nenhum FBO cadastrado para ${icao}. Digite os dados manualmente:` : 'Digite um ICAO para ver FBOs disponíveis.'}
              </div>
            )}
            <button style={{ fontSize:11, width:'100%' }} onClick={() => setShowCustomFBO(v => !v)}>+ FBO manual / email direto</button>
            {showCustomFBO && (
              <div style={{ marginTop:10 }}>
                <div style={{ marginBottom:8 }}><label>Nome do FBO</label><input value={customFBO.name} onChange={e => setCustomFBO(f => ({...f,name:e.target.value}))} placeholder="Signature Flight Support" /></div>
                <div><label>Email</label><input value={customFBO.email} onChange={e => setCustomFBO(f => ({...f,email:e.target.value}))} placeholder="ops@fbo.com" /></div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Generated email */}
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <button className="primary" onClick={generate} disabled={!icao || (!selectedFBO && !customFBO.name)} style={{ flex:1, padding:'12px' }}>
              ✦ Gerar email
            </button>
          </div>

          {generatedEmail && (
            <div className="card" style={{ padding:'16px 20px' }}>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Assunto</div>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--blue)', padding:'6px 10px', background:'var(--bg2)', borderRadius:7 }}>{generatedEmail.subject}</div>
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:9.5, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Corpo</div>
                <textarea
                  value={generatedEmail.body}
                  onChange={e => setGeneratedEmail(g => ({...g, body:e.target.value}))}
                  style={{ fontSize:12, minHeight:340, fontFamily:'var(--font-mono)', lineHeight:1.6, whiteSpace:'pre-wrap' }}
                />
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {apiKey && (
                  <button onClick={enhanceWithAI} disabled={aiEnhancing} style={{ fontSize:11, background:'var(--purple-dim)', color:'var(--purple)', border:'1px solid var(--purple-mid)' }}>
                    {aiEnhancing ? '🧠 Melhorando...' : '✦ Melhorar com IA'}
                  </button>
                )}
                <button onClick={copyEmail} style={{ fontSize:11 }}>📋 Copiar</button>
                {selectedFBO?.email && <button onClick={openMailto} style={{ fontSize:11 }} className="primary">✉ Abrir no Mail</button>}
              </div>
            </div>
          )}

          {!generatedEmail && (
            <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
              <div style={{ fontSize:36, marginBottom:12, opacity:.4 }}>✉</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:16, marginBottom:8 }}>Email pronto em segundos</div>
              <div style={{ fontSize:12, lineHeight:1.7 }}>
                Preencha os dados do voo, selecione o tipo de email e o FBO.<br />
                O sistema monta o email completo — você edita e envia.
              </div>
            </div>
          )}

          {/* Last prices panel */}
          {Object.keys(lastPrices).length > 0 && (
            <div className="card" style={{ padding:'14px 18px', marginTop:14 }}>
              <div className="section-title">Últimos preços registrados</div>
              {Object.values(lastPrices).sort((a,b) => b.date.localeCompare(a.date)).slice(0,8).map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text3)', width:40 }}>{p.icao}</span>
                  <span style={{ fontSize:10, color:'var(--text3)', flex:1 }}>{p.fuel_type === 'jet_a1' ? 'Jet-A1' : 'AVGAS'}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--amber)', fontWeight:500 }}>R$ {parseFloat(p.price_per_liter).toFixed(2)}</span>
                  <span style={{ fontSize:10, color:'var(--text3)' }}>{new Date(p.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
