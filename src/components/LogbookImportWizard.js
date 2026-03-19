// LogbookImportWizard.js — v5.40
import React, { useState, useCallback } from 'react';
import { supabase } from '../supabase';

const toBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = () => rej(new Error('Leitura falhou')); r.readAsDataURL(file); });

const SYSTEM_PROMPT = `Você é um especialista em aviação brasileira. Analise a imagem de um diário de bordo e extraia TODOS os registros de voo visíveis.

Para cada voo retorne um objeto JSON com EXATAMENTE estes campos:
- date: string "YYYY-MM-DD" (converta datas PT-BR)
- origin: string ICAO ou nome do aeródromo (ex: "SBMT", "SBJD")
- destination: string ICAO ou nome
- departure_time: string "HH:MM" ou null
- arrival_time: string "HH:MM" ou null
- flight_time_minutes: número inteiro de minutos. Calcule a partir de decolagem/pouso se disponível.
- total_flight_hours: número decimal das horas acumuladas (hodômetro) APÓS este voo, ou null
- pilot: string nome do piloto em comando, ou null
- copilot: string nome do copiloto/instrutor, ou null
- flight_rules: "VFR" ou "IFR" ou null
- remarks: string observações relevantes, ou null
- confidence: número 0-1 indicando confiança na extração desta linha

Retorne APENAS um JSON válido assim:
{"flights": [...]}

Sem markdown, sem texto fora do JSON. Se não houver voos visíveis, retorne {"flights": []}.`;

async function analyzeImage(base64, mediaType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }, { type: 'text', text: 'Extraia todos os voos desta página do diário de bordo.' }] }] })
  });
  const data = await response.json();
  const text = data.content?.map(b => b.text || '').join('') || '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  return parsed.flights || [];
}

function ConfidenceBadge({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return <span style={{ background:color+'22', color, border:`1px solid ${color}55`, borderRadius:4, fontSize:11, padding:'1px 6px', fontWeight:700 }}>{pct}%</span>;
}

export default function LogbookImportWizard({ aircraft=[], onClose, onImported }) {
  const [selectedAircraftId, setSelectedAircraftId] = useState(aircraft.length===1 ? aircraft[0].id : '');
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [flights, setFlights] = useState([]);
  const [duplicates, setDuplicates] = useState(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState({});
  const [progress, setProgress] = useState({ current:0, total:0, label:'' });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer?.files || e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (!dropped.length) return;
    setFiles(prev => [...prev, ...dropped]);
    dropped.forEach(f => setPreviews(prev => [...prev, URL.createObjectURL(f)]));
  }, []);

  const removeFile = (i) => { setFiles(prev => prev.filter((_,idx)=>idx!==i)); setPreviews(prev => prev.filter((_,idx)=>idx!==i)); };

  const checkDuplicates = async (extracted, aircraftId) => {
    const dupeSet = new Set();
    try {
      const { data: existing } = await supabase.from('flights').select('date, departure_icao, destination_icao').eq('aircraft_id', aircraftId);
      if (existing) extracted.forEach((f,i) => { if (existing.some(e => e.date===f.date && (e.departure_icao||'').toLowerCase()===(f.origin||'').toLowerCase() && (e.destination_icao||'').toLowerCase()===(f.destination||'').toLowerCase())) dupeSet.add(i); });
    } catch(_) {}
    return dupeSet;
  };

  const processImages = async () => {
    if (!selectedAircraftId) { setError('Selecione uma aeronave antes de continuar.'); return; }
    setStep('processing'); setError(null);
    const all = [];
    for (let i=0; i<files.length; i++) {
      setProgress({ current:i+1, total:files.length, label:`Analisando imagem ${i+1} de ${files.length}…` });
      try { all.push(...await analyzeImage(await toBase64(files[i]), files[i].type)); } catch(err) { console.error(err); }
    }
    const seen = new Set();
    const unique = all.filter(f => { const k=`${f.date}|${f.origin}|${f.destination}`; if(seen.has(k))return false; seen.add(k); return true; }).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    setFlights(unique);
    const dupeSet = await checkDuplicates(unique, selectedAircraftId);
    setDuplicates(dupeSet);
    const skipMap = {}; dupeSet.forEach(i=>{skipMap[i]=true;}); setSkipDuplicates(skipMap);
    setStep('review');
  };

  const handleImport = async () => {
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const toInsert = flights.filter((_,i)=>!skipDuplicates[i]).map(f=>({
      aircraft_id: selectedAircraftId, user_id: user?.id, date: f.date,
      departure_icao: f.origin||null, destination_icao: f.destination||null,
      takeoff_utc: f.departure_time||null, landing_utc: f.arrival_time||null,
      flight_time_minutes: f.flight_time_minutes||null,
      pilot_name: f.pilot||null, copilot_name: f.copilot||null,
      flight_conditions: (f.flight_rules||'vfr').toLowerCase(),
      remarks: f.remarks||null, imported_from: 'logbook_photo',
    }));
    try {
      const { error: err } = await supabase.from('flights').insert(toInsert);
      if (err) throw err;
      const maxHours = flights.filter((_,i)=>!skipDuplicates[i]).reduce((max,f)=>Math.max(max,f.total_flight_hours||0),0);
      if (maxHours > 0) {
        const { data: ac } = await supabase.from('aircraft').select('total_flight_hours').eq('id', selectedAircraftId).single();
        if (ac && (ac.total_flight_hours||0) < maxHours) await supabase.from('aircraft').update({ total_flight_hours: maxHours }).eq('id', selectedAircraftId);
      }
      setResult({ imported: toInsert.length, skipped: flights.length-toInsert.length });
      setStep('done'); if (onImported) onImported(toInsert.length);
    } catch(err) { setError('Erro ao importar: '+err.message); }
    setImporting(false);
  };

  const S = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
    modal: { background:'#0f172a', border:'1px solid #1e293b', borderRadius:16, width:'100%', maxWidth:860, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,0.6)' },
    body: { flex:1, overflowY:'auto', padding:24 },
    footer: { padding:'16px 24px', borderTop:'1px solid #1e293b', display:'flex', justifyContent:'flex-end', gap:10 },
    btn: (v='primary') => ({ padding:'9px 20px', borderRadius:8, fontWeight:600, fontSize:14, cursor:'pointer', border:'none', transition:'all .15s', ...(v==='primary'?{background:'#3b82f6',color:'#fff'}:v==='secondary'?{background:'#1e293b',color:'#94a3b8',border:'1px solid #334155'}:v==='success'?{background:'#22c55e',color:'#fff'}:{background:'#ef4444',color:'#fff'}) }),
    th: { textAlign:'left', padding:'8px 10px', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #1e293b' },
    td: { padding:'9px 10px', borderBottom:'1px solid #0f172a55', color:'#cbd5e1', verticalAlign:'middle' },
  };

  const acSelector = (
    <div style={{ marginBottom:16 }}>
      <label style={{ color:'#94a3b8', fontSize:13, fontWeight:600, display:'block', marginBottom:6 }}>Aeronave *</label>
      <select value={selectedAircraftId} onChange={e=>setSelectedAircraftId(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:8, background:'#1e293b', border:'1px solid #334155', color:'#f1f5f9', fontSize:14 }}>
        <option value="">Selecione a aeronave...</option>
        {aircraft.map(a=><option key={a.id} value={a.id}>{a.registration} — {a.model}</option>)}
      </select>
    </div>
  );

  if (step==='upload') return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><p style={{ color:'#f1f5f9', fontWeight:700, fontSize:18, margin:0 }}>📖 Importar do Diário de Bordo</p><p style={{ color:'#64748b', fontSize:13, marginTop:2 }}>Tire fotos das páginas e a IA extrai os voos automaticamente</p></div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>
        <div style={S.body}>
          {acSelector}
          <div style={{ border:'2px dashed #334155', borderRadius:12, padding:'36px 24px', textAlign:'center', cursor:'pointer' }} onDragOver={e=>e.preventDefault()} onDrop={onDrop} onClick={()=>document.getElementById('lb-file-input').click()}>
            <div style={{ fontSize:40, marginBottom:10 }}>📷</div>
            <p style={{ color:'#94a3b8', fontWeight:600, margin:0 }}>Arraste fotos aqui ou clique para selecionar</p>
            <p style={{ color:'#475569', fontSize:12, marginTop:6 }}>JPG, PNG, HEIC • Uma ou várias páginas</p>
            <input id="lb-file-input" type="file" accept="image/*" multiple style={{ display:'none' }} onChange={onDrop} />
          </div>
          {previews.length>0 && <><p style={{ color:'#64748b', fontSize:13, marginTop:16 }}>{files.length} imagem{files.length!==1?'ns':''} selecionada{files.length!==1?'s':''}</p><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:10, marginTop:8 }}>{previews.map((url,i)=><div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden', border:'1px solid #334155', aspectRatio:'4/3' }}><img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /><button onClick={e=>{e.stopPropagation();removeFile(i)}} style={{ position:'absolute', top:4, right:4, background:'#ef4444', border:'none', color:'#fff', borderRadius:'50%', width:20, height:20, fontSize:11, cursor:'pointer' }}>✕</button></div>)}</div></>}
          {error && <p style={{ color:'#ef4444', marginTop:12, fontSize:13 }}>⚠ {error}</p>}
        </div>
        <div style={S.footer}>
          <button style={S.btn('secondary')} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btn('primary'), opacity:(files.length&&selectedAircraftId)?1:0.4, cursor:(files.length&&selectedAircraftId)?'pointer':'not-allowed' }} disabled={!files.length||!selectedAircraftId} onClick={processImages}>🔍 Analisar {files.length>0?`${files.length} imagem${files.length!==1?'ns':''}`:'imagens'}</button>
        </div>
      </div>
    </div>
  );

  if (step==='processing') return (
    <div style={S.overlay}><div style={{ ...S.modal, maxWidth:440, alignItems:'center', padding:48, textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:20, animation:'spin 2s linear infinite' }}>🔍</div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <p style={{ color:'#f1f5f9', fontWeight:700, fontSize:18, margin:0 }}>Analisando com IA…</p>
      <p style={{ color:'#64748b', fontSize:14, marginTop:8 }}>{progress.label}</p>
      <div style={{ background:'#1e293b', borderRadius:8, height:6, overflow:'hidden', marginTop:12, width:'100%' }}><div style={{ height:'100%', background:'#3b82f6', borderRadius:8, width:`${progress.total?(progress.current/progress.total)*100:0}%`, transition:'width .4s ease' }} /></div>
    </div></div>
  );

  if (step==='review') {
    const toImport = flights.filter((_,i)=>!skipDuplicates[i]);
    const selectedAc = aircraft.find(a=>a.id===selectedAircraftId);
    return (
      <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={S.modal}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div><p style={{ color:'#f1f5f9', fontWeight:700, fontSize:18, margin:0 }}>✅ {flights.length} voo{flights.length!==1?'s':''} encontrado{flights.length!==1?'s':''} — {selectedAc?.registration}</p><p style={{ color:'#64748b', fontSize:13, marginTop:2 }}>{toImport.length} para importar{duplicates.size>0?` · ${duplicates.size} duplicado${duplicates.size!==1?'s':''} detectado${duplicates.size!==1?'s':''}`:''}</p></div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:22, cursor:'pointer' }}>✕</button>
          </div>
          <div style={S.body}>
            {flights.length===0 ? <div style={{ textAlign:'center', padding:48, color:'#64748b' }}><div style={{ fontSize:48, marginBottom:16 }}>😕</div><p style={{ fontWeight:600 }}>Nenhum voo encontrado</p><p style={{ fontSize:13 }}>Tente com fotos mais nítidas.</p></div> : (
              <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr>{['Data','Rota','Dep/Pou','Duração','H.Total','Piloto','Regra','Conf.','Ação'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{flights.map((f,i)=>{
                  const isDupe=duplicates.has(i), willSkip=skipDuplicates[i];
                  const hh=Math.floor((f.flight_time_minutes||0)/60), mm=(f.flight_time_minutes||0)%60;
                  return <tr key={i} style={{ background:isDupe?(willSkip?'#1e293b88':'#f59e0b08'):'transparent', opacity:willSkip?0.45:1 }}>
                    <td style={S.td}>{f.date||'—'}</td>
                    <td style={S.td}><span style={{ color:'#94a3b8' }}>{f.origin||'?'}</span><span style={{ color:'#475569', margin:'0 4px' }}>→</span><span style={{ color:'#94a3b8' }}>{f.destination||'?'}</span></td>
                    <td style={{ ...S.td, fontSize:12, color:'#64748b' }}>{f.departure_time||'—'} / {f.arrival_time||'—'}</td>
                    <td style={S.td}>{f.flight_time_minutes?`${hh}h${String(mm).padStart(2,'0')}`:'—'}</td>
                    <td style={{ ...S.td, color:'#64748b' }}>{f.total_flight_hours!=null?f.total_flight_hours.toFixed(1)+'h':'—'}</td>
                    <td style={{ ...S.td, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.pilot||'—'}</td>
                    <td style={S.td}><span style={{ background:f.flight_rules==='IFR'?'#6366f122':'#22c55e22', color:f.flight_rules==='IFR'?'#818cf8':'#4ade80', borderRadius:4, fontSize:11, padding:'1px 6px', fontWeight:700 }}>{f.flight_rules||'VFR'}</span></td>
                    <td style={S.td}><ConfidenceBadge value={f.confidence} /></td>
                    <td style={{ ...S.td, minWidth:80 }}>{isDupe?<button onClick={()=>setSkipDuplicates(prev=>({...prev,[i]:!prev[i]}))} style={{ ...S.btn(willSkip?'secondary':'danger'), padding:'4px 10px', fontSize:11 }}>{willSkip?'+ Incluir':'✕ Pular'}</button>:<span style={{ color:'#22c55e', fontSize:12 }}>✓ Novo</span>}</td>
                  </tr>;
                })}</tbody>
              </table></div>
            )}
            {duplicates.size>0 && <div style={{ marginTop:16, background:'#f59e0b11', border:'1px solid #f59e0b33', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#fbbf24' }}>⚠ {duplicates.size} voo{duplicates.size!==1?'s':''} já existe{duplicates.size!==1?'m':''} no banco.</div>}
            {error && <p style={{ color:'#ef4444', marginTop:12, fontSize:13 }}>⚠ {error}</p>}
          </div>
          <div style={S.footer}>
            <button style={S.btn('secondary')} onClick={()=>{setStep('upload');setFlights([]);setDuplicates(new Set());}}>← Voltar</button>
            <button style={{ ...S.btn('success'), opacity:(toImport.length>0&&!importing)?1:0.4, cursor:(toImport.length>0&&!importing)?'pointer':'not-allowed' }} disabled={!toImport.length||importing} onClick={handleImport}>{importing?'⏳ Importando…':`✈ Importar ${toImport.length} voo${toImport.length!==1?'s':''}`}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.overlay}><div style={{ ...S.modal, maxWidth:420, alignItems:'center', padding:48, textAlign:'center' }}>
      <div style={{ fontSize:56, marginBottom:20 }}>🎉</div>
      <p style={{ color:'#f1f5f9', fontWeight:700, fontSize:22, margin:0 }}>Importação concluída!</p>
      <p style={{ color:'#64748b', fontSize:15, marginTop:10 }}><span style={{ color:'#22c55e', fontWeight:700 }}>{result?.imported}</span> voo{result?.imported!==1?'s':''} importado{result?.imported!==1?'s':''}.{result?.skipped>0&&<><br/><span style={{ color:'#f59e0b' }}>{result.skipped}</span> duplicado{result.skipped!==1?'s':''} ignorado{result.skipped!==1?'s':''}.</>}<br/><span style={{ color:'#64748b', fontSize:12 }}>Hodômetro atualizado.</span></p>
      <button style={{ ...S.btn('primary'), marginTop:28, padding:'12px 36px', fontSize:15 }} onClick={onClose}>Fechar</button>
    </div></div>
  );
}