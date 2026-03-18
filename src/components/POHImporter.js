import React, { useState, useRef } from 'react';
import { getAircraft, saveAircraft, saveMaintenance, getSettings } from '../store';

// ─── Estratégia: dividir PDF em grupos de páginas e enviar como imagens ────────
// O Claude analisa visualmente cada grupo e extrai dados estruturados.
// Grupos: Capa/Geral (p.1-5), Limitações (p.6-20), Performance (p.21-50+)

const STEPS = ['upload', 'extracting', 'review', 'saving', 'done'];

// Carrega PDF.js via CDN
let pdfjsLib = null;
async function loadPdfJs() {
  if (window.pdfjsLib) { pdfjsLib = window.pdfjsLib; return pdfjsLib; }
  if (pdfjsLib) return pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib = window.pdfjsLib;
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Falha ao carregar PDF.js'));
    document.head.appendChild(script);
  });
}

// Renderiza uma página do PDF como imagem base64
async function pageToBase64(pdfDoc, pageNum, scale = 1.5) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  // Retorna JPEG comprimido para economizar tokens
  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
}

// Decide quais páginas enviar para cada grupo temático
function selectPages(totalPages) {
  // Grupo 1: primeiras páginas — capa, dados gerais, limitações
  const group1 = [];
  for (let i = 1; i <= Math.min(12, totalPages); i++) group1.push(i);

  // Grupo 2: performance — varredura ampla do meio até o final
  // Muitos POHs têm perf nos últimos 40% (especialmente manuais menores)
  const perfStart = Math.max(Math.floor(totalPages * 0.28), group1.length + 1);
  const perfEnd   = Math.min(totalPages, Math.floor(totalPages * 0.80));
  const group2 = [];
  const step = Math.max(1, Math.floor((perfEnd - perfStart) / 16));
  for (let i = perfStart; i <= perfEnd && group2.length < 18; i += step) group2.push(i);
  // Sempre inclui as últimas 6 páginas (muitos POHs têm perf e limites no final)
  for (let i = Math.max(totalPages - 5, perfEnd + 1); i <= totalPages; i++) {
    if (!group2.includes(i)) group2.push(i);
  }

  // Grupo 3: manutenção — últimos 40% do documento
  const mxStart = Math.max(Math.floor(totalPages * 0.60), group1.length + 1);
  const group3 = [];
  for (let i = mxStart; i <= totalPages && group3.length < 20; i++) group3.push(i);

  return { group1, group2, group3, total: totalPages };
}

// Chama a API com imagens de páginas
async function analyzePages(images, prompt, apiKey) {
  const content = images.map(b64 => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: b64 }
  }));
  content.push({ type: 'text', text: prompt });

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 413) throw new Error('Grupo de páginas muito grande. Tente com scale menor.');
    if (res.status === 401) throw new Error('Chave da API não configurada. Configure no CoPiloto IA.');
    throw new Error(err.error?.message || `Erro da API: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Parser robusto de JSON
  let clean = text.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const match = clean.match(/\{[\s\S]+\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
    // Tenta reparar JSON truncado
    let rep = match[0].replace(/,\s*$/, '').replace(/:\s*$/, ': null');
    let opens = 0, openArr = 0;
    for (const ch of rep) {
      if (ch === '{') opens++; else if (ch === '}') opens--;
      else if (ch === '[') openArr++; else if (ch === ']') openArr--;
    }
    for (let i = 0; i < openArr; i++) rep += ']';
    for (let i = 0; i < opens; i++) rep += '}';
    try { return JSON.parse(rep); } catch {}
  }
  return null; // retorna null em vez de throw — partial data é melhor que nada
}

const PROMPT_GENERAL = `Analyze these POH/AFM pages and extract aircraft data, limits and life-limited items.
Return ONLY valid JSON, no explanation:
{
  "manufacturer": "", "model": "", "year": null,
  "engineModel": "", "engineHp": null, "engineTboHours": null,
  "propModel": "", "propTboHours": null,
  "fuelType": "avgas_100ll",
  "fuelCapacityLiters": null, "fuelUsableLiters": null,
  "maxCruiseKtas": null, "serviceCeilingFt": null,
  "mtowKg": null,
  "vso": null, "vs1": null, "vx": null, "vy": null,
  "vno": null, "vne": null, "va": null, "vfe": null,
  "maintenanceItems": [
    { "name": "", "intervalHours": null, "intervalDays": null, "notes": "" }
  ]
}
Rules: convert gal to liters (x3.785), keep altitudes in ft.
fuelType: "avgas_100ll" for piston, "jet_a1" for turbine/diesel.
maintenanceItems: only items explicitly stated in limitations/airworthiness limits (TBO, life limits, mandatory replacements). Do NOT include routine inspections — those come from the maintenance section.`;

const PROMPT_MAINTENANCE = `You are analyzing scanned aircraft POH maintenance section pages.
Look for inspection schedules, service intervals, TBO tables, and maintenance checklists.
Return ONLY valid JSON, absolutely no text outside the JSON:
{
  "maintenanceItems": [
    { "name": "", "intervalHours": null, "intervalDays": null, "notes": "" }
  ]
}
IMPORTANT rules:
- Extract ALL scheduled maintenance: 25h, 50h, 100h, 200h, 500h, annual (365 days), 2-year, TBO
- Look for tables or lists with inspection intervals
- Include engine TBO, propeller TBO, magneto overhaul, vacuum pump, alternator checks
- intervalHours: number only (e.g. 100 for "100-hour inspection")
- intervalDays: number only (e.g. 365 for annual, 730 for 2-year)
- If item has BOTH hours and calendar interval, fill both fields
- If NO maintenance schedule found, return: {"maintenanceItems":[]}
- Do NOT return null, always return the JSON structure`;

const PROMPT_PERFORMANCE = `You are analyzing scanned aircraft POH/AFM pages. These may be low quality scans.
Look carefully for ANY performance data tables — cruise performance, climb performance, range, endurance.
Return ONLY valid JSON, absolutely no explanation or text outside the JSON:
{
  "performanceProfiles": [
    { "altFt": 0, "power": 0, "ktas": 0, "fuelLph": 0 }
  ],
  "climbProfiles": [
    { "altFromFt": 0, "altToFt": 0, "kias": 0, "fpm": 0, "fuelLph": 0, "distNm": 0 }
  ]
}
IMPORTANT rules:
- Search ALL pages for tables with numbers — speed (kt, mph, km/h), altitude (ft), fuel flow (gph, pph, l/h), RPM, power %
- If you see a table with altitude and speed columns — that is cruise performance data, extract it
- Convert gal/h or US gph to L/h (multiply by 3.785)
- Convert mph to knots (multiply by 0.869)
- power = percent power (65, 75, 55 etc). If only RPM given: 2700rpm=75%, 2500rpm=65%, 2300rpm=55%, 2100rpm=45%
- Include ALL rows from ALL tables found
- If NO performance tables found at all, return: {"performanceProfiles":[],"climbProfiles":[]}
- Do NOT return null, always return the JSON structure even if empty`;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function POHImporter({ onClose, onComplete }) {
  const [step, setStep]           = useState('upload');
  const [file, setFile]           = useState(null);
  const [result, setResult]       = useState(null);
  const [progress, setProgress]   = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError]         = useState('');
  const [selectedAc, setSelectedAc] = useState('new');
  const [aircraft, setAircraft]   = useState([]);
  const [apiKey, setApiKey]       = useState('');
  const [serverKey, setServerKey] = useState(null);
  const [editData, setEditData]   = useState(null);
  const fileRef = useRef();

  React.useEffect(() => {
    getAircraft().then(list => setAircraft(list || []));
    getSettings().then(s => setApiKey(s?.apiKey || ''));
    fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    }).then(r => r.json()).then(d => setServerKey(!d.error?.type?.includes('auth'))).catch(() => setServerKey(false));
  }, []);

  const hasKey = serverKey || !!apiKey;

  async function handleExtract() {
    if (!file) return setError('Selecione um arquivo PDF.');
    if (!hasKey) return setError('Chave da API não configurada. Configure no CoPiloto IA.');
    setError('');
    setStep('extracting');
    setProgressPct(0);

    try {
      setProgress('Carregando PDF.js...');
      const pdfjs = await loadPdfJs();

      setProgress('Lendo PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      setProgress(`PDF com ${totalPages} páginas detectado. Selecionando páginas relevantes...`);
      const { group1, group2, group3 } = selectPages(totalPages);

      setProgress(`Páginas: geral p.${group1[0]}-${group1.at(-1)} | perf p.${group2[0]}-${group2.at(-1)} | mx p.${group3[0]}-${group3.at(-1)}`);
      await new Promise(r => setTimeout(r, 1200));

      // --- GRUPO 1: dados gerais e limitações ---
      setProgress(`Renderizando páginas gerais (${group1.length} páginas)...`);
      setProgressPct(8);
      const imgs1 = [];
      for (let i = 0; i < group1.length; i++) {
        setProgress(`Renderizando página ${group1[i]}/${totalPages}...`);
        imgs1.push(await pageToBase64(pdf, group1[i], 1.4));
        setProgressPct(8 + Math.floor((i / group1.length) * 18));
      }
      setProgress('Analisando dados gerais e limitações com IA... (20-40s)');
      setProgressPct(26);
      const general = await analyzePages(imgs1, PROMPT_GENERAL, apiKey);

      // --- GRUPO 2: performance ---
      setProgress(`Renderizando páginas de performance (${group2.length} páginas, p.${group2[0]}-${group2.at(-1)})...`);
      setProgressPct(36);
      const imgs2 = [];
      for (let i = 0; i < group2.length; i++) {
        setProgress(`Renderizando página ${group2[i]}/${totalPages}...`);
        imgs2.push(await pageToBase64(pdf, group2[i], 1.5));
        setProgressPct(36 + Math.floor((i / group2.length) * 18));
      }
      setProgress('Analisando tabelas de performance com IA... (20-40s)');
      setProgressPct(54);
      const perf = await analyzePages(imgs2, PROMPT_PERFORMANCE, apiKey);

      // --- GRUPO 3: manutenção ---
      setProgress(`Renderizando páginas de manutenção (${group3.length} páginas, p.${group3[0]}-${group3.at(-1)})...`);
      setProgressPct(64);
      const imgs3 = [];
      for (let i = 0; i < group3.length; i++) {
        setProgress(`Renderizando página ${group3[i]}/${totalPages}...`);
        imgs3.push(await pageToBase64(pdf, group3[i], 1.4));
        setProgressPct(64 + Math.floor((i / group3.length) * 18));
      }
      setProgress('Analisando plano de manutenção com IA... (20-40s)');
      setProgressPct(82);
      const mxData = await analyzePages(imgs3, PROMPT_MAINTENANCE, apiKey);

      setProgressPct(92);
      setProgress('Consolidando dados...');

      // Se performance vazia, tenta as últimas páginas do documento (fallback)
      let perfFinal = perf;
      const hasPerfData = (perf?.performanceProfiles?.length || 0) + (perf?.climbProfiles?.length || 0) > 0;
      if (!hasPerfData) {
        setProgress('Performance não encontrada — tentando páginas finais do documento...');
        setProgressPct(85);
        const lastPages = [];
        const lastStart = Math.max(Math.floor(totalPages * 0.50), 1);
        for (let i = lastStart; i <= totalPages && lastPages.length < 20; i++) lastPages.push(i);
        const imgsLast = [];
        for (const pg of lastPages) imgsLast.push(await pageToBase64(pdf, pg, 1.5));
        perfFinal = await analyzePages(imgsLast, PROMPT_PERFORMANCE, apiKey);
      }

      // Combina itens de manutenção: grupo1 (limites/vida) + grupo3 (seção manutenção)
      const mxItems = [
        ...(general?.maintenanceItems || []),
        ...(mxData?.maintenanceItems || []),
      ].filter((item, idx, arr) =>
        item.name && arr.findIndex(x => x.name === item.name) === idx
      );

      // Monta resultado final
      const merged = {
        aircraft: general || {},
        performanceProfiles: perfFinal?.performanceProfiles || [],
        climbProfiles:       perfFinal?.climbProfiles || [],
        maintenanceItems:    mxItems,
      };
      // Limpa maintenanceItems do objeto aircraft
      delete merged.aircraft.maintenanceItems;

      setResult(merged);
      setEditData(merged);
      setProgressPct(100);
      setStep('review');
    } catch (e) {
      setError(`Erro: ${e.message}`);
      setStep('upload');
    }
    setProgress('');
  }

  async function handleSave() {
    if (!editData) return;
    setStep('saving');
    try {
      const ac = aircraft.find(a => a.id === selectedAc);
      const base = ac ? { ...ac } : { registration: '', type: 'single_engine' };
      const d = editData.aircraft;

      const toSave = {
        ...base,
        manufacturer:        d.manufacturer        || base.manufacturer        || '',
        model:               d.model               || base.model               || '',
        year:                d.year                || base.year,
        engineModel:         d.engineModel         || base.engineModel         || '',
        engineTboHours:      d.engineTboHours      || base.engineTboHours,
        propModel:           d.propModel           || base.propModel           || '',
        propTboHours:        d.propTboHours        || base.propTboHours,
        fuelType:            d.fuelType            || base.fuelType            || 'avgas_100ll',
        fuelCapacityLiters:  d.fuelCapacityLiters  || base.fuelCapacityLiters,
        monthlyFixed:        base.monthlyFixed      || 0,
        performanceProfiles: editData.performanceProfiles || [],
        climbProfiles:       editData.climbProfiles       || [],
      };

      const saved = await saveAircraft(toSave);
      const aircraftId = saved?.id || ac?.id;

      // Salva itens de manutenção
      if (editData.maintenanceItems?.length && aircraftId) {
        for (const item of editData.maintenanceItems) {
          if (!item.name) continue;
          await saveMaintenance({
            aircraftId,
            itemType: 'inspection',
            name: item.name,
            intervalHours: item.intervalHours || null,
            intervalDays:  item.intervalDays  || null,
            status: 'current',
            notes: item.notes || 'Extraído do POH via IA',
          });
        }
      }

      setStep('done');
      if (onComplete) onComplete();
    } catch (e) {
      setError(`Erro ao salvar: ${e.message}`);
      setStep('review');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'30px 20px' }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:820, padding:28 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--blue-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📖</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>Importar POH / AFM</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
              Envia páginas do manual como imagens para análise visual pela IA
            </div>
          </div>
          <button className="ghost" onClick={onClose} style={{ fontSize:18, padding:'4px 10px' }}>✕</button>
        </div>

        {/* Progress steps */}
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['upload','1. Upload'],['extracting','2. Analisando'],['review','3. Revisar'],['saving','4. Salvando'],['done','5. Pronto']].map(([s,l]) => {
            const idx = STEPS.indexOf(s), cur = STEPS.indexOf(step);
            return (
              <div key={s} style={{ flex:1, padding:'5px 8px', borderRadius:8, textAlign:'center', fontSize:10, fontWeight:500,
                background: s===step?'var(--blue-dim)':cur>idx?'var(--green-dim)':'var(--bg2)',
                color:      s===step?'var(--blue)':cur>idx?'var(--green)':'var(--text3)',
                border:`1px solid ${s===step?'var(--blue-mid)':cur>idx?'var(--green-mid)':'var(--border)'}`
              }}>{cur>idx?'✓ ':''}{l}</div>
            );
          })}
        </div>

        {error && (
          <div style={{ marginBottom:16, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)', display:'flex', gap:8 }}>
            <span style={{ flexShrink:0 }}>⚠</span>
            <span style={{ flex:1 }}>{error}</span>
            <button className="ghost" style={{ padding:'0 4px', fontSize:12 }} onClick={()=>setError('')}>✕</button>
          </div>
        )}

        {/* ── UPLOAD ─────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <div style={{ marginBottom:16 }}>
              <label>Aeronave de destino</label>
              <select value={selectedAc} onChange={e=>setSelectedAc(e.target.value)}>
                <option value="new">— Criar nova aeronave —</option>
                {aircraft.map(a => <option key={a.id} value={a.id}>{a.registration} — {a.manufacturer} {a.model}</option>)}
              </select>
            </div>

            <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }}
              onChange={e => setFile(e.target.files[0] || null)} />

            <div onClick={()=>fileRef.current?.click()}
              style={{ border:'2px dashed var(--border2)', borderRadius:12, padding:'40px 20px', textAlign:'center', cursor:'pointer', background:'var(--bg2)' }}
              onDragOver={e=>{e.preventDefault(); e.currentTarget.style.borderColor='var(--blue)';}}
              onDragLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';}}
              onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files[0]; if(f?.type==='application/pdf') setFile(f); e.currentTarget.style.borderColor='var(--border2)';}}>
              <div style={{ fontSize:36, marginBottom:10 }}>📄</div>
              <div style={{ fontWeight:500, color:'var(--text1)', marginBottom:6 }}>
                {file ? file.name : 'Clique ou arraste o POH completo aqui'}
              </div>
              {file
                ? <div style={{ fontSize:12, color:'var(--green)', fontFamily:'var(--font-mono)' }}>{(file.size/1024/1024).toFixed(1)} MB</div>
                : <div style={{ fontSize:11, color:'var(--text3)' }}>PDF completo — qualquer tamanho — o sistema seleciona as páginas relevantes automaticamente</div>
              }
            </div>

            <div style={{ marginTop:12, padding:'10px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:11, color:'var(--blue)', lineHeight:1.7 }}>
              <strong>Como funciona:</strong> O sistema renderiza as páginas-chave do manual como imagens e envia para análise visual pela IA. Extrai automaticamente:<br/>
              ✈ Dados da aeronave e motor &nbsp;·&nbsp; ⚡ Velocidades (Vne, Vy, Va...) &nbsp;·&nbsp; 📊 Tabelas de performance &nbsp;·&nbsp; 🔧 Plano de manutenção
            </div>

            {serverKey === false && !apiKey && (
              <div style={{ marginTop:12, padding:'8px 14px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:11, color:'var(--amber)' }}>
                ⚠ Chave da API não configurada. Clique em CoPiloto IA → 🔑 para configurar.
              </div>
            )}
            {serverKey && (
              <div style={{ marginTop:12, padding:'6px 12px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:8, fontSize:11, color:'var(--green)' }}>
                ✓ API configurada no servidor — pronto
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="primary" onClick={handleExtract} disabled={!file || !hasKey} style={{ flex:1, padding:'12px', fontSize:14 }}>
                ✦ Analisar POH com IA
              </button>
              <button onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}

        {/* ── EXTRACTING ─────────────────────────────────────────────────── */}
        {step === 'extracting' && (
          <div style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🧠</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:20, marginBottom:12 }}>Analisando o manual...</div>
            <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.8, minHeight:40 }}>{progress}</div>
            <div style={{ marginTop:20, height:6, background:'var(--bg3)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'var(--blue)', borderRadius:4, width:`${progressPct}%`, transition:'width .4s ease' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--blue)', marginTop:8, fontFamily:'var(--font-mono)' }}>{progressPct}%</div>
          </div>
        )}

        {/* ── REVIEW ─────────────────────────────────────────────────────── */}
        {step === 'review' && editData && (
          <div>
            {/* Dados da aeronave */}
            <div className="card" style={{ padding:'16px 20px', marginBottom:16, borderLeft:'3px solid var(--blue)' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--blue)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
                ✈ Aeronave
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  ['Fabricante', 'manufacturer'], ['Modelo', 'model'],
                  ['Motor', 'engineModel'],        ['TBO Motor', 'engineTboHours'],
                  ['Hélice', 'propModel'],          ['TBO Hélice', 'propTboHours'],
                  ['Combustível (L)', 'fuelCapacityLiters'], ['Utilizável (L)', 'fuelUsableLiters'],
                  ['Vne (KIAS)', 'vne'],             ['Vy (KIAS)', 'vy'],
                  ['Va (KIAS)', 'va'],               ['Vno (KIAS)', 'vno'],
                  ['Cruzeiro máx (kt)', 'maxCruiseKtas'], ['Teto (ft)', 'serviceCeilingFt'],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:3 }}>{label}</label>
                    <input value={editData.aircraft?.[key] ?? ''} onChange={e => setEditData(d => ({ ...d, aircraft: { ...d.aircraft, [key]: e.target.value } }))}
                      style={{ fontSize:12, padding:'6px 10px', fontFamily: key.startsWith('V')||key.includes('Hours')||key.includes('Ft')||key.includes('Ktas')||key.includes('Liters') ? 'var(--font-mono)' : 'inherit' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Performance */}
            {editData.performanceProfiles?.length > 0 && (
              <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                  📊 Tabela de cruzeiro ({editData.performanceProfiles.length} pontos)
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr style={{ background:'var(--bg2)' }}>
                      {['Alt (ft)','Pot (%)','KTAS','L/h',''].map(h => <th key={h} style={{ padding:'6px 10px', textAlign:'left', color:'var(--text3)', fontSize:10, fontWeight:600, textTransform:'uppercase', borderBottom:'1px solid var(--border)' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {editData.performanceProfiles.map((p, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                          {['altFt','power','ktas','fuelLph'].map(k => (
                            <td key={k} style={{ padding:'3px 6px' }}>
                              <input type="number" step="any" value={p[k]??''} onChange={e => {
                                const pp = editData.performanceProfiles.map((r,j)=>j===i?{...r,[k]:parseFloat(e.target.value)||0}:r);
                                setEditData(d=>({...d,performanceProfiles:pp}));
                              }} style={{ padding:'4px 8px', fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, width:75, fontFamily:'var(--font-mono)' }} />
                            </td>
                          ))}
                          <td style={{ padding:'3px 6px' }}><button className="danger" style={{ fontSize:10, padding:'3px 7px' }} onClick={()=>setEditData(d=>({...d,performanceProfiles:d.performanceProfiles.filter((_,j)=>j!==i)}))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Manutenção */}
            {editData.maintenanceItems?.length > 0 && (
              <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                  🔧 Plano de manutenção ({editData.maintenanceItems.length} itens)
                </div>
                {editData.maintenanceItems.map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                    <div style={{ flex:1 }}>{item.name}</div>
                    {item.intervalHours && <span style={{ color:'var(--amber)', fontFamily:'var(--font-mono)', fontSize:11 }}>a cada {item.intervalHours}h</span>}
                    {item.intervalDays && <span style={{ color:'var(--blue)', fontFamily:'var(--font-mono)', fontSize:11 }}>a cada {item.intervalDays} dias</span>}
                    <button className="ghost" style={{ fontSize:10, padding:'2px 6px', color:'var(--text3)' }}
                      onClick={()=>setEditData(d=>({...d,maintenanceItems:d.maintenanceItems.filter((_,j)=>j!==i)}))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {(!editData.performanceProfiles?.length && !editData.maintenanceItems?.length) && (
              <div style={{ padding:'12px 16px', background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', borderRadius:8, fontSize:12, color:'var(--amber)', marginBottom:16 }}>
                ⚠ A IA não encontrou tabelas de performance ou manutenção nestas páginas. Verifique os dados da aeronave acima e salve — você pode adicionar performance manualmente depois.
              </div>
            )}

            <div style={{ padding:'10px 14px', background:'var(--bg2)', borderRadius:8, fontSize:11, color:'var(--text3)', marginBottom:16 }}>
              Revise e edite os dados acima antes de salvar. Todos os campos são editáveis.
            </div>

            <div style={{ position:'sticky', bottom:0, background:'var(--bg1)', padding:'12px 0', borderTop:'1px solid var(--bg2)', display:'flex', gap:10 }}>
              <button className="primary" onClick={handleSave} style={{ flex:1, padding:'12px' }}>✓ Criar aeronave com estes dados</button>
              <button onClick={()=>setStep('upload')}>← Reenviar</button>
              <button onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}

        {/* ── SAVING ─────────────────────────────────────────────────────── */}
        {step === 'saving' && (
          <div style={{ padding:'60px 20px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>💾</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>Salvando dados...</div>
          </div>
        )}

        {/* ── DONE ───────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--green)', marginBottom:12 }}>
              POH importado com sucesso!
            </div>
            <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.8, marginBottom:8 }}>
              {result?.performanceProfiles?.length > 0 && `📊 ${result.performanceProfiles.length} pontos de performance`}<br/>
              {result?.maintenanceItems?.length > 0 && `🔧 ${result.maintenanceItems.length} itens de manutenção criados`}<br/>
              ✈ Aeronave criada/atualizada com dados do POH
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:24 }}>
              O Cost Index agora usa os dados reais do POH. Acesse a aeronave para complementar o plano de manutenção.
            </div>
            <button className="primary" onClick={onClose} style={{ padding:'10px 32px' }}>Ir para a aeronave</button>
          </div>
        )}
      </div>
    </div>
  );
}
