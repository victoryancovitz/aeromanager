import React, { useState } from 'react';
import { signIn, signUp } from '../store';

export default function Login() {
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setDone(true);
      }
    } catch (err) {
      setError(err.message.includes('Invalid login') ? 'Email ou senha incorretos.' : err.message);
    }
    setLoading(false);
  }

  if (done) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ maxWidth:360, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>✉️</div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Confirme seu email</div>
        <div style={{ fontSize:13, color:'#9aa0b8', lineHeight:1.6 }}>
          Enviamos um link de confirmação para <strong style={{ color:'#e8eaf0' }}>{email}</strong>. Abra o email e clique no link para ativar sua conta.
        </div>
        <button style={{ marginTop:20, width:'100%' }} onClick={() => { setDone(false); setMode('login'); }}>
          Voltar para o login
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#0f1117' }}>
      <div style={{ width:'100%', maxWidth:380 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:'#185fa5', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:26, fontWeight:400, color:'var(--text1)', letterSpacing:'.02em' }}>AeroManager</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:4, fontWeight:300, letterSpacing:'.03em' }}>
            {mode === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
          </div>
        </div>

        {/* Card */}
        <div style={{ background:'#161920', border:'1px solid #2e3448', borderRadius:14, padding:'28px 28px' }}>
          {error && (
            <div style={{ background:'#2a0d0d', border:'1px solid #ff525244', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#ff8080', marginBottom:16 }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, color:'#9aa0b8', marginBottom:6, fontWeight:500 }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{ width:'100%', padding:'10px 14px', background:'#1e2230', border:'1px solid #2e3448', borderRadius:8, color:'#e8eaf0', fontSize:13 }}
              />
            </div>
            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', fontSize:11, color:'#9aa0b8', marginBottom:6, fontWeight:500 }}>Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPass(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                style={{ width:'100%', padding:'10px 14px', background:'#1e2230', border:'1px solid #2e3448', borderRadius:8, color:'#e8eaf0', fontSize:13 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width:'100%', padding:'12px', background:'#185fa5', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:18, fontSize:12, color:'#5a6080' }}>
            {mode === 'login' ? (
              <>Não tem conta?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }} style={{ background:'none', border:'none', color:'#4a9eff', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                  Criar agora
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} style={{ background:'none', border:'none', color:'#4a9eff', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                  Fazer login
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'#3d4560' }}>
          Seus dados ficam seguros na nuvem — acessíveis em qualquer dispositivo
        </div>
      </div>
    </div>
  );
}
