import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { getUser, saveCost } from '../store';

// ── Constantes ────────────────────────────────────────────────
const DOC_TYPES = [
  { value:'cva',               label:'CVA',                       category:'mandatory'   },
  { value:'matricula',         label:'Matrícula ANAC',             category:'mandatory'   },
  { value:'radio_license',     label:'Licença de Rádio (ANATEL)',  category:'mandatory'   },
  { value:'seguro',            label:'Seguro Aeronáutico',         category:'insurance'   },
  { value:'manual_voo',        label:'Manual de Voo / POH',        category:'mandatory'   },
  { value:'manual_manutencao', label:'Manual de Manutenção',       category:'mandatory'   },
  { value:'registro_anac',     label:'Registro ANAC',              category:'mandatory'   },
  { value:'despacho_aeronaveg',label:'Despacho Aeronavegabilidade', category:'mandatory'  },
  { value:'transponder_cert',  label:'Certificação Transponder',   category:'mandatory'   },
  { value:'certificado_ruido', label:'Certificado de Ruído',       category:'mandatory'   },
  { value:'other',             label:'Outro documento',            category:'other'       },
];

const COST_CATEGORIES = {
  fuel:           'Combustível',
  scheduled_mx:   'Manutenção programada',
  unscheduled_mx: 'Manutenção corretiva',
  hangar:         'Hangar',
  insurance:      'Seguro',
  airport_fees:   'Taxas aeroportuárias',
  nav_fees:       'Taxas navegação',
  other:          'Outros',
};

// Confidence colors
function confColor(conf) {
  if (conf === 'high')   return 'var(--green)';
  if (conf === 'medium') return 'var(--amber)';
  return 'var(--red)';
}
function confBg(conf) {
  if (conf === 'high')   return 'var(--green-dim)';
  if (conf === 'medium') return 'var(--amber-dim)';
  return 'var(--red-dim)';
}
function confLabel(conf) {
  if (conf === 'high')   return '● Alta';
  if (conf === 'medium') return '◐ Revisar';
  return '○ Baixa';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtBRL(v) {
  if (!v) return '—';
  return parseFloat(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

// ── AI Analysis ───────────────────────────────────────────────
async function analyzeFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);

  const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');

  const content = [];
  if (isPdf) {
    content.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } });
  } else if (isImage) {
    content.push({ type:'image', source:{ type:'base64', media_type: file.type || 'image/jpeg', data:b64 } });
  } else {
    return { dest:'unknown', confidence:'low', reason:'Formato não suportado' };
  }

  content.push({ type:'text', text:`Analyze this aviation document and classify it precisely.
Return ONLY valid JSON, no text outside:
{
  "dest": "document|cost|log_book|poh|unknown",
  "doc_type": "cva|matricula|radio_license|seguro|manual_voo|manual_manutencao|registro_anac|despacho_aeronaveg|transponder_cert|certificado_ruido|other",
  "category": "mandatory|operational|maintenance|insurance|other",
  "title": "",
  "doc_number": "",
  "issuing_authority": "",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "is_lifetime": false,
  "version": "",
  "aircraft_registration": "",
  "cost_category": "fuel|scheduled_mx|unscheduled_mx|hangar|insurance|airport_fees|nav_fees|other",
  "cost_amount": null,
  "cost_date": "YYYY-MM-DD or null",
  "cost_vendor": "",
  "cost_description": "",
  "fuel_liters": null,
  "fuel_price_per_liter": null,
  "airport_icao": "",
  "invoice_number": "",
  "confidence": "high|medium|low",
  "reason": ""
}

dest classification rules:
- "document" = official aviation certificate, license, registration, insurance policy, contract
- "cost" = invoice, receipt, nota fiscal, payment receipt for services/fuel/maintenance
- "log_book" = pilot logbook or aircraft logbook pages
- "poh" = Pilot Operating Handbook, AFM, Flight Manual (100+ pages)
- "unknown" = cannot determine

For "cost" dest: fill cost_* fields with invoice details
For "document" dest: fill doc_type, title, dates, doc_number
confidence: "high" if clearly readable official document, "medium" if partial/unclear, "low" if unrecognizable` });

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role:'user', content }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const m = clean.match(/\{[\s\S]+\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return { dest:'unknown', confidence:'low', reason:'IA não retornou JSON válido' };
}

// ── Save helpers ──────────────────────────────────────────────
async function saveDocumentEntry(item, aircraftId) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const ai = item.ai;
  const row = {
    user_id:           user.id,
    aircraft_id:       aircraftId,
    doc_type:          item.overrides?.doc_type          || ai.doc_type       || 'other',
    category:          item.overrides?.category          || ai.category       || 'other',
    title:             item.overrides?.title             || ai.title          || item.file.name,
    doc_number:        item.overrides?.doc_number        || ai.doc_number     || null,
    issuing_authority: item.overrides?.issuing_authority || ai.issuing_authority || null,
    issue_date:        item.overrides?.issue_date        || ai.issue_date     || null,
    expiry_date:       item.overrides?.expiry_date       || ai.expiry_date    || null,
    is_lifetime:       item.overrides?.is_lifetime       ?? ai.is_lifetime    ?? false,
    version:           item.overrides?.version           || ai.version        || null,
    ai_extracted:      true,
    ai_raw:            ai,
    is_current:        true,
    file_name:         item.file.name,
    file_type:         item.file.name.split('.').pop().toLowerCase(),
    file_size_kb:      Math.round(item.file.size / 1024),
    notes:             item.overrides?.notes             || null,
  };
  const { data, error } = await supabase.from('aircraft_documents').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function saveCostEntry(item, aircraftId) {
  const ai = item.ai;
  return saveCost({
    aircraftId,
    category:      item.overrides?.cost_category  || ai.cost_category  || 'other',
    costType:      'variable',
    amountBrl:     parseFloat(item.overrides?.cost_amount || ai.cost_amount || 0),
    description:   item.overrides?.cost_description || ai.cost_description || item.file.name,
    referenceDate: item.overrides?.cost_date       || ai.cost_date      || new Date().toISOString().slice(0,10),
    vendor:        item.overrides?.cost_vendor     || ai.cost_vendor    || '',
    invoiceNumber: ai.invoice_number || null,
  });
}

// ── DEST ICON & LABEL ─────────────────────────────────────────
function destInfo(dest) {
  const map = {
    document: { icon:'📄', label:'Documento oficial',    color:'var(--blue)'   },
    cost:     { icon:'🧾', label:'Custo / Nota fiscal',  color:'var(--amber)'  },
    log_book: { icon:'📓', label:'Log Book',              color:'var(--purple)' },
    poh:      { icon:'📚', label:'Manual / POH',          color:'var(--green)'  },
    unknown:  { icon:'❓', label:'Não identificado',      color:'var(--text3)'  },
  };
  return map[dest] || map.unknown;
}

// ── Item Card ─────────────────────────────────────────────────
function ItemCard({ item, idx, onEdit, onRemove, onToggle }) {
  const [expanded, setExpanded] = useState(item.ai?.confidence !== 'high');
  const ai = item.ai || {};
  const dest = destInfo(ai.dest);
  const ov = item.overrides || {};

  const title       = ov.title             || ai.title          || item.file.name;
  const expiryDate  = ov.expiry_date       || ai.expiry_date;
  const docNumber   = ov.doc_number        || ai.doc_number;
  const authority   = ov.issuing_authority || ai.issuing_authority;
  const costAmount  = ov.cost_amount       || ai.cost_amount;
  const costVendor  = ov.cost_vendor       || ai.cost_vendor;
  const costDesc    = ov.cost_description  || ai.cost_description;
  const fuelL       = ai.fuel_liters;
  const fuelP       = ai.fuel_price_per_liter;

  return (
    <div style={{
      borderRadius:12,
      border:`1.5px solid ${item.included ? (item.ai?.confidence==='high' ? 'var(--green-mid)' : item.ai?.confidence==='medium' ? 'var(--amber-mid)' : 'var(--red-mid)') : 'var(--border)'}`,
      background: item.included ? 'var(--bg1)' : 'var(--bg2)',
      opacity: item.included ? 1 : 0.55,
      overflow:'hidden',
      transition:'all .15s',
    }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
        {/* Checkbox */}
        <input type="checkbox" checked={item.included} onChange={() => onToggle(idx)}
          style={{ width:16, height:16, cursor:'pointer', flexShrink:0 }} />

        <span style={{ fontSize:22, flexShrink:0 }}>{item.analyzing ? '⏳' : dest.icon}</span>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {item.analyzing ? 'Analisando...' : title}
          </div>
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:2, display:'flex', gap:8 }}>
            <span>{item.file.name}</span>
            <span>·</span>
            <span>{(item.file.size/1024).toFixed(0)} KB</span>
            {!item.analyzing && (
              <>
                <span>·</span>
                <span style={{ color:dest.color, fontWeight:500 }}>{dest.label}</span>
              </>
            )}
          </div>
        </div>

        {/* Confidence badge */}
        {!item.analyzing && item.ai && (
          <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:12, background:confBg(ai.confidence), color:confColor(ai.confidence), flexShrink:0 }}>
            {confLabel(ai.confidence)}
          </span>
        )}

        {/* Expand / edit */}
        {!item.analyzing && (
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            <button onClick={() => setExpanded(e=>!e)}
              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text3)', fontSize:11, cursor:'pointer' }}>
              {expanded ? '▲' : '▼'}
            </button>
            <button onClick={() => onEdit(idx)}
              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--blue)', fontSize:11, cursor:'pointer' }}>
              ✏️
            </button>
            <button onClick={() => onRemove(idx)}
              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--red)', fontSize:11, cursor:'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Details */}
      {expanded && !item.analyzing && ai && (
        <div style={{ borderTop:'1px solid var(--border)', padding:'10px 16px', background:'var(--bg2)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:11 }}>
          {ai.dest === 'document' || ai.dest === 'log_book' || ai.dest === 'poh' ? <>
            {docNumber   && <div><span style={{color:'var(--text3)'}}>Nº:</span> <span style={{fontFamily:'var(--font-mono)'}}>{docNumber}</span></div>}
            {authority   && <div><span style={{color:'var(--text3)'}}>Emissor:</span> {authority}</div>}
            {ai.issue_date && <div><span style={{color:'var(--text3)'}}>Emitido:</span> {fmtDate(ai.issue_date)}</div>}
            {expiryDate  && <div><span style={{color:'var(--text3)'}}>Validade:</span> <strong style={{color: daysUntil(expiryDate) < 60 ? 'var(--amber)' : 'var(--green)'}}>{fmtDate(expiryDate)}</strong></div>}
            {ai.is_lifetime && <div style={{gridColumn:'span 2', color:'var(--green)'}}>✓ Documento permanente</div>}
            {ai.aircraft_registration && <div><span style={{color:'var(--text3)'}}>Aeronave:</span> <strong style={{fontFamily:'var(--font-mono)'}}>{ai.aircraft_registration}</strong></div>}
            {ai.version  && <div><span style={{color:'var(--text3)'}}>Versão:</span> {ai.version}</div>}
          </> : ai.dest === 'cost' ? <>
            {costAmount  && <div><span style={{color:'var(--text3)'}}>Valor:</span> <strong style={{fontFamily:'var(--font-mono)', color:'var(--blue)'}}>{fmtBRL(costAmount)}</strong></div>}
            {ai.cost_date && <div><span style={{color:'var(--text3)'}}>Data:</span> {fmtDate(ai.cost_date)}</div>}
            {costVendor  && <div><span style={{color:'var(--text3)'}}>Fornecedor:</span> {costVendor}</div>}
            {costDesc    && <div style={{gridColumn:'span 2'}}><span style={{color:'var(--text3)'}}>Descrição:</span> {costDesc}</div>}
            {fuelL       && <div><span style={{color:'var(--text3)'}}>Combustível:</span> {fuelL}L @ R${parseFloat(fuelP||0).toFixed(2)}/L</div>}
            {ai.airport_icao && <div><span style={{color:'var(--text3)'}}>Aeroporto:</span> <strong style={{fontFamily:'var(--font-mono)'}}>{ai.airport_icao}</strong></div>}
            {ai.invoice_number && <div><span style={{color:'var(--text3)'}}>NF:</span> <span style={{fontFamily:'var(--font-mono)'}}>nº {ai.invoice_number}</span></div>}
          </> : null}
          {ai.reason && ai.confidence !== 'high' && (
            <div style={{gridColumn:'span 2', color:'var(--amber)', fontStyle:'italic'}}>⚠ {ai.reason}</div>
          )}
        </div>
      )}
    </div>
  );
}

function daysUntil(d) {
  if (!d) return 999;
  return Math.floor((new Date(d) - new Date()) / 86400000);
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ item, onClose, onSave }) {
  const ai = item.ai || {};
  const [form, setForm] = useState({
    dest:              ai.dest              || 'document',
    doc_type:          ai.doc_type          || 'other',
    title:             ai.title             || item.file.name,
    doc_number:        ai.doc_number        || '',
    issuing_authority: ai.issuing_authority || '',
    issue_date:        ai.issue_date        || '',
    expiry_date:       ai.expiry_date       || '',
    is_lifetime:       ai.is_lifetime       || false,
    version:           ai.version           || '',
    cost_category:     ai.cost_category     || 'other',
    cost_amount:       ai.cost_amount       || '',
    cost_date:         ai.cost_date         || '',
    cost_vendor:       ai.cost_vendor       || '',
    cost_description:  ai.cost_description  || '',
    notes:             '',
    ...item.overrides,
  });

  function set(k,v) { setForm(f=>({...f,[k]:v})); }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
      <div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:16,maxWidth:560,width:'100%',padding:26}}>
        <div style={{fontFamily:'var(--font-serif)',fontSize:17,marginBottom:4}}>Editar classificação</div>
        <div style={{fontSize:11,color:'var(--text3)',marginBottom:18}}>{item.file.name}</div>

        <div style={{marginBottom:12}}>
          <label>Tipo de arquivo</label>
          <select value={form.dest} onChange={e=>set('dest',e.target.value)}>
            <option value="document">📄 Documento oficial</option>
            <option value="cost">🧾 Custo / Nota fiscal</option>
            <option value="log_book">📓 Log Book</option>
            <option value="poh">📚 Manual / POH</option>
            <option value="unknown">❓ Ignorar</option>
          </select>
        </div>

        {(form.dest === 'document' || form.dest === 'log_book' || form.dest === 'poh') && <>
          <div style={{marginBottom:10}}>
            <label>Título</label>
            <input value={form.title} onChange={e=>set('title',e.target.value)} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label>Tipo de documento</label>
              <select value={form.doc_type} onChange={e=>set('doc_type',e.target.value)}>
                {DOC_TYPES.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label>Número</label>
              <input value={form.doc_number} onChange={e=>set('doc_number',e.target.value)} style={{fontFamily:'var(--font-mono)'}} />
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label>Data emissão</label>
              <input type="date" value={form.issue_date} onChange={e=>set('issue_date',e.target.value)} />
            </div>
            <div>
              <label>Data validade</label>
              <input type="date" value={form.expiry_date} onChange={e=>set('expiry_date',e.target.value)} disabled={form.is_lifetime} />
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <input type="checkbox" id="lifetime" checked={form.is_lifetime} onChange={e=>set('is_lifetime',e.target.checked)} />
            <label htmlFor="lifetime" style={{fontSize:12,cursor:'pointer',marginBottom:0}}>Documento permanente (sem validade)</label>
          </div>
          <div style={{marginBottom:10}}>
            <label>Órgão emissor</label>
            <input value={form.issuing_authority} onChange={e=>set('issuing_authority',e.target.value)} />
          </div>
        </>}

        {form.dest === 'cost' && <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label>Categoria</label>
              <select value={form.cost_category} onChange={e=>set('cost_category',e.target.value)}>
                {Object.entries(COST_CATEGORIES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label>Valor (R$)</label>
              <input type="number" step="0.01" value={form.cost_amount} onChange={e=>set('cost_amount',e.target.value)} style={{fontFamily:'var(--font-mono)'}} />
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label>Data</label>
              <input type="date" value={form.cost_date} onChange={e=>set('cost_date',e.target.value)} />
            </div>
            <div>
              <label>Fornecedor</label>
              <input value={form.cost_vendor} onChange={e=>set('cost_vendor',e.target.value)} />
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label>Descrição</label>
            <input value={form.cost_description} onChange={e=>set('cost_description',e.target.value)} />
          </div>
        </>}

        <div style={{marginBottom:16}}>
          <label>Observações</label>
          <input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Observações adicionais..." />
        </div>

        <div style={{display:'flex',gap:10}}>
          <button className="primary" onClick={() => onSave(form)} style={{flex:1}}>✓ Salvar edições</button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function DocumentImportWizard({ aircraft, onClose, onComplete }) {
  const [items,     setItems]    = useState([]);
  const [step,      setStep]     = useState('upload'); // upload | review | saving | done
  const [dragging,  setDragging] = useState(false);
  const [editIdx,   setEditIdx]  = useState(null);
  const [progress,  setProgress] = useState({ done:0, total:0 });
  const [saveLog,   setSaveLog]  = useState([]);
  const [error,     setError]    = useState('');
  const fileRef = useRef();

  const addFiles = useCallback(async (files) => {
    const fileArr = Array.from(files).filter(f =>
      f.type.startsWith('image/') ||
      f.type === 'application/pdf' ||
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (!fileArr.length) return;

    setStep('review');
    const newItems = fileArr.map(file => ({
      id:        Math.random().toString(36).slice(2),
      file,
      ai:        null,
      analyzing: true,
      included:  true,
      overrides: {},
    }));

    setItems(prev => [...prev, ...newItems]);

    // Analyze all in parallel
    await Promise.all(newItems.map(async (item) => {
      try {
        const ai = await analyzeFile(item.file);
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, ai, analyzing:false, included: ai.dest !== 'unknown' }
            : i
        ));
      } catch(e) {
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, ai:{ dest:'unknown', confidence:'low', reason: e.message }, analyzing:false }
            : i
        ));
      }
    }));
  }, []);

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function handleRemove(idx) {
    setItems(prev => prev.filter((_,i) => i !== idx));
  }

  function handleToggle(idx) {
    setItems(prev => prev.map((item,i) => i===idx ? {...item, included:!item.included} : item));
  }

  function handleEditSave(form) {
    setItems(prev => prev.map((item,i) =>
      i === editIdx ? { ...item, overrides: form, ai: { ...item.ai, dest: form.dest } } : item
    ));
    setEditIdx(null);
  }

  const included   = items.filter(i => i.included && !i.analyzing);
  const analyzing  = items.some(i => i.analyzing);
  const needReview = included.filter(i => i.ai?.confidence !== 'high').length;
  const docs       = included.filter(i => ['document','log_book','poh'].includes(i.ai?.dest));
  const costs      = included.filter(i => i.ai?.dest === 'cost');

  async function handleSaveAll() {
    setStep('saving');
    setProgress({ done:0, total:included.length });
    const log = [];
    let done = 0;

    for (const item of included) {
      try {
        const dest = item.ai?.dest;
        if (dest === 'document' || dest === 'log_book' || dest === 'poh') {
          await saveDocumentEntry(item, aircraft.id);
          log.push({ ok:true, name: item.file.name, msg:'Salvo em Documentos' });
        } else if (dest === 'cost') {
          await saveCostEntry(item, aircraft.id);
          log.push({ ok:true, name: item.file.name, msg:'Salvo em Custos' });
        } else {
          log.push({ ok:false, name: item.file.name, msg:'Tipo desconhecido — ignorado' });
        }
      } catch(e) {
        log.push({ ok:false, name: item.file.name, msg:`Erro: ${e.message}` });
      }
      done++;
      setProgress({ done, total: included.length });
      setSaveLog([...log]);
    }

    setStep('done');
    onComplete?.();
  }

  // ── UPLOAD STEP ───────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:18,maxWidth:600,width:'100%',padding:32}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:22}}>
          <div style={{width:44,height:44,borderRadius:12,background:'var(--blue-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📂</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--font-serif)',fontSize:22}}>Importar documentos em lote</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
              A IA classifica e preenche tudo automaticamente
            </div>
          </div>
          <button className="ghost" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        {/* Drop zone */}
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{display:'none'}}
          onChange={e => addFiles(e.target.files)} />
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border:`2px dashed ${dragging?'var(--blue)':'var(--border2)'}`,
            borderRadius:14,
            padding:'48px 24px',
            textAlign:'center',
            cursor:'pointer',
            background: dragging ? 'var(--blue-dim)' : 'var(--bg2)',
            transition:'all .15s',
            marginBottom:24,
          }}>
          <div style={{fontSize:48,marginBottom:12}}>📂</div>
          <div style={{fontSize:16,fontWeight:500,marginBottom:8}}>
            Arraste todos os documentos aqui
          </div>
          <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.8}}>
            PDFs e imagens — pode ser tudo de uma vez<br/>
            CVA, seguro, rádio, matrícula, notas fiscais, log book...
          </div>
        </div>

        {/* What gets detected */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
          {[
            {icon:'📄',label:'Documentos oficiais',sub:'CVA, seguro, matrícula, rádio...'},
            {icon:'🧾',label:'Notas fiscais',sub:'Combustível, manutenção, hangar'},
            {icon:'📓',label:'Log Book',sub:'Diário de bordo da aeronave'},
            {icon:'📚',label:'Manual / POH',sub:'Detectado e oferece importar dados'},
          ].map((item,i)=>(
            <div key={i} style={{padding:'10px 14px',borderRadius:9,background:'var(--bg2)',border:'1px solid var(--border)',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
              <div>
                <div style={{fontSize:12,fontWeight:500}}>{item.label}</div>
                <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── REVIEW STEP ───────────────────────────────────────────
  if (step === 'review') return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1100,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'24px 16px'}}>
      {editIdx !== null && (
        <EditModal item={items[editIdx]} onClose={()=>setEditIdx(null)} onSave={handleEditSave} />
      )}

      <div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:18,maxWidth:720,width:'100%',padding:'24px 28px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <div style={{width:40,height:40,borderRadius:10,background:'var(--blue-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🧠</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--font-serif)',fontSize:19}}>
              {analyzing ? 'Analisando documentos...' : 'Revisar e confirmar'}
            </div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
              {analyzing
                ? `${items.filter(i=>!i.analyzing).length} de ${items.length} analisados`
                : `${included.length} selecionados · ${docs.length} documentos · ${costs.length} custos${needReview > 0 ? ` · ⚠ ${needReview} para revisar` : ''}`}
            </div>
          </div>

          <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{display:'none'}}
            onChange={e => addFiles(e.target.files)} />
          <button onClick={() => fileRef.current?.click()}
            style={{fontSize:12,padding:'7px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text2)',cursor:'pointer'}}>
            + Adicionar mais
          </button>
          <button className="ghost" onClick={onClose} style={{fontSize:16}}>✕</button>
        </div>

        {/* Review warning */}
        {!analyzing && needReview > 0 && (
          <div style={{marginBottom:14,padding:'10px 14px',background:'var(--amber-dim)',border:'1px solid var(--amber-mid)',borderRadius:8,fontSize:12,color:'var(--amber)'}}>
            ⚠ {needReview} arquivo{needReview>1?'s':''} com confiança baixa/média — revise antes de salvar.
          </div>
        )}

        {/* Items */}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
          {items.map((item,idx) => (
            <ItemCard key={item.id} item={item} idx={idx}
              onEdit={setEditIdx}
              onRemove={handleRemove}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:10,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{flex:1,fontSize:12,color:'var(--text3)',display:'flex',alignItems:'center'}}>
            {included.length > 0 && !analyzing && (
              <span>
                {docs.length > 0 && <span>📄 {docs.length} doc{docs.length>1?'s':''}</span>}
                {docs.length > 0 && costs.length > 0 && <span> · </span>}
                {costs.length > 0 && <span>🧾 {costs.length} custo{costs.length>1?'s':''}</span>}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{fontSize:13}}>Cancelar</button>
          <button className="primary"
            onClick={handleSaveAll}
            disabled={analyzing || included.length === 0}
            style={{fontSize:13,padding:'10px 28px'}}>
            {analyzing ? '⏳ Aguarde...' : `✓ Salvar ${included.length} arquivo${included.length!==1?'s':''}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ── SAVING STEP ───────────────────────────────────────────
  if (step === 'saving') return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:16,maxWidth:480,width:'100%',padding:32,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:16}}>💾</div>
        <div style={{fontFamily:'var(--font-serif)',fontSize:18,marginBottom:16}}>Salvando...</div>

        {/* Progress bar */}
        <div style={{height:8,background:'var(--bg3)',borderRadius:4,overflow:'hidden',marginBottom:12}}>
          <div style={{height:'100%',background:'var(--blue)',borderRadius:4,width:`${progress.total>0?(progress.done/progress.total*100):0}%`,transition:'width .3s'}} />
        </div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:16}}>{progress.done} de {progress.total}</div>

        {saveLog.slice(-3).map((l,i) => (
          <div key={i} style={{fontSize:11,color: l.ok ? 'var(--green)' : 'var(--red)',marginBottom:4}}>
            {l.ok ? '✓' : '✗'} {l.name} — {l.msg}
          </div>
        ))}
      </div>
    </div>
  );

  // ── DONE STEP ─────────────────────────────────────────────
  if (step === 'done') {
    const ok     = saveLog.filter(l=>l.ok).length;
    const failed = saveLog.filter(l=>!l.ok).length;
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:16,maxWidth:480,width:'100%',padding:32,textAlign:'center'}}>
          <div style={{fontSize:52,marginBottom:14}}>{failed===0 ? '🎉' : '⚠️'}</div>
          <div style={{fontFamily:'var(--font-serif)',fontSize:22,color: failed===0 ? 'var(--green)' : 'var(--amber)',marginBottom:8}}>
            {failed===0 ? 'Tudo salvo!' : `${ok} salvos, ${failed} com erro`}
          </div>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:20,lineHeight:1.8}}>
            {ok > 0 && <div>✓ {ok} arquivo{ok>1?'s':''} processado{ok>1?'s':''} com sucesso</div>}
            {failed > 0 && <div style={{color:'var(--red)'}}>✗ {failed} com erro — veja detalhes abaixo</div>}
          </div>

          {/* Log */}
          <div style={{maxHeight:180,overflowY:'auto',marginBottom:20,textAlign:'left'}}>
            {saveLog.map((l,i) => (
              <div key={i} style={{padding:'5px 10px',borderRadius:6,background: l.ok?'var(--green-dim)':'var(--red-dim)',marginBottom:4,fontSize:11,color: l.ok?'var(--green)':'var(--red)'}}>
                {l.ok ? '✓' : '✗'} <strong>{l.name}</strong> — {l.msg}
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <button className="primary" onClick={onClose} style={{padding:'10px 32px'}}>
              Ver documentos →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
