import { Tip } from '../App';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { getUser } from '../store';

// ── Tipos de documento obrigatório ────────────────────────────
const MANDATORY_DOCS = [
  { type: 'cva',                    label: 'CVA — Certificado de Verificação de Aeronavegabilidade', intervalDays: 365, tip: 'Emitido pela ANAC após inspeção anual. Sem CVA válido a aeronave não pode voar. Validade: 1 ano.' },
  { type: 'matricula',              label: 'Matrícula da Aeronave (ANAC)',                            intervalDays: null, tip: 'Registro da aeronave no RBAC/ANAC — o "documento de identidade" da aeronave. Permanente.' },
  { type: 'radio_license',          label: 'Licença de Estação de Radiocomunicação (ANATEL)',          intervalDays: 730, tip: 'LEA emitida pela ANATEL. Autoriza o uso do rádio VHF e transponder. Validade: 2 anos.' },
  { type: 'seguro',                 label: 'Seguro Aeronáutico (RETA)',                               intervalDays: 365, tip: 'RETA — Responsabilidade Civil por danos a Terceiros. Seguro obrigatório por lei no Brasil. Validade: 1 ano.' },
  { type: 'manual_voo',             label: 'Manual de Voo / AFM / POH',                               intervalDays: null, tip: 'POH (Pilot Operating Handbook) — manual obrigatório a bordo. Contém limitações, emergências e performance.' },
  { type: 'manual_manutencao',      label: 'Manual de Manutenção',                                    intervalDays: null, tip: 'Manual técnico usado pela oficina homologada. Define intervalos, procedimentos e peças aprovadas.' },
  { type: 'registro_anac',          label: 'Certificado de Registro ANAC',                            intervalDays: null, tip: 'CRA — comprova propriedade e registro da aeronave. Deve ser atualizado ao vender.' },
  { type: 'despacho_aeronaveg',     label: 'Despacho de Aeronavegabilidade',                          intervalDays: 365, tip: 'Autorização de voo emitida pela ANAC ou DAA para aeronaves em condição específica.' },
  { type: 'certificado_ruido',      label: 'Certificado de Homologação de Ruído',                     intervalDays: null, tip: 'Certifica que a aeronave atende aos limites de ruído da ICAO — pode ser exigido em aeroportos específicos.' },
  { type: 'transponder_cert',       label: 'Certificado de Transponder / Altímetro',                  intervalDays: 730, tip: 'Certificação obrigatória a cada 24 meses. Garante o funcionamento do transponder ADS-B Out.' },
];

const CATEGORIES = [
  { id: 'mandatory',   label: 'Obrigatórios',  color: 'var(--blue)'   },
  { id: 'operational', label: 'Operacionais',  color: 'var(--green)'  },
  { id: 'maintenance', label: 'Manutenção',    color: 'var(--amber)'  },
  { id: 'insurance',   label: 'Seguros',       color: 'var(--purple)' },
  { id: 'other',       label: 'Outros',        color: 'var(--text3)'  },
];

// ── Store functions ───────────────────────────────────────────
async function getAircraftDocs(aircraftId) {
  const { data, error } = await supabase
    .from('aircraft_documents')
    .select('*')
    .eq('aircraft_id', aircraftId)
    .order('category')
    .order('doc_type')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveAircraftDoc(doc) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const row = {
    user_id:           user.id,
    aircraft_id:       doc.aircraft_id,
    doc_type:          doc.doc_type,
    category:          doc.category || 'mandatory',
    doc_number:        doc.doc_number || null,
    title:             doc.title,
    issuing_authority: doc.issuing_authority || null,
    issuing_country:   doc.issuing_country || 'BR',
    issue_date:        doc.issue_date || null,
    expiry_date:       doc.expiry_date || null,
    is_lifetime:       !!doc.is_lifetime,
    file_url:          doc.file_url || null,
    file_name:         doc.file_name || null,
    file_type:         doc.file_type || null,
    file_size_kb:      doc.file_size_kb || null,
    ai_extracted:      !!doc.ai_extracted,
    ai_raw:            doc.ai_raw || {},
    version:           doc.version || null,
    supersedes_id:     doc.supersedes_id || null,
    is_current:        doc.is_current !== false,
    notes:             doc.notes || null,
  };
  if (doc.id) {
    const { data, error } = await supabase.from('aircraft_documents').update(row).eq('id', doc.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('aircraft_documents').insert(row).select().single();
    if (error) throw error;
    return data;
  }
}

async function deleteAircraftDoc(id) {
  const { error } = await supabase.from('aircraft_documents').delete().eq('id', id);
  if (error) throw error;
}

async function uploadDocFile(file, aircraftId, docId) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${user.id}/${aircraftId}/${docId || Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('aircraft-docs')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('aircraft-docs').getPublicUrl(path);
  return urlData.publicUrl;
}

// ── IA extrai dados do documento ──────────────────────────────
async function extractDocWithAI(file, apiKey) {
  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);

  const isImage = file.type.startsWith('image/');
  const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const mediaType = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');

  const content = [];
  if (isPdf) {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
  } else if (isImage) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } });
  }

  content.push({ type: 'text', text: `Analyze this aviation document and extract ALL information.
Return ONLY valid JSON, no explanation:
{
  "doc_type": "",
  "title": "",
  "doc_number": "",
  "issuing_authority": "",
  "issuing_country": "BR",
  "issue_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "is_lifetime": false,
  "registration": "",
  "aircraft_model": "",
  "category": "mandatory",
  "version": "",
  "notes": ""
}

doc_type options: cva | matricula | radio_license | seguro | manual_voo | manual_manutencao | registro_anac | despacho_aeronaveg | certificado_ruido | transponder_cert | other
category options: mandatory | operational | maintenance | insurance | other

Rules:
- Extract exact dates in YYYY-MM-DD format
- If document has no expiry date (lifetime), set is_lifetime: true
- title: full document title as written
- doc_number: certificate/registration number
- issuing_authority: who issued it (ANAC, ANATEL, seguradora etc)
- If you cannot determine doc_type, use "other"
- Always return valid JSON even if uncertain` });

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey || '', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const match = clean.match(/\{[\s\S]+\}/);
  if (match) try { return JSON.parse(match[0]); } catch {}
  return null;
}

// ── Helpers ───────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

function statusFor(doc) {
  if (doc.is_lifetime) return { label: 'Vitalício', color: 'var(--green)', dim: 'var(--green-dim)' };
  if (!doc.expiry_date) return { label: 'Sem validade', color: 'var(--text3)', dim: 'var(--bg3)' };
  const d = daysUntil(doc.expiry_date);
  if (d < 0)   return { label: `Vencido há ${Math.abs(d)}d`, color: 'var(--red)',   dim: 'var(--red-dim)'   };
  if (d < 30)  return { label: `Vence em ${d}d`,            color: 'var(--red)',   dim: 'var(--red-dim)'   };
  if (d < 90)  return { label: `Vence em ${d}d`,            color: 'var(--amber)', dim: 'var(--amber-dim)' };
  return { label: `Válido (${d}d)`, color: 'var(--green)', dim: 'var(--green-dim)' };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

const EMPTY = {
  doc_type: 'other', category: 'mandatory', title: '', doc_number: '',
  issuing_authority: '', issuing_country: 'BR', issue_date: '', expiry_date: '',
  is_lifetime: false, version: '', notes: '', is_current: true,
};

// ── Component ─────────────────────────────────────────────────
export default function AircraftDocuments({ aircraft, onClose }) {
  const [docs,        setDocs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [file,        setFile]        = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [filter,      setFilter]      = useState('all');
  const [serverKey,   setServerKey]   = useState(null);
  const [error,       setError]       = useState('');
  const fileRef = useRef();

  const load = useCallback(async () => {
    if (!aircraft?.id) return;
    setLoading(true);
    try {
      const d = await getAircraftDocs(aircraft.id);
      setDocs(d);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [aircraft?.id]);

  useEffect(() => {
    load();
    // Check server API key
    fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    }).then(r => r.json()).then(d => setServerKey(!d.error?.type?.includes('auth'))).catch(() => setServerKey(false));
  }, [load]);

  function startNew(docType) {
    const preset = MANDATORY_DOCS.find(m => m.type === docType);
    setForm({
      ...EMPTY,
      doc_type: docType || 'other',
      category: docType ? 'mandatory' : 'other',
      title: preset?.label || '',
      aircraft_id: aircraft.id,
    });
    setFile(null);
    setAiError('');
    setEditing('new');
  }

  function startEdit(doc) {
    setForm({
      ...doc,
      issue_date:  doc.issue_date  || '',
      expiry_date: doc.expiry_date || '',
    });
    setFile(null);
    setAiError('');
    setEditing(doc.id);
  }

  async function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (!serverKey) return;
    // Auto-extract with IA
    setAiLoading(true);
    setAiError('');
    try {
      const extracted = await extractDocWithAI(f, '');
      if (extracted) {
        setForm(prev => ({
          ...prev,
          doc_type:          extracted.doc_type          || prev.doc_type,
          title:             extracted.title             || prev.title,
          doc_number:        extracted.doc_number        || prev.doc_number,
          issuing_authority: extracted.issuing_authority || prev.issuing_authority,
          issuing_country:   extracted.issuing_country   || prev.issuing_country,
          issue_date:        extracted.issue_date        || prev.issue_date,
          expiry_date:       extracted.expiry_date       || prev.expiry_date,
          is_lifetime:       extracted.is_lifetime       || prev.is_lifetime,
          category:          extracted.category          || prev.category,
          version:           extracted.version           || prev.version,
          notes:             extracted.notes             || prev.notes,
          ai_extracted:      true,
          ai_raw:            extracted,
          file_name:         f.name,
          file_type:         f.name.split('.').pop().toLowerCase(),
          file_size_kb:      Math.round(f.size / 1024),
        }));
      } else {
        setAiError('IA não conseguiu extrair dados. Preencha manualmente.');
        setForm(prev => ({ ...prev, file_name: f.name, file_type: f.name.split('.').pop().toLowerCase(), file_size_kb: Math.round(f.size / 1024) }));
      }
    } catch(e) {
      setAiError('Erro ao analisar: ' + e.message);
    }
    setAiLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setUploading(true);
    setError('');
    try {
      const docToSave = { ...form, aircraft_id: aircraft.id };
      // Upload file if selected
      if (file) {
        const tempId = form.id || Date.now().toString();
        const url = await uploadDocFile(file, aircraft.id, tempId).catch(() => null);
        if (url) {
          docToSave.file_url = url;
          docToSave.file_name = file.name;
          docToSave.file_type = file.name.split('.').pop().toLowerCase();
          docToSave.file_size_kb = Math.round(file.size / 1024);
        }
      }
      const saved = await saveAircraftDoc(docToSave);

      // Se é um documento com validade e is_current=true:
      // 1. Arquiva versões anteriores do mesmo tipo
      // 2. Cria/atualiza item de manutenção com o vencimento
      if (docToSave.is_current !== false && docToSave.expiry_date && !docToSave.is_lifetime) {
        // Arquiva outros docs do mesmo tipo (is_current = false)
        if (!docToSave.id) { // só para novos documentos
          await supabase
            .from('aircraft_documents')
            .update({ is_current: false })
            .eq('aircraft_id', aircraft.id)
            .eq('doc_type', docToSave.doc_type)
            .neq('id', saved.id);
        }

        // Nomes amigáveis para cada tipo de documento
        const DOC_MX_NAMES = {
          cva:              'Vencimento CVA — Inspeção Anual ANAC',
          seguro:           'Vencimento Seguro Aeronáutico (RETA)',
          radio_license:    'Vencimento Licença de Rádio (ANATEL)',
          transponder_cert: 'Vencimento Certificação Transponder/Altímetro',
          despacho_aeronaveg: 'Vencimento Despacho de Aeronavegabilidade',
        };
        const mxName = DOC_MX_NAMES[docToSave.doc_type];
        if (mxName) {
          const user = await getUser();
          const expiry = new Date(docToSave.expiry_date);
          const today  = new Date();
          const daysLeft = Math.floor((expiry - today) / 86400000);
          const status = daysLeft < 0 ? 'overdue' : daysLeft < 60 ? 'due_soon' : 'current';

          // Verifica se já existe item de MX para este doc type
          const { data: existing } = await supabase
            .from('maintenance')
            .select('id')
            .eq('aircraft_id', aircraft.id)
            .ilike('name', '%' + (docToSave.doc_type === 'cva' ? 'CVA' : mxName.split(' ')[1]) + '%')
            .limit(1);

          const mxRow = {
            user_id: user.id,
            aircraft_id: aircraft.id,
            item_type: 'inspection',
            name: mxName,
            interval_days: [
              'cva','seguro','despacho_aeronaveg'
            ].includes(docToSave.doc_type) ? 365 : 730,
            last_done_date: docToSave.issue_date || null,
            next_due_date:  docToSave.expiry_date,
            status,
            estimated_cost_brl: docToSave.doc_type === 'cva' ? 0 : 0,
            notes: `Gerado automaticamente ao cadastrar ${docToSave.doc_type.toUpperCase()}. Documento: ${docToSave.title || mxName}.`,
          };

          if (existing && existing.length > 0) {
            await supabase.from('maintenance').update(mxRow).eq('id', existing[0].id);
          } else {
            await supabase.from('maintenance').insert(mxRow);
          }
        }
      }

      await load();
      setEditing(null);
    } catch(e) {
      setError(e.message);
    }
    setUploading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover documento?')) return;
    try { await deleteAircraftDoc(id); await load(); } catch(e) { setError(e.message); }
  }

  // Which mandatory docs are missing?
  const presentTypes = new Set(docs.filter(d => d.is_current).map(d => d.doc_type));
  const missingMandatory = MANDATORY_DOCS.filter(m => !presentTypes.has(m.type));

  // Filter docs
  const filtered = filter === 'all' ? docs : filter === 'missing'
    ? [] : docs.filter(d => d.category === filter);

  // Stats
  const expired = docs.filter(d => d.is_current && !d.is_lifetime && d.expiry_date && daysUntil(d.expiry_date) < 0).length;
  const expiringSoon = docs.filter(d => d.is_current && !d.is_lifetime && d.expiry_date && daysUntil(d.expiry_date) >= 0 && daysUntil(d.expiry_date) < 60).length;

  // ── Form View ───────────────────────────────────────────────
  if (editing !== null) {
    return (
      <div style={{ padding:'20px 24px', maxWidth:680 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>
            {editing === 'new' ? 'Novo documento' : 'Editar documento'}
          </div>
        </div>

        {error && <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}

        <form onSubmit={handleSave}>
          {/* Upload */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
              Arquivo <span style={{ fontWeight:400, color:'var(--text3)' }}>(opcional)</span>
              {serverKey && <span style={{ marginLeft:8, color:'var(--green)', fontSize:10 }}>● IA disponível</span>}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display:'none' }} onChange={handleFileChange} />
            <div onClick={() => fileRef.current?.click()}
              style={{ border:'2px dashed var(--border2)', borderRadius:10, padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--bg2)' }}>
              {aiLoading ? (
                <div style={{ color:'var(--blue)', fontSize:13 }}>🧠 Analisando documento com IA...</div>
              ) : file ? (
                <div>
                  <div style={{ fontWeight:500, fontSize:13, color:'var(--text1)' }}>{file.name}</div>
                  <div style={{ fontSize:11, color:'var(--green)', marginTop:4 }}>{(file.size/1024).toFixed(0)} KB</div>
                  {form.ai_extracted && <div style={{ fontSize:11, color:'var(--blue)', marginTop:4 }}>✓ Dados extraídos pela IA — verifique abaixo</div>}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:24, marginBottom:8 }}>📎</div>
                  <div style={{ fontSize:13, color:'var(--text2)' }}>Clique para anexar PDF ou imagem</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>A IA lê automaticamente e extrai os dados</div>
                </div>
              )}
            </div>
            {aiError && <div style={{ marginTop:8, fontSize:11, color:'var(--amber)' }}>⚠ {aiError}</div>}
            {form.file_url && !file && (
              <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                <span style={{ color:'var(--text3)' }}>Arquivo atual:</span>
                <a href={form.file_url} target="_blank" rel="noreferrer" style={{ color:'var(--blue)' }}>{form.file_name || 'Ver arquivo'}</a>
              </div>
            )}
          </div>

          {/* Dados principais */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Dados do documento</div>

            <div style={{ marginBottom:12 }}>
              <label>Título / Nome do documento *</label>
              <input required value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Certificado de Verificação de Aeronavegabilidade" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label>Tipo</label>
                <select value={form.doc_type} onChange={e => setForm(f=>({...f,doc_type:e.target.value}))}>
                  {MANDATORY_DOCS.map(m => <option key={m.type} value={m.type}>{m.label.split(' — ')[0]}</option>)}
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label>Categoria</label>
                <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label>Número / Registro</label>
                <input value={form.doc_number} onChange={e => setForm(f=>({...f,doc_number:e.target.value}))} placeholder="Ex: CVA-2024-12345" style={{ fontFamily:'var(--font-mono)' }} />
              </div>
              <div>
                <label>Versão / Ano</label>
                <input value={form.version} onChange={e => setForm(f=>({...f,version:e.target.value}))} placeholder="Ex: 2025, Rev.3" />
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label>Órgão emissor</label>
              <input value={form.issuing_authority} onChange={e => setForm(f=>({...f,issuing_authority:e.target.value}))} placeholder="Ex: ANAC, ANATEL, Seguros Gerais..." />
            </div>
          </div>

          {/* Validade */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Validade</div>

            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <input type="checkbox" id="lifetime" checked={form.is_lifetime} onChange={e => setForm(f=>({...f,is_lifetime:e.target.checked,expiry_date:''}))} />
              <label htmlFor="lifetime" style={{ fontSize:13, cursor:'pointer', marginBottom:0 }}>Documento permanente / sem validade</label>
            </div>

            {!form.is_lifetime && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label>Data de emissão</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm(f=>({...f,issue_date:e.target.value}))} />
                </div>
                <div>
                  <label>Data de validade</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f=>({...f,expiry_date:e.target.value}))} />
                  {form.expiry_date && (() => {
                    const d = daysUntil(form.expiry_date);
                    const color = d < 0 ? 'var(--red)' : d < 60 ? 'var(--amber)' : 'var(--green)';
                    return <div style={{ fontSize:11, color, marginTop:4 }}>{d < 0 ? `Vencido há ${Math.abs(d)} dias` : `Vence em ${d} dias`}</div>;
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:16 }}>
            <label>Notas</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Observações adicionais..." />
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" className="primary" disabled={uploading} style={{ flex:1 }}>
              {uploading ? 'Salvando...' : '✓ Salvar documento'}
            </button>
            <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  // ── List View ───────────────────────────────────────────────
  return (
    <div style={{ padding:'20px 24px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:20 }}>
            Documentos — {aircraft.registration}
          </div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
            {aircraft.manufacturer} {aircraft.model}
          </div>
        </div>
        <button className="primary" onClick={() => startNew(null)}>+ Novo documento</button>
      </div>

      {/* Stats */}
      {(expired > 0 || expiringSoon > 0 || missingMandatory.length > 0) && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {expired > 0 && (
            <div style={{ padding:'8px 14px', borderRadius:8, background:'var(--red-dim)', border:'1px solid var(--red-mid)', fontSize:12, color:'var(--red)' }}>
              ⚠ {expired} documento{expired>1?'s':''} vencido{expired>1?'s':''}
            </div>
          )}
          {expiringSoon > 0 && (
            <div style={{ padding:'8px 14px', borderRadius:8, background:'var(--amber-dim)', border:'1px solid var(--amber-mid)', fontSize:12, color:'var(--amber)' }}>
              ⏰ {expiringSoon} vencendo em 60 dias
            </div>
          )}
          {missingMandatory.length > 0 && (
            <div style={{ padding:'8px 14px', borderRadius:8, background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', fontSize:12, color:'var(--blue)' }}>
              📋 {missingMandatory.length} obrigatório{missingMandatory.length>1?'s':''} faltando
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {[['all','Todos'], ['missing','Faltando'], ...CATEGORIES.map(c=>[c.id,c.label])].map(([id,label]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{ padding:'5px 12px', borderRadius:20, border:`0.5px solid ${filter===id?'var(--border2)':'var(--border)'}`, background:filter===id?'var(--bg3)':'transparent', color:filter===id?'var(--text1)':'var(--text3)', fontSize:11.5, cursor:'pointer', fontWeight:500 }}>
            {label}
            {id === 'missing' && missingMandatory.length > 0 && <span style={{ marginLeft:4, background:'var(--blue)', color:'#fff', borderRadius:10, fontSize:9, padding:'1px 5px' }}>{missingMandatory.length}</span>}
          </button>
        ))}
      </div>

      {error && <div style={{ marginBottom:12, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}

      {/* Missing mandatory docs */}
      {filter === 'missing' && (
        <div>
          {missingMandatory.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'var(--green)', fontSize:14 }}>
              ✓ Todos os documentos obrigatórios estão cadastrados
            </div>
          ) : (
            <div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
                Documentos obrigatórios não cadastrados para {aircraft.registration}:
              </div>
              {missingMandatory.map(m => (
                <div key={m.type} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:10, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{m.label}</div>
                    {m.intervalDays && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Validade típica: {Math.round(m.intervalDays/365)} ano{m.intervalDays>365?'s':''}</div>}
                  </div>
                  <button className="primary" style={{ fontSize:11, padding:'6px 14px' }} onClick={() => startNew(m.type)}>
                    + Adicionar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document list */}
      {filter !== 'missing' && (
        loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📂</div>
            Nenhum documento cadastrado.
            <br/>
            <button className="primary" style={{ marginTop:16 }} onClick={() => startNew(null)}>+ Adicionar primeiro documento</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(doc => {
              const st = statusFor(doc);
              const cat = CATEGORIES.find(c => c.id === doc.category);
              return (
                <div key={doc.id} style={{ background:'var(--bg1)', border:`1px solid var(--border)`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  {/* Icon */}
                  <div style={{ width:36, height:36, borderRadius:8, background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {doc.file_type === 'pdf' ? '📄' : doc.file_url ? '🖼' : '📋'}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                      <div style={{ fontWeight:500, fontSize:13, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:320 }}>{doc.title}</div>
                      {doc.version && <span style={{ fontSize:10, color:'var(--text3)', background:'var(--bg3)', padding:'1px 6px', borderRadius:10 }}>{doc.version}</span>}
                      {doc.ai_extracted && <span style={{ fontSize:9, color:'var(--blue)', background:'var(--blue-dim)', padding:'1px 6px', borderRadius:10 }}>IA</span>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', display:'flex', gap:12, flexWrap:'wrap' }}>
                      {doc.doc_number && <span style={{ fontFamily:'var(--font-mono)' }}>{doc.doc_number}</span>}
                      {doc.issuing_authority && <span>{doc.issuing_authority}</span>}
                      {!doc.is_lifetime && doc.issue_date && <span>Emitido: {fmtDate(doc.issue_date)}</span>}
                      {!doc.is_lifetime && doc.expiry_date && <span>Vence: {fmtDate(doc.expiry_date)}</span>}
                      {cat && <span style={{ color:cat.color }}>{cat.label}</span>}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink:0, textAlign:'right' }}>
                    <span style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20, background:st.dim, color:st.color, border:`1px solid ${st.color}33` }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noreferrer"
                        style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--text3)', fontSize:11, cursor:'pointer', textDecoration:'none' }}>
                        ↗
                      </a>
                    )}
                    <button className="ghost" style={{ fontSize:11, padding:'6px 10px' }} onClick={() => startEdit(doc)}>Editar</button>
                    <button className="ghost" style={{ fontSize:11, padding:'6px 10px', color:'var(--red)' }} onClick={() => handleDelete(doc.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
