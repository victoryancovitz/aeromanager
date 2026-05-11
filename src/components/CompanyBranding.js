// CompanyBranding.js — configurações da empresa gestora (para cabeçalho de relatórios)
import React, { useState, useEffect } from 'react';
import { getCompanyProfile, saveCompanyProfile, uploadCompanyLogo } from '../store';

export default function CompanyBranding({ onClose }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    getCompanyProfile().then(c => { setForm(c); setLoading(false); });
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function onLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo deve ter no máximo 2 MB.'); return; }
    setUploadingLogo(true);
    try {
      const url = await uploadCompanyLogo(file);
      set('logo_url', url);
    } catch(err) { alert('Erro no upload: ' + err.message); }
    setUploadingLogo(false);
  }

  async function save() {
    setBusy(true);
    try {
      await saveCompanyProfile(form);
      alert('Configurações salvas.');
      onClose && onClose();
    } catch(err) { alert('Erro: ' + err.message); }
    setBusy(false);
  }

  if (loading || !form) return <div style={{ padding:24, color:'var(--text3)' }}>Carregando…</div>;

  return (
    <div style={{ padding:24, maxWidth:780 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        {onClose && <button className="ghost" onClick={onClose}>← Voltar</button>}
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Configurações da empresa</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Aparece no cabeçalho de todos os relatórios em PDF</div>
        </div>
      </div>

      <div className="card" style={{ padding:'18px 22px', marginBottom:14 }}>
        <div className="section-title">Logotipo</div>
        <div style={{ display:'flex', gap:18, alignItems:'center', marginTop:8 }}>
          <div style={{ width:120, height:120, background:'var(--bg1)', border:'1px dashed var(--border2)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {form.logo_url ? (
              <img src={form.logo_url} alt="logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
            ) : (
              <span style={{ fontSize:11, color:'var(--text3)' }}>sem logo</span>
            )}
          </div>
          <div style={{ flex:1 }}>
            <label className="primary" style={{ display:'inline-block', padding:'8px 14px', borderRadius:6, cursor:'pointer', fontSize:13 }}>
              {uploadingLogo ? 'Enviando…' : (form.logo_url ? '🔄 Trocar logo' : '⬆ Carregar logo')}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogoFile} style={{ display:'none' }} disabled={uploadingLogo} />
            </label>
            {form.logo_url && (
              <button onClick={() => set('logo_url','')} style={{ marginLeft:8, fontSize:12 }}>Remover</button>
            )}
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>PNG, JPG, WebP ou SVG · máximo 2 MB · proporção ideal 3:1 ou quadrada</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding:'18px 22px', marginBottom:14 }}>
        <div className="section-title">Dados da empresa</div>
        <div className="g2" style={{ marginBottom:14 }}>
          <div><label>Razão social / Nome fantasia</label><input value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Yancovitz Aviation Management" /></div>
          <div><label>CNPJ</label><input value={form.cnpj||''} onChange={e=>set('cnpj',e.target.value)} placeholder="00.000.000/0001-00" /></div>
        </div>
        <div className="g2" style={{ marginBottom:14 }}>
          <div><label>Telefone</label><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="+55 61 99999-9999" /></div>
          <div><label>E-mail</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="contato@empresa.com" /></div>
        </div>
        <div style={{ marginBottom:14 }}><label>Endereço completo</label><input value={form.address||''} onChange={e=>set('address',e.target.value)} placeholder="SHCGN 712, Bloco F · Brasília · DF · CEP 70760-636" /></div>
        <div className="g2">
          <div><label>Website</label><input value={form.website||''} onChange={e=>set('website',e.target.value)} placeholder="https://yancovitz.aero" /></div>
          <div><label>Cor primária (HEX)</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="color" value={form.primary_color||'#4a9eff'} onChange={e=>set('primary_color',e.target.value)} style={{ width:44, height:32, padding:2, cursor:'pointer' }} />
              <input value={form.primary_color||'#4a9eff'} onChange={e=>set('primary_color',e.target.value)} style={{ flex:1 }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding:'18px 22px', marginBottom:20 }}>
        <div className="section-title">Texto de rodapé</div>
        <textarea value={form.footer_text||''} onChange={e=>set('footer_text',e.target.value)}
          placeholder="Documento confidencial. Gerado automaticamente pelo AeroManager. Sujeito a auditoria."
          style={{ minHeight:72 }} />
        <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>Aparece no rodapé de cada página do PDF.</div>
      </div>

      <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', borderTop:'1px solid var(--bg2)', display:'flex', gap:10 }}>
        <button className="primary" onClick={save} disabled={busy}>{busy?'Salvando…':'Salvar configurações'}</button>
        {onClose && <button onClick={onClose}>Cancelar</button>}
      </div>
    </div>
  );
}
