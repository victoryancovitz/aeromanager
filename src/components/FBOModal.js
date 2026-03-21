import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const FUEL_TYPES=[
  {value:'avgas_100ll',label:'Avgas 100LL'},
  {value:'jeta1',label:'Jet-A1'},
  {value:'avgas_80',label:'Avgas 80'},
  {value:'mogas',label:'Mogas'}
];
const SERVICES=[
  {key:'has_avgas',label:'Avgas'},{key:'has_jeta1',label:'Jet-A1'},
  {key:'has_hangar',label:'Hangar'},{key:'has_parking_ramp',label:'Pátio'},
  {key:'has_maintenance',label:'Manutenção'},{key:'has_customs',label:'Alfândega'},
  {key:'has_catering',label:'Catering'},{key:'has_rental_car',label:'Carro'},
  {key:'has_crew_lounge',label:'Crew lounge'},{key:'has_gpu',label:'GPU'},
  {key:'has_oxygen',label:'Oxigênio'}
];

export default function FBOModal({ airport, onClose }) {
  const [fbos, setFbos] = useState([]);
  const [fuel, setFuel] = useState([]);
  const [tab, setTab] = useState('info');
  const [showFBO, setShowFBO] = useState(false);
  const [showFuel, setShowFuel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ load(); },[airport.id]);

  const load = async () => {
    setLoading(true);
    const [f1,f2] = await Promise.all([
      supabase.from('fbo').select('*').eq('airport_id',airport.id).eq('is_active',true),
      supabase.from('fbo_fuel_prices').select('*').eq('airport_id',airport.id).order('price_date',{ascending:false}).limit(20)
    ]);
    setFbos(f1.data||[]); setFuel(f2.data||[]); setLoading(false);
  };

  const latestFuel = FUEL_TYPES.map(ft=>{
    const f=fuel.find(p=>p.fuel_type===ft.value);
    return f?{...ft,...f}:null;
  }).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:580}}>
        <div className="modal-header">
          <div>
            <h2>{airport.icao} – {airport.name}</h2>
            <p style={{margin:0,color:'#6b7280',fontSize:13}}>
              {[airport.city,airport.state].filter(Boolean).join(' / ')} · {airport.type==='public'?'Público':airport.type==='heliponto'?'Heliponto':'Privado'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="fbo-tabs">
          {['info','fbo','fuel'].map(t=>(
            <button key={t} className={['fbo-tab',tab===t?'active':''].join(' ')} onClick={()=>setTab(t)}>
              {t==='info'?'Info':t==='fbo'?'FBOs ('+fbos.length+')':'Combustível'}
            </button>
          ))}
        </div>
        <div className="fbo-content">
          {loading ? (
            <div style={{textAlign:'center',padding:32,color:'#6b7280'}}>Carregando...</div>
          ) : (
            <>
              {tab==='info' && (
                <div className="fbo-info-grid">
                  <div className="info-row"><span>ICAO</span><strong>{airport.icao||'---'}</strong></div>
                  <div className="info-row"><span>Nome</span><strong>{airport.name}</strong></div>
                  <div className="info-row"><span>Cidade</span><strong>{airport.city||'---'}</strong></div>
                  <div className="info-row"><span>UF</span><strong>{airport.state||'---'}</strong></div>
                  <div className="info-row"><span>Tipo</span><strong>{airport.type==='public'?'Público':airport.type==='heliponto'?'Heliponto':'Privado'}</strong></div>
                  {airport.lat && <div className="info-row"><span>Coordenadas</span><strong>{airport.lat?.toFixed(4)}, {airport.lng?.toFixed(4)}</strong></div>}
                </div>
              )}
              {tab==='fbo' && (
                <div>
                  {fbos.length === 0 ? (
                    <div className="fbo-empty">Nenhum FBO cadastrado para este aeródromo.</div>
                  ) : (
                    fbos.map(fbo=>(
                      <div key={fbo.id} className="fbo-card">
                        <strong>{fbo.name}</strong>
                        {fbo.phone && <span> · {fbo.phone}</span>}
                        {fbo.email && <span> · {fbo.email}</span>}
                        <div className="fbo-services">
                          {SERVICES.filter(s=>fbo[s.key]).map(s=>(
                            <span key={s.key} className="service-tag">{s.label}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  <button className="btn-secondary" style={{marginTop:12}} onClick={()=>setShowFBO(true)}>+ Cadastrar FBO</button>
                </div>
              )}
              {tab==='fuel' && (
                <div>
                  {latestFuel.length === 0 ? (
                    <div className="fbo-empty">Nenhum preço de combustível reportado ainda.</div>
                  ) : (
                    <table className="fuel-table">
                      <thead><tr><th>Combustível</th><th>Preço</th><th>Data</th><th>Fonte</th></tr></thead>
                      <tbody>
                        {latestFuel.map(f=>(
                          <tr key={f.value}>
                            <td>{f.label}</td>
                            <td>R$ {f.price_per_liter?.toFixed(2)}/L</td>
                            <td>{f.price_date}</td>
                            <td>{f.source||'---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button className="btn-secondary" style={{marginTop:12}} onClick={()=>setShowFuel(true)}>+ Reportar preço</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
