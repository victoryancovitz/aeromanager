import React, { useState, useEffect } from 'react';
import { seedDemoData, resetAllData } from '../seedData';
import { getAircraft } from '../store';

export default function SeedDataBanner({ onDone, onStartOnboarding }) {
  const [hasData,    setHasData]    = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [showReset,  setShowReset]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [mode,       setMode]       = useState('');
  const [progress,   setProgress]   = useState([]);
  const [done,       setDone]       = useState('');
  const [error,      setError]      = useState('');
  const [dismissed,  setDismissed]  = useState(
    () => localStorage.getItem('am_seed_dismissed') === '1'
  );

  useEffect(() => {
    getAircraft().then(l => setHasData((l?.length || 0) > 0)).catch(() => {});
  }, []);

  async function runSeed() {
    setLoading(true); setMode('seed'); setProgress([]); setError('');
    try {
      const res = await seedDemoData(msg => setProgress(p => [...p, msg]));
      setDone(`✓ Criados: ${res.aircraft} aeronaves, ${res.flights} voos, ${res.costs} custos, ${res.maintenance} MX, ${res.crew} tripulantes`);
      setTimeout(() => { setExpanded(false); onDone?.(); }, 2500);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  async function runReset() {
    setLoading(true); setMode('reset'); setProgress([]); setError('');
    try {
      await resetAllData(msg => setProgress(p => [...p, msg]));
      setDone('✓ Todos os dados apagados.');
      setHasData(false);
      setShowReset(false);
      setTimeout(() => {
        setDone('');
        onDone?.();
        // Chama o wizard de onboarding após reset
        onStartOnboarding?.();
      }, 1800);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  function dismiss() {
    localStorage.setItem('am_seed_dismissed', '1');
    setDismissed(true);
  }

  // ── Modal de confirmação de reset ─────────────────────────
  if (showReset) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--red-mid)', borderRadius:16, maxWidth:460, width:'100%', padding:28 }}>
        <div style={{ fontSize:36, textAlign:'center', marginBottom:14 }}>⚠️</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:20, textAlign:'center', marginBottom:8 }}>
          Resetar todos os dados?
        </div>
        <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.8, textAlign:'center', marginBottom:20 }}>
          Esta ação apaga <strong style={{ color:'var(--red)' }}>permanentemente</strong> todas as aeronaves, voos, custos, manutenção, tripulação e missões.<br/>
          <strong>Não pode ser desfeita.</strong>
        </div>

        {/* Aviso: wizard será aberto após reset */}
        {!done && (
          <div style={{ marginBottom:18, padding:'10px 16px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:10, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:20, flexShrink:0 }}>✈</span>
            <div style={{ fontSize:12, color:'var(--blue)', lineHeight:1.6 }}>
              <strong>Após o reset</strong>, o assistente de cadastro será aberto automaticamente para guiar você no cadastro da sua primeira aeronave real.
            </div>
          </div>
        )}

        {error && <div style={{ fontSize:12, color:'var(--red)', marginBottom:10, textAlign:'center' }}>{error}</div>}

        {loading && progress.length > 0 && (
          <div style={{ marginBottom:12, background:'var(--bg2)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'var(--text2)', maxHeight:100, overflowY:'auto', fontFamily:'var(--font-mono)' }}>
            {progress.map((p,i) => <div key={i}>{p}</div>)}
          </div>
        )}

        {done ? (
          <div>
            <div style={{ padding:'12px 14px', background:'var(--green-dim)', border:'1px solid var(--green-mid)', borderRadius:8, fontSize:12, color:'var(--green)', textAlign:'center', marginBottom:10 }}>
              {done}
            </div>
            <div style={{ padding:'10px 14px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:8, fontSize:12, color:'var(--blue)', textAlign:'center' }}>
              🧭 Abrindo assistente de cadastro...
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', gap:10 }}>
            <button className="destructive" onClick={runReset} disabled={loading} style={{ flex:1, padding:'12px', fontSize:13 }}>
              {loading ? '⏳ Apagando...' : '🗑 Sim, apagar tudo'}
            </button>
            <button onClick={() => { setShowReset(false); setError(''); }} disabled={loading} style={{ flex:1, padding:'12px', fontSize:13 }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Versão mínima (dismissed) ─────────────────────────────
  if (dismissed) return (
    <div style={{ margin:'8px 24px 0', display:'flex', gap:6 }}>
      <button onClick={() => setShowReset(true)}
        style={{ fontSize:11, padding:'4px 10px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', color:'var(--red)', borderRadius:7, cursor:'pointer' }}>
        🗑 Resetar dados
      </button>
    </div>
  );

  // ── Banner colapsado (tem dados) ──────────────────────────
  if (hasData && !expanded) return (
    <div style={{ margin:'10px 24px 0', display:'flex', gap:6, alignItems:'center' }}>
      <button onClick={() => setExpanded(true)}
        style={{ fontSize:11, padding:'5px 12px', background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text3)', borderRadius:8, cursor:'pointer' }}>
        ✦ Carregar dados de exemplo
      </button>
      <button onClick={() => setShowReset(true)}
        style={{ fontSize:11, padding:'5px 12px', background:'var(--red-dim)', border:'1px solid var(--red-mid)', color:'var(--red)', borderRadius:8, cursor:'pointer' }}>
        🗑 Resetar dados
      </button>
      <button onClick={dismiss}
        style={{ fontSize:10, padding:'4px 8px', background:'transparent', border:'none', color:'var(--text4)', cursor:'pointer' }}>✕</button>
    </div>
  );

  // ── Banner expandido ──────────────────────────────────────
  return (
    <div style={{ margin:'14px 24px 0', padding:'16px 18px', background:'var(--blue-dim)', border:'1px solid var(--blue-mid)', borderRadius:12 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
        <div style={{ fontSize:22, flexShrink:0 }}>✈</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:15, color:'var(--text1)', marginBottom:4 }}>Carregar dados de exemplo</div>
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:12 }}>
            Cria <strong style={{ color:'var(--text1)' }}>4 aeronaves</strong> (Extra 300/SC, Seneca V, PC-12, G550) com tripulação completa, voos, histórico de custos e itens de manutenção.
            {hasData && <span style={{ color:'var(--amber)', display:'block', marginTop:4 }}>⚠ Seus dados existentes não serão apagados.</span>}
          </div>

          {error && <div style={{ fontSize:11, color:'var(--red)', marginBottom:8 }}>{error}</div>}
          {done  && <div style={{ fontSize:11, color:'var(--green)', marginBottom:8 }}>{done}</div>}

          {loading && progress.length > 0 && (
            <div style={{ marginBottom:10, background:'var(--bg2)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'var(--text2)', maxHeight:120, overflowY:'auto', fontFamily:'var(--font-mono)' }}>
              {progress.map((p,i) => <div key={i}>{p}</div>)}
            </div>
          )}

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="primary" onClick={runSeed} disabled={loading} style={{ fontSize:12 }}>
              {loading && mode==='seed' ? '⏳ Carregando...' : '✦ Adicionar dados de exemplo'}
            </button>
            <button onClick={() => setShowReset(true)} disabled={loading}
              style={{ fontSize:12, background:'var(--red-dim)', border:'1px solid var(--red-mid)', color:'var(--red)', cursor:'pointer', padding:'8px 14px', borderRadius:8 }}>
              🗑 Resetar todos os dados
            </button>
            <button style={{ fontSize:12, cursor:'pointer', padding:'8px 14px', borderRadius:8, background:'transparent', border:'1px solid var(--border)', color:'var(--text3)' }}
              onClick={dismiss} disabled={loading}>Não mostrar mais</button>
            {hasData && (
              <button style={{ fontSize:12, cursor:'pointer', padding:'8px 14px', borderRadius:8, background:'transparent', border:'1px solid var(--border)', color:'var(--text3)' }}
                onClick={() => setExpanded(false)} disabled={loading}>Fechar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
