import React, { useState, useEffect } from 'react';
import { signIn, signUp } from '../store';
import { supabase } from '../supabase';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [betaToken, setBetaToken] = useState('');
  const [betaInvite, setBetaInvite] = useState(null);
  const [checkingToken, setCheckingToken] = useState(false);

  // Detectar token beta na URL ao carregar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('beta_token');
    const emailParam = params.get('email');
    if (token) {
      setBetaToken(token);
      if (emailParam) setEmail(decodeURIComponent(emailParam));
      setMode('signup');
      validateBetaToken(token, emailParam);
    }
  }, []);

  async function validateBetaToken(token, emailParam) {
    if (!token) return;
    setCheckingToken(true);
    try {
      const { data, error } = await supabase
        .from('beta_invites')
        .select('name, email, profile_type, status, expires_at')
        .eq('token', token)
        .single();
      if (!error && data) {
        const expired = new Date(data.expires_at) < new Date();
        if (expired || data.status === 'expired') {
          setError('Este convite expirou. Solicite um novo convite.');
        } else {
          setBetaInvite(data);
          if (data.name && !name) setName(data.name);
          if (data.email && !email) setEmail(data.email);
        }
      }
    } catch (_) {}
    setCheckingToken(false);
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        // Cadastro — salvar nome nos metadados
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              beta_token: betaToken || null,
              profile_type: betaInvite?.profile_type || 'owner_pilot',
            }
          }
        });
        if (signUpError) throw signUpError;

        // Marcar convite como aceito
        if (betaToken) {
          await supabase
            .from('beta_invites')
            .update({ status: 'accepted', accepted_at: new Date().toISOString() })
            .eq('token', betaToken);
        }
        setDone(true);
      }
    } catch (err) {
      setError(
        err.message.includes('Invalid login') ? 'Email ou senha incorretos.' :
        err.message.includes('already registered') ? 'Este email já possui uma conta. Faça login.' :
        err.message.includes('Password') ? 'A senha deve ter pelo menos 6 caracteres.' :
        err.message
      );
    }
    setLoading(false);
  }

  const S = {
    page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#080d18', backgroundImage:'radial-gradient(ellipse at 20% 50%, rgba(29,78,216,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.06) 0%, transparent 50%)' },
    wrap: { width:'100%', maxWidth:400 },
    card: { background:'rgba(15,23,42,0.95)', border:'1px solid #1e2d4a', borderRadius:20, padding:'32px 36px', backdropFilter:'blur(20px)', boxShadow:'0 32px 80px rgba(0,0,0,0.6)' },
    input: { width:'100%', padding:'11px 14px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:10, color:'#f1f5f9', fontSize:14, outline:'none', boxSizing:'border-box', transition:'border-color .15s' },
    label: { display:'block', fontSize:11, color:'#64748b', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' },
    btn: { width:'100%', padding:'13px', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', transition:'all .15s', boxShadow:'0 4px 20px rgba(29,78,216,0.35)' },
  };

  // Tela de confirmação de email
  if (done) return (
    <div style={S.page}>
      <div style={{ ...S.wrap, textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:20 }}>✉️</div>
        <h2 style={{ color:'#f1f5f9', fontSize:22, fontWeight:700, margin:'0 0 12px' }}>Confirme seu email</h2>
        <p style={{ color:'#64748b', fontSize:14, lineHeight:1.7, margin:'0 0 24px' }}>
          Enviamos um link de confirmação para<br/>
          <strong style={{ color:'#93c5fd' }}>{email}</strong>.<br/>
          Abra o email e clique no link para ativar sua conta.
        </p>
        <button style={{ ...S.btn, maxWidth:240 }} onClick={() => { setDone(false); setMode('login'); }}>
          Voltar para o login
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 32px rgba(29,78,216,0.4)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:400, color:'#f1f5f9', margin:'0 0 4px', letterSpacing:'.02em' }}>AeroManager</h1>
          <p style={{ color:'#475569', fontSize:12, margin:0, letterSpacing:'.05em', textTransform:'uppercase', fontWeight:500 }}>
            {mode === 'login' ? 'Bem-vindo de volta' : betaInvite ? '✦ Acesso Beta Exclusivo' : 'Criar nova conta'}
          </p>
        </div>

        {/* Badge beta */}
        {betaInvite && mode === 'signup' && (
          <div style={{ background:'linear-gradient(135deg,rgba(29,78,216,0.15),rgba(124,58,237,0.15))', border:'1px solid rgba(29,78,216,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🎟️</span>
            <div>
              <p style={{ margin:'0 0 2px', color:'#93c5fd', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Convite beta válido</p>
              <p style={{ margin:0, color:'#cbd5e1', fontSize:13, fontWeight:600 }}>{betaInvite.profile_type === 'owner_pilot' ? 'Proprietário-Piloto' : betaInvite.profile_type === 'co_owner' ? 'Co-proprietário' : betaInvite.profile_type === 'manager' ? 'Gestora' : betaInvite.profile_type === 'authorized_pilot' ? 'Piloto Autorizado' : 'Beta Tester'}</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div style={S.card}>
          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#fca5a5', marginBottom:20 }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={submit}>
            {/* Nome — só no cadastro */}
            {mode === 'signup' && (
              <div style={{ marginBottom:16 }}>
                <label style={S.label}>Nome completo</label>
                <input
                  type="text" required value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  style={S.input}
                  onFocus={e => e.target.style.borderColor='#3b82f6'}
                  onBlur={e => e.target.style.borderColor='#1e3a5f'}
                />
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{ ...S.input, ...(betaInvite ? { color:'#64748b', cursor:'not-allowed' } : {}) }}
                readOnly={!!betaInvite}
                onFocus={e => { if (!betaInvite) e.target.style.borderColor='#3b82f6'; }}
                onBlur={e => e.target.style.borderColor='#1e3a5f'}
              />
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={S.label}>Senha</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => {}} style={{ background:'none', border:'none', color:'#3b82f6', fontSize:11, cursor:'pointer', padding:0 }}>Esqueci a senha</button>
                )}
              </div>
              <input
                type="password" required minLength={6} value={password}
                onChange={e => setPass(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                style={S.input}
                onFocus={e => e.target.style.borderColor='#3b82f6'}
                onBlur={e => e.target.style.borderColor='#1e3a5f'}
              />
            </div>

            <button type="submit" disabled={loading || checkingToken} style={{ ...S.btn, opacity:(loading || checkingToken) ? 0.6 : 1 }}>
              {loading ? '⏳ Aguarde...' : checkingToken ? 'Verificando convite...' : mode === 'login' ? '→ Entrar' : '🚀 Criar minha conta'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#334155' }}>
            {mode === 'login' ? (
              <>Não tem conta?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }} style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  Criar agora
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  Fazer login
                </button>
              </>
            )}
          </div>
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:11, color:'#1e2d4a' }}>
          Seus dados ficam seguros na nuvem · Acesso em qualquer dispositivo 🇧🇷
        </p>
      </div>
    </div>
  );
}
