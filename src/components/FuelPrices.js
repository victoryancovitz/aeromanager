import React, { useState, useEffect, useMemo } from 'react';
import { getFuelPrices, recordFuelPrice } from '../store';

const FUEL_TYPES = { avgas_100ll:'AVGAS 100LL', mogas:'MOGAS', jet_a1:'JET-A1' };
const VENDORS = ['Air BP','BR Aviation','Shell','Raízen','Posto local','Outros'];

export default function FuelPrices({ aircraft }) {
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ icao:'', vendor:'', fuelType:'avgas_100ll', pricePerLiter:'', liters:'', date:new Date().toISOString().slice(0,10), notes:'' });
  const [allPrices, setAllPrices] = useState([]);

  useEffect(() => {
    getFuelPrices().then(data => setAllPrices(data || [])).catch(() => setAllPrices([]));
  }, []);

  const all = allPrices.sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const airports = useMemo(() => {
    const map = {};
    all.forEach(p => {
      if (!map[p.icao]) map[p.icao] = [];
      map[p.icao].push(p);
    });
    return Object.entries(map).map(([icao, entries]) => {
      const last = entries[0];
      const avg6 = entries.filter(e=>{ const d=new Date(e.date); const cut=new Date(); cut.setMonth(cut.getMonth()-6); return d>=cut; });
      const avgPrice = avg6.length > 0 ? avg6.reduce((s,e)=>s+parseFloat(e.pricePerLiter),0)/avg6.length : parseFloat(last.pricePerLiter);
      const minPrice = Math.min(...entries.map(e=>parseFloat(e.pricePerLiter)));
      const maxPrice = Math.max(...entries.map(e=>parseFloat(e.pricePerLiter)));
      const trend = entries.length >= 2 ? parseFloat(entries[0].pricePerLiter) - parseFloat(entries[1].pricePerLiter) : 0;
      return { icao, entries, last, avgPrice, minPrice, maxPrice, trend };
    }).filter(a=>!filter || a.icao.includes(filter.toUpperCase()) || a.entries.some(e=>e.vendor?.toLowerCase().includes(filter.toLowerCase())));
  }, [all, filter]);

  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  async function submit(e) {
    e.preventDefault();
    if (!form.icao || !form.pricePerLiter) return;
    await recordFuelPrice({ icao:form.icao.toUpperCase(), vendor:form.vendor, fuelType:form.fuelType, pricePerLiter:parseFloat(form.pricePerLiter), liters:parseFloat(form.liters)||0, date:form.date, notes:form.notes });
    setShowAdd(false);
    setForm(f=>({...f,icao:'',pricePerLiter:'',liters:'',notes:''}));
    const data = await getFuelPrices();
    setAllPrices(data || []);
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Histórico de Combustível</div>
          <div style={{ color:'#9aa0b8', fontSize:12, marginTop:2 }}>{airports.length} aeroporto(s) com histórico · {all.length} registro(s) total</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input placeholder="Filtrar ICAO ou fornecedor..." value={filter} onChange={e=>setFilter(e.target.value)} style={{ width:220 }} />
          <button className="primary" onClick={()=>setShowAdd(v=>!v)}>+ Lançar preço</button>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:20, borderColor:'#4a9eff44' }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:14, color:'#4a9eff' }}>Novo lançamento de preço de combustível</div>
          <form onSubmit={submit}>
            <div className="g3" style={{ marginBottom:14 }}>
              <div><label>Aeródromo (ICAO) *</label><input required value={form.icao} onChange={e=>set('icao',e.target.value.toUpperCase())} placeholder="SDCO" maxLength={4} /></div>
              <div><label>Tipo *</label><select value={form.fuelType} onChange={e=>set('fuelType',e.target.value)}>{Object.entries(FUEL_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
              <div><label>Data *</label><input type="date" required value={form.date} onChange={e=>set('date',e.target.value)} /></div>
            </div>
            <div className="g3" style={{ marginBottom:14 }}>
              <div><label>Preço por litro (R$) *</label><input type="number" required step="0.01" value={form.pricePerLiter} onChange={e=>set('pricePerLiter',e.target.value)} placeholder="8.50" /></div>
              <div><label>Litros abastecidos</label><input type="number" step="0.1" value={form.liters} onChange={e=>set('liters',e.target.value)} placeholder="80" /></div>
              <div><label>Fornecedor</label>
                <select value={form.vendor} onChange={e=>set('vendor',e.target.value)}>
                  <option value="">Selecione...</option>
                  {VENDORS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
              <button type="submit" className="primary">Salvar</button>
              <button type="button" onClick={()=>setShowAdd(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {airports.length === 0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'#5a6080' }}>
          <div style={{ fontSize:28, marginBottom:12 }}>⛽</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Nenhum histórico de preços</div>
          <div style={{ fontSize:12, marginBottom:16 }}>Os preços são registrados automaticamente a cada voo com abastecimento, ou você pode lançar manualmente</div>
          <button className="primary" onClick={()=>setShowAdd(true)}>Lançar primeiro preço</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
          {airports.map(({ icao, entries, last, avgPrice, minPrice, maxPrice, trend }) => (
            <div key={icao} className="card" style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:'#1e2230', border:'1px solid #2e3448', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:'#4a9eff' }}>{icao}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{icao}</div>
                  <div style={{ fontSize:11, color:'#9aa0b8' }}>{entries.length} registro(s) · Último: {new Date(last.date+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700, color: trend > 0.05 ? '#ff5252' : trend < -0.05 ? '#3dd68c' : '#e8eaf0' }}>
                    R$ {parseFloat(last.pricePerLiter).toFixed(2).replace('.',',')}
                  </div>
                  <div style={{ fontSize:10, color: trend > 0.05 ? '#ff5252' : trend < -0.05 ? '#3dd68c' : '#5a6080' }}>
                    {trend > 0.05 ? `▲ +R$${trend.toFixed(2)}` : trend < -0.05 ? `▼ -R$${Math.abs(trend).toFixed(2)}` : '— estável'}
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                {[['Média 6m',`R$ ${avgPrice.toFixed(2).replace('.',',')}`,'#9aa0b8'],['Mínimo hist.',`R$ ${minPrice.toFixed(2).replace('.',',')}`,'#3dd68c'],['Máximo hist.',`R$ ${maxPrice.toFixed(2).replace('.',',')}`,'#ff5252']].map(([l,v,c])=>(
                  <div key={l} style={{ background:'#1e2230', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:'#5a6080', marginBottom:3, textTransform:'uppercase', letterSpacing:'.04em' }}>{l}</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600, color:c }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop:'1px solid #1e2230', paddingTop:10 }}>
                {entries.slice(0,4).map((e, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid #0f1117', fontSize:11 }}>
                    <div style={{ color:'#5a6080', width:70 }}>{new Date(e.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>
                    <div style={{ color:'#9aa0b8', flex:1 }}>{e.vendor||'—'} · {FUEL_TYPES[e.fuelType]||e.fuelType}</div>
                    {e.liters > 0 && <div style={{ color:'#5a6080' }}>{e.liters}L</div>}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color: parseFloat(e.pricePerLiter) <= minPrice+0.05 ? '#3dd68c' : parseFloat(e.pricePerLiter) >= maxPrice-0.05 ? '#ff5252' : '#e8eaf0' }}>
                      R$ {parseFloat(e.pricePerLiter).toFixed(2).replace('.',',')}
                    </div>
                  </div>
                ))}
                {entries.length > 4 && <div style={{ fontSize:11, color:'#5a6080', textAlign:'center', paddingTop:6 }}>+{entries.length-4} registros anteriores</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
