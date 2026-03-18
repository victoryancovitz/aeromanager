import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { getUser, getAircraft, getSettings } from '../store';

const TYPE_META = {
  fuel_quote:     { icon:'⛽', label:'Cotação de combustível', color:'var(--amber)'  },
  handling:       { icon:'🛬', label:'Handling / Serviços',   color:'var(--blue)'   },
  arrival_notice: { icon:'✈',  label:'Aviso de chegada',      color:'var(--green)'  },
  catering:       { icon:'🍽', label:'Catering',              color:'var(--purple)' },
  custom:         { icon:'✉',  label:'Personalizado',         color:'var(--text2)'  },
};

// All possible variables
const ALL_VARS = {
  registration:   { label:'Prefixo', example:'PP-ABC' },
  fbo_name:       { label:'Nome do FBO', example:'Shell Aviation' },
  operator:       { label:'Operador', example:'Yancovitz Aviation' },
  icao:           { label:'ICAO', example:'SBMT' },
  date:           { label:'Data', example:'18/03/2026' },
  eta:            { label:'ETA (UTC)', example:'14:30' },
  etd:            { label:'ETD (UTC)', example:'09:00' },
  pax:            { label:'PAX', example:'3' },
  crew:           { label:'Tripulação', example:'2' },
  fuel_type:      { label:'Tipo combustível', example:'AVGAS 100LL' },
  fuel_liters:    { label:'Litros', example:'120' },
  fuel_usg:       { label:'Galões (USG)', example:'31.7' },
  pilot_name:     { label:'Nome piloto', example:'Victor Yancovitz' },
  catering_line:  { label:'Linha catering', example:'☐ Catering: 3 refeições' },
  handling_notes: { label:'Notas handling', example:'Necessita GPU' },
};

async function getTemplates() {
  const user = await getUser();
  if (!user) return [];
  const { data } = await supabase.from('email_templates').select('*').eq('user_id', user.id).order('type').order('name');
  return data || [];
}
async function saveTemplate(t) {
  const user = await getUser(); if (!user) throw new Error('Não autenticado');
  const row = { user_id: user.id, name: t.name, type: t.type, subject: t.subject, body: t.body, language: t.language||'pt', is_default: !!t.is_default, variables: t.variables || [] };
  if (t.id) { const { data, error } = await supabase.from('email_templates').update(row).eq('id', t.id).select().single(); if (error) throw error; return data; }
  else       { const { data, error } = await supabase.from('email_templates').insert(row).select().single(); if (error) throw error; return data; }
}
async function deleteTemplate(id) {
  const { error } = await supabase.from('email_templates').delete().eq('id', id);
  if (error) throw error;
}

function fillTemplate(body, subject, vars) {
  let b = body, s = subject;
  Object.entries(vars).forEach(([k, v]) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
    b = b.replace(re, v || `{{${k}}}`);
    s = s.replace(re, v || `{{${k}}}`);
  });
  return { body: b, subject: s };
}

const EMPTY = { name:'', type:'custom', subject:'', body:'', language:'pt', is_default:false };

export default function EmailTemplates({ onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(null); // null | 'new' | id
  const [form,      setForm]      = useState(EMPTY);
  const [preview,   setPreview]   = useState(false);
  const [previewVars, setPreviewVars] = useState({});
  const [aircraft,  setAircraft]  = useState([]);
  const [profile,   setProfile]   = useState({});
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [copied,    setCopied]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, ac, s] = await Promise.all([getTemplates(), getAircraft(), getSettings()]);
    setTemplates(t);
    setAircraft(ac || []);
    setProfile(s?.profile || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-fill preview vars from first aircraft + profile
  useEffect(() => {
    if (!aircraft.length) return;
    const ac = aircraft[0];
    setPreviewVars({
      registration: ac.registration || 'PP-ABC',
      fuel_type:    ac.fuelType === 'jet_a1' ? 'Jet-A1' : 'AVGAS 100LL',
      fuel_liters:  '80',
      fuel_usg:     '21.1',
      pilot_name:   profile.fullName || 'Piloto',
      operator:     profile.fullName || 'Operador',
      icao:         ac.homeBase || 'SBMT',
      date:         new Date().toLocaleDateString('pt-BR'),
      eta:          '14:30',
      etd:          '09:00',
      pax:          '2',
      crew:         '2',
      fbo_name:     'FBO Operações',
      catering_line: '',
      handling_notes: '',
    });
  }, [aircraft, profile]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startNew() { setForm({ ...EMPTY }); setEditing('new'); setPreview(false); }
  function startEdit(t) { setForm({ ...t }); setEditing(t.id); setPreview(false); }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('');
    try { await saveTemplate(form); await load(); setEditing(null); }
    catch(e) { setError(e.message); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover template?')) return;
    try { await deleteTemplate(id); await load(); } catch(e) { setError(e.message); }
  }

  function handleCopy() {
    const { body, subject } = fillTemplate(form.body, form.subject, previewVars);
    navigator.clipboard?.writeText(`Assunto: ${subject}\n\n${body}`).catch(()=>{});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function handleMailto() {
    const { body, subject } = fillTemplate(form.body, form.subject, previewVars);
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  function insertVar(varName) {
    set('body', form.body + `{{${varName}}}`);
  }

  // ── Form View ──────────────────────────────────────────────
  if (editing !== null) {
    const { body: previewBody, subject: previewSubject } = fillTemplate(form.body, form.subject, previewVars);
    return (
      <div style={{ padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button className="ghost" onClick={() => setEditing(null)}>← Voltar</button>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>
            {editing === 'new' ? 'Novo template' : 'Editar template'}
          </div>
          <div style={{ flex:1 }} />
          <button className="ghost" style={{ fontSize:12 }} onClick={() => setPreview(p=>!p)}>
            {preview ? '✏️ Editar' : '👁 Preview'}
          </button>
        </div>

        {error && <div style={{ marginBottom:12, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}

        <div style={{ display:'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap:16 }}>
          {/* Editor */}
          <form onSubmit={handleSave}>
            <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:10 }}>
                <div><label>Nome do template *</label><input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Cotação Shell SBMT" autoFocus /></div>
                <div><label>Tipo</label>
                  <select value={form.type} onChange={e=>set('type',e.target.value)}>
                    {Object.entries(TYPE_META).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label>Idioma</label>
                  <select value={form.language} onChange={e=>set('language',e.target.value)}>
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom:0, fontSize:12 }}>
                    <input type="checkbox" checked={form.is_default} onChange={e=>set('is_default',e.target.checked)} />
                    Template padrão para este tipo
                  </label>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
              <div style={{ marginBottom:10 }}>
                <label>Assunto *</label>
                <input required value={form.subject} onChange={e=>set('subject',e.target.value)} placeholder="Cotação de Combustível — {{registration}} — {{icao}}" style={{ fontFamily:'var(--font-mono)', fontSize:12 }} />
              </div>
              <div>
                <label>Corpo do e-mail *</label>
                <textarea required rows={14} value={form.body} onChange={e=>set('body',e.target.value)}
                  style={{ fontFamily:'var(--font-mono)', fontSize:12, lineHeight:1.6 }}
                  placeholder="Prezada Equipe {{fbo_name}}..." />
              </div>
            </div>

            {/* Variables toolbar */}
            <div className="card" style={{ padding:'12px 16px', marginBottom:14 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8, fontWeight:600 }}>📎 Variáveis disponíveis — clique para inserir no texto</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {Object.entries(ALL_VARS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => insertVar(k)}
                    style={{ padding:'3px 9px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text2)', fontSize:10.5, cursor:'pointer', fontFamily:'var(--font-mono)' }}
                    title={`Exemplo: ${v.example}`}>
                    {`{{${k}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button type="submit" className="primary" disabled={saving} style={{ flex:1 }}>
                {saving ? 'Salvando...' : '✓ Salvar template'}
              </button>
              <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>

          {/* Preview */}
          {preview && (
            <div>
              <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>Preview — valores de teste</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {Object.entries(previewVars).filter(([k])=>Object.keys(ALL_VARS).includes(k)).map(([k,v])=>(
                    <div key={k}>
                      <label style={{ fontSize:10 }}>{ALL_VARS[k]?.label}</label>
                      <input value={v} onChange={e=>setPreviewVars(p=>({...p,[k]:e.target.value}))} style={{ fontSize:11, padding:'4px 8px' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding:'16px 20px' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:10 }}>📧 Preview do e-mail</div>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', background:'var(--blue-dim)', borderRadius:7, padding:'8px 10px', marginBottom:10, color:'var(--blue)', wordBreak:'break-word' }}>
                  Assunto: {previewSubject}
                </div>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', lineHeight:1.8, color:'var(--text1)', whiteSpace:'pre-wrap', background:'var(--bg2)', borderRadius:8, padding:'12px 14px', maxHeight:300, overflowY:'auto' }}>
                  {previewBody}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button className="primary" style={{ fontSize:11, padding:'6px 14px' }} onClick={handleCopy}>
                    {copied ? '✓ Copiado!' : '📋 Copiar'}
                  </button>
                  <button className="ghost" style={{ fontSize:11, padding:'6px 14px' }} onClick={handleMailto}>
                    📧 Abrir no e-mail
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List View ──────────────────────────────────────────────
  return (
    <div style={{ padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:20 }}>Templates de E-mail</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Modelos customizáveis com variáveis automáticas</div>
        </div>
        <button className="primary" onClick={startNew}>+ Novo template</button>
      </div>

      {error && <div style={{ marginBottom:12, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Carregando...</div>
      ) : templates.length === 0 ? (
        <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✉</div>
          Nenhum template. Crie o primeiro para agilizar contatos com FBOs.
          <br/>
          <button className="primary" style={{ marginTop:16 }} onClick={startNew}>+ Criar template</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {templates.map(t => {
            const meta = TYPE_META[t.type] || TYPE_META.custom;
            return (
              <div key={t.id} style={{ padding:'14px 18px', borderRadius:12, background:'var(--bg1)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{meta.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                    <div style={{ fontWeight:500, fontSize:13 }}>{t.name}</div>
                    {t.is_default && <span style={{ fontSize:9.5, padding:'1px 7px', borderRadius:10, background:'var(--blue-dim)', color:'var(--blue)', fontWeight:600 }}>padrão</span>}
                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:'var(--bg3)', color:'var(--text3)' }}>{t.language.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.subject}
                  </div>
                  <div style={{ fontSize:10, color: meta.color, marginTop:2 }}>{meta.label}</div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button className="ghost" style={{ fontSize:11, padding:'5px 10px' }} onClick={() => { startEdit(t); setPreview(true); }}>👁 Preview</button>
                  <button className="ghost" style={{ fontSize:11, padding:'5px 10px' }} onClick={() => startEdit(t)}>Editar</button>
                  <button className="ghost" style={{ fontSize:11, padding:'5px 10px', color:'var(--red)' }} onClick={() => handleDelete(t.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
