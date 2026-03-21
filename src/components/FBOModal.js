import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const FUEL_TYPES=[{value:'avgas_100ll',label:'Avgas 100LL'},{value:'jeta1',label:'Jet-A1'},{value:'avgas_80',label:'Avgas 80'},{value:'mogas',label:'Mogas'}];
const SERVICES=[{key:'has_avgas',label:'⛽ Avgas'},{key:'has_jeta1',label:'⛽ Jet-A1'},{key:'has_hangar',label:'🏭 Hangar'},{key:'has_parking_ramp',label:'🅿️ Pátio'},{key:'has_maintenance',label:'🔧 Manutenção'},{key:'has_customs',label:'🛃 Alfândega'},{key:'has_catering',label:'🍽️ Catering'},{key:'has_rental_car',label:'🚗 Carro'},{key:'has_crew_lounge',label:'🛋️ Crew lounge'},{key:'has_gpu',label:'🔌 GPU'},{key:'has_oxygen',label:'💨 Oxigênio'}];

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

  const latestFuel = FUEL_TYPES.map(ft=>{ const f=fuel.find(p=>p.fuel_type===ft.value); return f?{...ft,...f}:null; }).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:580}}>
        <div className="modal-header">
          <div><h2>🛬 {airport.icao} — {airport.name}</h2><p style={{margin:0,color:'#6b7280',fontSize:13}}>{[airport.city,airport.state].filter(Boolean).join(' / ')} · {airport.type==='public'?'Público':airport.type==='heliponto'?'Heliponto':'Privado'}</p></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="fbo-tabs">
          {['info','fbo','fuel'].map(t=><button key={t} className={`fbo-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t==='info'?'📋 Info':t==='fbo'?`🏢 FBOs (${fbos.length})`:'⛽ Combustível'}</button>)}
        </div>
        <div className="fbo-content">
          {loading?<div style={{textAlign:'center',padding:32,color:'#6b7280'}}>Carregando...</div>:(
            <>
              {tab==='info'&&(
                <div className="fbo-info-grid">
                  <div className="info-row"><span>ICAO</span><strong>{airport.icao||'—'}</strong></div>
                  <div className="info-row"><span>Nome</span><strong>{airport.name}</strong></div>
                  <div className="info-row"><span>Cidade</span><strong>{airport.city||'—'}</strong></div>
                  <div className="info-row"><span>UF</span><strong>{airport.state||'—'}</strong></div>
                  {airport.lat&&<div className="info-row"><span>Coords</span><strong>{airport.lat?.toFixed(4)}, {airport.lng?.toFixed(4)}</strong></div>}
                  {latestFuel.length>0&&<div className="info-fuel-summary"><p style={{fontWeight:600,marginBottom:6}}>⛽ Combustível (último registro)</p>{latestFuel.map(f=><div key={f.value} className="info-row"><span>{f.label}</span><strong>R$ {Number(f.price_brl_liter).toFixed(2)}/L</strong><span style={{color:'#9ca3af',fontSize:11}}>{f.price_date}</span></div>)}</div>}
                </div>
              )}
              {tab==='fbo'&&(
                <div>
                  {fbos.length===0?<div className="fbo-empty"><p>Nenhum FBO cadastrado ainda.</p><p>Seja o primeiro!</p></div>:
                    fbos.map(fbo=><div key={fbo.id} className="fbo-card">
                      <div className="fbo-card-header"><strong>{fbo.name}</strong>{fbo.verified&&<span className="badge-verified">✓ Verificado</span>}</div>
                      {fbo.hours_operation&&<p className="fbo-hours">🕐 {fbo.hours_operation}</p>}
                      {fbo.phone&&<p className="fbo-contact">📞 {fbo.phone}</p>}
                      {fbo.email&&<p className="fbo-contact">✉️ {fbo.email}</p>}
                      <div className="fbo-services">{SERVICES.filter(s=>fbo[s.key]).map(s=><span key={s.key} className="service-chip">{s.label}</span>)}</div>
                      {(fbo.landing_fee_brl||fbo.parking_fee_brl_hour||fbo.hangar_fee_brl_day)&&<div className="fbo-fees">{fbo.landing_fee_brl&&<span>🛬 Pouso: R$ {Number(fbo.landing_fee_brl).toFixed(0)}</span>}{fbo.parking_fee_brl_hour&&<span>🅿️ Pátio: R$ {Number(fbo.parking_fee_brl_hour).toFixed(0)}/h</span>}{fbo.hangar_fee_brl_day&&<span>🏭 Hangar: R$ {Number(fbo.hangar_fee_brl_day).toFixed(0)}/dia</span>}</div>}
                      {fbo.notes&&<p className="fbo-notes">{fbo.notes}</p>}
                    </div>)
                  }
                  <button className="btn-primary btn-full" onClick={()=>setShowFBO(true)}>➕ Cadastrar FBO</button>
                </div>
              )}
              {tab==='fuel'&&(
                <div>
                  {fuel.length===0?<div className="fbo-empty"><p>Nenhum preço registrado ainda.</p><p>Ajude a comunidade!</p></div>:
                    <div className="fuel-list">{fuel.map(fp=><div key={fp.id} className="fuel-row"><span className="fuel-type">{FUEL_TYPES.find(f=>f.value===fp.fuel_type)?.label||fp.fuel_type}</span><span className="fuel-price">R$ {Number(fp.price_brl_liter).toFixed(2)}/L</span><span className="fuel-date">{fp.price_date}</span>{fp.vendor&&<span className="fuel-vendor">{fp.vendor}</span>}</div>)}</div>
                  }
                  <button className="btn-primary btn-full" onClick={()=>setShowFuel(true)}>⛽ Reportar Preço</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showFBO&&<FBOForm airport={airport} onClose={()=>setShowFBO(false)} onSuccess={()=>{setShowFBO(false);load();}} />}
      {showFuel&&<FuelForm airport={airport} onClose={()=>setShowFuel(false)} onSuccess={()=>{setShowFuel(false);load();}} />}
    </div>
  );
}

function FBOForm({ airport, onClose, onSuccess }) {
  const [form, setForm] = useState({name:'',phone:'',email:'',hours_operation:'',notes:'',landing_fee_brl:'',parking_fee_brl_hour:'',hangar_fee_brl_day:''});
  const [services, setServices] = useState({});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggle=(k)=>setServices(s=>({...s,[k]:!s[k]}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const {data:{user}} = await supabase.auth.getUser();
      const {error} = await supabase.from('fbo').insert({airport_id:airport.id,created_by:user.id,name:form.name.trim(),phone:form.phone||null,email:form.email||null,hours_operation:form.hours_operation||null,notes:form.notes||null,landing_fee_brl:form.landing_fee_brl?parseFloat(form.landing_fee_brl):null,parking_fee_brl_hour:form.parking_fee_brl_hour?parseFloat(form.parking_fee_brl_hour):null,hangar_fee_brl_day:form.hangar_fee_brl_day?parseFloat(form.hangar_fee_brl_day):null,...services});
      if(error) throw error;
      onSuccess();
    } catch(err){alert(err.message);} finally{setSaving(false);}
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:520}}>
        <div className="modal-header"><h2>🏢 Cadastrar FBO — {airport.icao}</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group"><label>Nome do FBO / Operador *</label><input type="text" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Aeroporto Hangar SP" required /></div>
          <div className="form-row-2">
            <div className="form-group"><label>Telefone</label><input type="text" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="(11) 99999-9999" /></div>
            <div className="form-group"><label>E-mail</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Horário de funcionamento</label><input type="text" value={form.hours_operation} onChange={e=>set('hours_operation',e.target.value)} placeholder="Ex: 24h / 07h-19h" /></div>
          <div className="form-group">
            <label>Serviços disponíveis</label>
            <div className="services-grid">{SERVICES.map(s=><label key={s.key} className="service-toggle"><input type="checkbox" checked={!!services[s.key]} onChange={()=>toggle(s.key)} />{s.label}</label>)}</div>
          </div>
          <div className="form-row-3">
            <div className="form-group"><label>Pouso (R$)</label><input type="number" step="0.01" value={form.landing_fee_brl} onChange={e=>set('landing_fee_brl',e.target.value)} placeholder="0" /></div>
            <div className="form-group"><label>Pátio (R$/h)</label><input type="number" step="0.01" value={form.parking_fee_brl_hour} onChange={e=>set('parking_fee_brl_hour',e.target.value)} placeholder="0" /></div>
            <div className="form-group"><label>Hangar (R$/dia)</label><input type="number" step="0.01" value={form.hangar_fee_brl_day} onChange={e=>set('hangar_fee_brl_day',e.target.value)} placeholder="0" /></div>
          </div>
          <div className="form-group"><label>Observações</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} /></div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving?'Salvando...':'✅ Cadastrar FBO'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FuelForm({ airport, onClose, onSuccess }) {
  const [form, setForm] = useState({fuel_type:'avgas_100ll',price_brl_liter:'',vendor:'',price_date:new Date().toISOString().slice(0,10),notes:''});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.price_brl_liter) return;
    setSaving(true);
    try {
      const {data:{user}} = await supabase.auth.getUser();
      const {error} = await supabase.from('fbo_fuel_prices').insert({airport_id:airport.id,reported_by:user.id,fuel_type:form.fuel_type,price_brl_liter:parseFloat(form.price_brl_liter),price_date:form.price_date,vendor:form.vendor||null,notes:form.notes||null});
      if(error) throw error;
      onSuccess();
    } catch(err){alert(err.message);} finally{setSaving(false);}
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:400}}>
        <div className="modal-header"><h2>⛽ Reportar Combustível — {airport.icao}</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group"><label>Tipo</label><select value={form.fuel_type} onChange={e=>set('fuel_type',e.target.value)}>{FUEL_TYPES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
          <div className="form-row-2">
            <div className="form-group"><label>Preço (R$/litro) *</label><input type="number" step="0.01" value={form.price_brl_liter} onChange={e=>set('price_brl_liter',e.target.value)} placeholder="Ex: 8.90" required /></div>
            <div className="form-group"><label>Data</label><input type="date" value={form.price_date} onChange={e=>set('price_date',e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Fornecedor</label><input type="text" value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="Ex: Shell, Petrobras..." /></div>
          <div className="form-group"><label>Observações</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} /></div>
          <p style={{fontSize:12,color:'#6b7280'}}>ℹ️ Visível para todos os usuários do AeroManager.</p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving?'Enviando...':'✅ Reportar Preço'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
