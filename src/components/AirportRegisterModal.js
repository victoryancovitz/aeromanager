import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const STATES=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function AirportRegisterModal({ initialName='', onClose, onSuccess }) {
  const [form, setForm] = useState({ icao:'', name:initialName, city:'', state:'', lat:'', lng:'', type:'private', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (f,v) => setForm(p=>({...p,[f]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true); setError('');
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      const payload = { user_id:user.id, icao:form.icao.toUpperCase()||null, name:form.name.trim(), city:form.city.trim()||null, state:form.state||null, lat:form.lat?parseFloat(form.lat):null, lng:form.lng?parseFloat(form.lng):null, type:form.type, notes:form.notes.trim()||null, status:'pending' };
      const { error:reqErr } = await supabase.from('airport_requests').insert(payload);
      if (reqErr) throw reqErr;
      if (form.icao) {
        const { data:inserted } = await supabase.from('airports_db').insert({ icao:form.icao.toUpperCase(), name:form.name.trim(), city:form.city.trim()||null, state:form.state||null, lat:form.lat?parseFloat(form.lat):null, lng:form.lng?parseFloat(form.lng):null, type:form.type, anac_category:form.type, source:'user', verified:false, notes:'Cadastrado pelo usuário — aguardando verificação' }).select().single();
        if (inserted) { onSuccess?.(inserted); return; }
      }
      onSuccess?.({ icao:form.icao.toUpperCase()||null, name:form.name.trim(), _pending:true });
    } catch(err) { setError(err.message||'Erro ao cadastrar'); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:480}}>
        <div className="modal-header">
          <h2>✈️ Cadastrar Novo Aeródromo</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <p className="modal-hint">Preencha os dados. Com código OACI fica disponível imediatamente.</p>
          {error && <div className="form-error">{error}</div>}
          <div className="form-row-2">
            <div className="form-group">
              <label>Código OACI (ICAO)</label>
              <input type="text" value={form.icao} onChange={e=>set('icao',e.target.value.toUpperCase().slice(0,4))} placeholder="Ex: SBGR" maxLength={4} style={{textTransform:'uppercase',fontFamily:'monospace',letterSpacing:2}} />
              <span className="form-hint">Deixe vazio se não souber</span>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.type} onChange={e=>set('type',e.target.value)}>
                <option value="public">Público</option>
                <option value="private">Privado</option>
                <option value="heliponto">Heliponto</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Nome *</label><input type="text" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Fazenda Santa Maria" required /></div>
          <div className="form-row-2">
            <div className="form-group"><label>Município</label><input type="text" value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Ex: Campinas" /></div>
            <div className="form-group"><label>UF</label><select value={form.state} onChange={e=>set('state',e.target.value)}><option value="">—</option>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="form-row-2">
            <div className="form-group"><label>Latitude</label><input type="number" step="any" value={form.lat} onChange={e=>set('lat',e.target.value)} placeholder="-23.0000" /></div>
            <div className="form-group"><label>Longitude</label><input type="number" step="any" value={form.lng} onChange={e=>set('lng',e.target.value)} placeholder="-46.0000" /></div>
          </div>
          <div className="form-group"><label>Observações</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} placeholder="Informações adicionais..." /></div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving?'Cadastrando...':'✅ Cadastrar Aeródromo'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
