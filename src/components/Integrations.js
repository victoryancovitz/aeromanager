import React, { useState, useEffect, useRef } from 'react';
import { importForeFlight, importPlaneItCSV, getAircraft, getSettings, saveSettings } from '../store';
import AircraftDBManager from './AircraftDBManager';

export default function Integrations({ reload }) {
  const [aircraft, setAircraft] = useState([]);
  const [selectedAc, setSelectedAc] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState('');
  const [importType, setImportType] = useState('foreflight');
  const [settings, setSettings] = useState({ apiKey:'', fuelUnit:'liters', currency:'BRL', anacCredentials:{}, integrations:{} });
  const [showAnac, setShowAnac] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    getAircraft().then(data => { setAircraft(data||[]); if(data?.length) setSelectedAc(data[0].id); });
    getSettings().then(s => setSettings(s)).catch(()=>{});
  }, []);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !selectedAc) return;
    setLoading(importType);
    try {
      const text = await file.text();
      const count = importType === 'foreflight' ? await importForeFlight(text, selectedAc) : await importPlaneItCSV(text, selectedAc);
      reload();
      setStatus({ type: 'success', msg: `✓ ${count} voo(s) importado(s) com sucesso de ${file.name}` });
    } catch (err) {
      setStatus({ type: 'error', msg: `Erro: ${err.message}` });
    }
    setLoading(''); e.target.value = '';
  }

  async function saveAnacSettings() {
    await saveSettings({ ...settings });
    setShowAnac(false);
    setStatus({ type: 'success', msg: 'Configurações ANAC salvas.' });
  }

  const integrations = [
    {
      id: 'foreflight', name: 'ForeFlight', logo: '✈', color: '#4a9eff', status: 'available',
      description: 'Importe seu logbook do ForeFlight via exportação CSV. Preenche automaticamente tempo de voo, condições VFR/IFR e rotas.',
      steps: ['No ForeFlight: Logbook → ≡ → Export → CSV', 'Envie o arquivo para o Mac por AirDrop, iCloud ou cabo', 'Selecione a aeronave e clique em Importar'],
    },
    {
      id: 'planeit', name: 'PlaneIT', logo: '📋', color: '#3dd68c', status: 'available',
      description: 'Importe do PlaneIT — diário de bordo digital homologado pela ANAC. Formato CSV separado por ponto-e-vírgula.',
      steps: ['No PlaneIT: Exportar registros em CSV', 'Confirme que o separador é ponto-e-vírgula (;)', 'Selecione a aeronave e importe'],
    },
    {
      id: 'wader', name: 'Wader', logo: '🌤', color: '#9b6dff', status: 'coming',
      description: 'Importe planos de voo do Wader — meteorologia e planejamento. Compare planejado vs. realizado para calcular fuel bias.',
    },
    {
      id: 'garmin', name: 'Garmin Pilot', logo: '🛰', color: '#f5a623', status: 'coming',
      description: 'Importação de logbook e dados de performance do Garmin Pilot via CSV.',
    },
    {
      id: 'opensky', name: 'OpenSky ADS-B', logo: '📡', color: '#00d4ff', status: 'coming',
      description: 'Importação automática de rotas via ADS-B público do OpenSky Network.',
    },
    {
      id: 'redemet', name: 'REDEMET / DECEA', logo: '⛅', color: '#3dd68c', status: 'coming',
      description: 'Meteorologia aeronáutica brasileira — METARs, TAFs, SIGMETs em tempo real.',
    },
  ];

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Integrações</div>
        <div style={{ color:'#9aa0b8', fontSize:12 }}>Conecte o AeroManager ao seu ecossistema de aviação</div>
      </div>

      {status && (
        <div className={`alert ${status.type==='success'?'alert-success':'alert-danger'}`} style={{ marginBottom:20 }}>
          <span>{status.msg}</span>
          <button className="ghost" style={{ marginLeft:'auto', padding:'0 6px', fontSize:12 }} onClick={()=>setStatus(null)}>✕</button>
        </div>
      )}

      {/* ANAC DBE */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:20, borderColor:'#ff525244' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#ff525211', border:'1px solid #ff525244', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🇧🇷</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>ANAC — Diário de Bordo Eletrônico (DBE)</div>
            <div style={{ fontSize:11, color:'#9aa0b8', marginTop:2 }}>API oficial — Resolução ANAC nº 458/2017</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:600, background:'#3d2800', color:'#f5a623', border:'1px solid #f5a62344' }}>Pronto para configurar</span>
            <button style={{ fontSize:11, padding:'5px 12px' }} onClick={()=>setShowAnac(v=>!v)}>⚙ Configurar</button>
          </div>
        </div>
        <div style={{ fontSize:12, color:'#9aa0b8', marginBottom:showAnac?12:0, lineHeight:1.6 }}>
          O AeroManager está pronto para integração com a API DBE da ANAC. Quando configurado, cada voo registrado será enviado automaticamente à ANAC, atualizando o diário de bordo oficial e a CIV Digital do piloto.
        </div>
        {showAnac && (
          <div style={{ background:'#1e2230', borderRadius:8, padding:'14px 16px', marginTop:8 }}>
            <div style={{ fontSize:12, color:'#9aa0b8', marginBottom:12, lineHeight:1.6 }}>
              Para ativar, você precisa de credenciais da ANAC. Solicite enviando email para <span style={{ color:'#4a9eff' }}>dbdigital@anac.gov.br</span> com assunto "Solicitação de Credencial TEMPORÁRIA para a API Diário de Bordo – Homologação" incluindo nome, CNPJ/CPF, endereço, nome do preposto e telefone.
            </div>
            <div className="g3" style={{ marginBottom:12 }}>
              <div><label>Ambiente</label>
                <select value={settings.anacCredentials?.ambiente||'homologacao'} onChange={e=>setSettings(s=>({...s,anacCredentials:{...s.anacCredentials,ambiente:e.target.value}}))}>
                  <option value="homologacao">Homologação (testes)</option>
                  <option value="producao">Produção</option>
                </select>
              </div>
              <div><label>Usuário (CNPJ/CPF)</label>
                <input value={settings.anacCredentials?.usuario||''} onChange={e=>setSettings(s=>({...s,anacCredentials:{...s.anacCredentials,usuario:e.target.value}}))} placeholder="Usuario fornecido pela ANAC" />
              </div>
              <div><label>Senha</label>
                <input type="password" value={settings.anacCredentials?.senha||''} onChange={e=>setSettings(s=>({...s,anacCredentials:{...s.anacCredentials,senha:e.target.value}}))} placeholder="Senha fornecida pela ANAC" />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="primary" style={{ fontSize:12 }} onClick={saveAnacSettings}>Salvar credenciais</button>
              <button style={{ fontSize:12 }} onClick={()=>setShowAnac(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Other integrations */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:16 }}>
        {integrations.map(int => (
          <div key={int.id} className="card" style={{ padding:'18px 20px', borderTop:`2px solid ${int.color}44` }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:`${int.color}22`, border:`1px solid ${int.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{int.logo}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{int.name}</div>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:600, background:int.status==='available'?`${int.color}22`:'#2e344888', color:int.status==='available'?int.color:'#5a6080', border:`1px solid ${int.status==='available'?int.color+'44':'#3d456044'}` }}>
                  {int.status==='available'?'✓ Disponível':'⏳ Em breve'}
                </span>
              </div>
            </div>
            <div style={{ fontSize:12, color:'#9aa0b8', marginBottom:12, lineHeight:1.6 }}>{int.description}</div>
            {int.status==='available' && int.steps && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:'#5a6080', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Como exportar</div>
                {int.steps.map((s, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:5, fontSize:11, color:'#9aa0b8' }}>
                    <span style={{ color:int.color, fontWeight:700, minWidth:14 }}>{i+1}.</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {int.status==='available' && (
              aircraft.length > 0 ? (
                <>
                  <div style={{ marginBottom:8 }}>
                    <label>Aeronave destino</label>
                    <select value={selectedAc} onChange={e=>setSelectedAc(e.target.value)} style={{ fontSize:12 }}>
                      {aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration} — {ac.model}</option>)}
                    </select>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleFile} />
                  <button className="primary" style={{ width:'100%', fontSize:12 }} disabled={!!loading||!selectedAc} onClick={()=>{ setImportType(int.id); setTimeout(()=>fileRef.current?.click(),50); }}>
                    {loading===int.id?'Importando…':`📂 Importar CSV do ${int.name}`}
                  </button>
                </>
              ) : <div className="alert alert-info" style={{ fontSize:11 }}><span>Cadastre uma aeronave primeiro</span></div>
            )}
          </div>
        ))}
      </div>

      <AircraftDBManager />

      <div className="card" style={{ marginTop:20, padding:'16px 20px' }}>
        <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Formato dos arquivos CSV</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, fontSize:12, color:'#9aa0b8' }}>
          <div>
            <div style={{ color:'#4a9eff', fontWeight:600, marginBottom:6 }}>ForeFlight — separado por vírgula</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#5a6080', background:'#1e2230', padding:'8px 10px', borderRadius:6 }}>
              "Date","From","To","TotalTime","Day","Night","ActualInstrument","Remarks"<br/>
              "2026-03-14","SBBR","SBGR","2.2","2.2","0","0","VFR ok"
            </div>
          </div>
          <div>
            <div style={{ color:'#3dd68c', fontWeight:600, marginBottom:6 }}>PlaneIT — separado por ponto-e-vírgula</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#5a6080', background:'#1e2230', padding:'8px 10px', borderRadius:6 }}>
              Data;Origem;Destino;Horas Voadas;Combustivel;Obs<br/>
              2026-03-14;SBBR;SBGR;2.2;80;VFR ok
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
