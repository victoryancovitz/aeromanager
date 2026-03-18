import React, { useState, useEffect, useRef } from 'react';
import { getUser, getSettings, saveSettings } from '../store';
import { supabase } from '../supabase';

const ROLES = ['Proprietário-Piloto','Proprietário','Piloto Comercial','Piloto Privado','Co-proprietário','Gerenciador de Frota','Mecânico','Outro'];

export default function UserProfile({ onClose }) {
  const [user,      setUser]      = useState(null);
  const [form,      setForm]      = useState({ fullName:'', role:'Proprietário-Piloto', anacCode:'', dob:'', nationality:'BR', phone:'', bio:'' });
  const [avatar,    setAvatar]    = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([getUser(), getSettings()]).then(([u, s]) => {
      setUser(u);
      if (s?.profile) { setForm(f => ({ ...f, ...s.profile })); if (s.profile.avatarUrl) setAvatar(s.profile.avatarUrl); }
      setLoading(false);
    });
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true); setError('');
    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now();
      setAvatar(url);
      setForm(f => ({ ...f, avatarUrl: url }));
    } catch(e) { setError('Erro no upload: ' + e.message); }
    setUploading(false);
  }

  async function handleRemoveAvatar() {
    if (!user) return;
    await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`,`${user.id}/avatar.png`,`${user.id}/avatar.webp`]).catch(()=>{});
    setAvatar(null); setForm(f => ({ ...f, avatarUrl: null }));
  }

  async function submit(e) {
    e.preventDefault();
    const s = await getSettings();
    await saveSettings({ ...s, profile: form });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando...</div>;

  const initials = form.fullName
    ? form.fullName.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div style={{ padding:'20px 24px', maxWidth:600 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button className="ghost" onClick={onClose}>← Voltar</button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:22 }}>Meu Perfil</div>
      </div>

      {error && <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', borderRadius:8, fontSize:12, color:'var(--red)' }}>{error}</div>}

      <form onSubmit={submit}>
        {/* Avatar */}
        <div className="card" style={{ padding:'20px 24px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <div style={{ width:84, height:84, borderRadius:'50%', overflow:'hidden', background:'var(--blue-dim)', border:'2.5px solid var(--blue-mid)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {avatar
                  ? <img src={avatar} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ fontFamily:'var(--font-serif)', fontSize:30, color:'var(--blue)' }}>{initials}</span>}
              </div>
              {uploading && (
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>⏳</div>
              )}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:18, marginBottom:2 }}>{form.fullName || 'Nome não configurado'}</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>{user?.email}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleAvatarChange} />
                <button type="button" className="ghost" style={{ fontSize:11, padding:'5px 12px' }} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  📷 {avatar ? 'Trocar foto' : 'Adicionar foto'}
                </button>
                {avatar && <button type="button" className="ghost" style={{ fontSize:11, padding:'5px 12px', color:'var(--red)' }} onClick={handleRemoveAvatar}>Remover</button>}
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>JPG, PNG ou WebP · máx. 5MB</div>
            </div>
          </div>
        </div>

        {/* Dados */}
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>Dados pessoais</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label>Nome completo</label><input value={form.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="Victor Yancovitz" /></div>
            <div><label>Função</label>
              <select value={form.role||''} onChange={e=>set('role',e.target.value)}>
                {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label>Data de nascimento</label><input type="date" value={form.dob||''} onChange={e=>set('dob',e.target.value)} /></div>
            <div><label>Telefone / WhatsApp</label><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="+55 19 99999-9999" /></div>
          </div>
          <div><label>Código ANAC / Habilitação</label><input value={form.anacCode||''} onChange={e=>set('anacCode',e.target.value)} placeholder="CHT-0012345" style={{ fontFamily:'var(--font-mono)' }} /></div>
        </div>

        {/* Bio */}
        <div className="card" style={{ padding:'16px 20px', marginBottom:18 }}>
          <label>Bio / Apresentação (opcional)</label>
          <textarea rows={3} value={form.bio||''} onChange={e=>set('bio',e.target.value)} placeholder="Ex: Piloto com 15 anos de experiência em aviação geral e viagens executivas..." />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button type="submit" className="primary" style={{ padding:'10px 28px' }}>✓ Salvar perfil</button>
          {saved && <span style={{ fontSize:12, color:'var(--green)' }}>✓ Salvo!</span>}
        </div>
      </form>
    </div>
  );
}
