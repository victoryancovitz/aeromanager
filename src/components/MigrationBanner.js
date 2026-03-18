import React, { useState, useEffect } from 'react';
import { migrateFromLocalStorage } from '../store';

function hasLocalData() {
  try {
    const ac = JSON.parse(localStorage.getItem('am3_aircraft') || '[]');
    return ac.length > 0;
  } catch { return false; }
}

export default function MigrationBanner({ onDone }) {
  const [show, setShow]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (hasLocalData()) setShow(true);
  }, []);

  if (!show) return null;

  async function migrate() {
    setLoading(true);
    setError('');
    try {
      const r = await migrateFromLocalStorage();
      setResult(r);
      // Clear localStorage after successful migration
      ['am3_aircraft','am3_flights','am3_costs','am3_maint','am3_missions','am3_fuel_prices','am3_settings'].forEach(k => localStorage.removeItem(k));
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  }

  if (result) return (
    <div style={{ margin:'20px 24px', background:'#0d3320', border:'1px solid #3dd68c44', borderRadius:12, padding:'16px 20px' }}>
      <div style={{ fontWeight:700, color:'#3dd68c', marginBottom:8 }}>✓ Migração concluída!</div>
      <div style={{ fontSize:12, color:'#9aa0b8', marginBottom:12 }}>
        Seus dados foram transferidos para a nuvem com sucesso.
      </div>
      <div style={{ display:'flex', gap:16, fontSize:12, color:'#9aa0b8', marginBottom:14 }}>
        {Object.entries({ 'Aeronaves': result.aircraft, 'Voos': result.flights, 'Custos': result.costs, 'Manutenções': result.maintenance }).map(([k,v]) => (
          <span key={k}><span style={{ color:'#3dd68c', fontWeight:600 }}>{v}</span> {k}</span>
        ))}
      </div>
      <button className="primary" style={{ fontSize:12 }} onClick={() => { setShow(false); onDone(); }}>
        Recarregar dados
      </button>
    </div>
  );

  return (
    <div style={{ margin:'20px 24px', background:'#3d2800', border:'1px solid #f5a62344', borderRadius:12, padding:'16px 20px' }}>
      <div style={{ fontWeight:700, color:'#f5a623', marginBottom:6 }}>Dados locais encontrados</div>
      <div style={{ fontSize:12, color:'#9aa0b8', marginBottom:12, lineHeight:1.6 }}>
        Você tem dados salvos neste navegador de uma versão anterior. Deseja migrá-los para sua conta na nuvem? Os dados ficarão disponíveis em todos os seus dispositivos.
      </div>
      {error && <div style={{ fontSize:11, color:'#ff8080', marginBottom:10 }}>{error}</div>}
      <div style={{ display:'flex', gap:10 }}>
        <button className="primary" style={{ fontSize:12 }} onClick={migrate} disabled={loading}>
          {loading ? 'Migrando...' : 'Migrar dados para a nuvem'}
        </button>
        <button style={{ fontSize:12 }} onClick={() => setShow(false)}>
          Ignorar
        </button>
      </div>
    </div>
  );
}
