import { Tip } from '../App';
import React, { useState } from 'react';
import { saveMaintenance, deleteMaintenance } from '../store';
import { useMultiSelect } from '../hooks/useMultiSelect';

const MxTimeline = React.lazy(() => import('./MaintenanceTimeline'));
const OilView    = React.lazy(() => import('./OilTracking'));

const TYPES = [{v:'inspection',l:'Inspeção'},{v:'ad',l:'AD (Diretiva)'},{v:'sb',l:'Service Bulletin'},{v:'component',l:'Componente c/ vida útil'},{v:'overhaul',l:'Revisão geral (OH)'}];
const EMPTY = { aircraftId:'', itemType:'inspection', name:'', intervalHours:'', intervalDays:'', lastDoneHours:'', lastDoneDate:'', nextDueHours:'', nextDueDate:'', status:'current', estimatedCostBrl:'', notes:'', deferredUntilDate:'', deferredUntilHours:'', deferralRef:'' };

export default function Maintenance({ maintenance=[], aircraft=[], reload, initialTab='list' }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [filterAc, setFilterAc] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState(initialTab); // 'list' | 'timeline' | 'oil'
  const ms = useMultiSelect(maintenance); // hook sempre no mesmo lugar

  function startNew() { setForm({...EMPTY, aircraftId:aircraft[0]?.id||''}); setEditing('new'); }
  function startEdit(m) { setForm({...m}); setEditing(m.id); }
  function cancel() { setEditing(null); }
  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  async function submit(e) { e.preventDefault(); await saveMaintenance(form); reload(); setEditing(null); }
  async function remove(id) { if(window.confirm('Remover item?')){ await deleteMaintenance(id); reload(); } }

  const enriched = maintenance
    .filter(m=>!filterAc||m.aircraftId===filterAc)
    .map(m=>{
      const ac=aircraft.find(a=>a.id===m.aircraftId);
      const currentHours=parseFloat(ac?.baseAirframeHours||0)+(ac?.totalFlightHours||0);
      let isDeferred = false;
      if (m.deferredUntilDate || m.deferredUntilHours) {
        const dateOk = !m.deferredUntilDate || new Date(m.deferredUntilDate) > new Date();
        const hoursOk = !m.deferredUntilHours || parseFloat(m.deferredUntilHours) > currentHours;
        isDeferred = dateOk && hoursOk;
      }
      let status=m.status;
      if (!isDeferred) {
        if(m.nextDueHours){const r=parseFloat(m.nextDueHours)-currentHours;status=r<=0?'overdue':r<=10?'due_soon':'current';}
        if(m.nextDueDate){const d=Math.ceil((new Date(m.nextDueDate)-new Date())/86400000);if(d<=0)status='overdue';else if(d<=30&&status!=='overdue')status='due_soon';}
      } else { status='deferred'; }
      return {...m,status,aircraft:ac,isDeferred};
    })
    .sort((a,b)=>{ const o={overdue:0,due_soon:1,current:2,deferred:3}; return (o[a.status]??2)-(o[b.status]??2); });

  async function bulkDelete() {
    const n = ms.count;
    if (!window.confirm(`Remover ${n} item${n>1?'s':''} de manutenção?`)) return;
    setDeleting(true);
    for (const id of ms.selectedIds) await deleteMaintenance(id);
    ms.clear(); reload(); setDeleting(false);
  }

  const counts = { overdue:enriched.filter(m=>m.status==='overdue').length, due_soon:enriched.filter(m=>m.status==='due_soon').length, current:enriched.filter(m=>m.status==='current').length, deferred:enriched.filter(m=>m.status==='deferred').length };
  const costPreview = enriched.filter(m=>m.status==='overdue'||m.status==='due_soon').reduce((s,m)=>s+parseFloat(m.estimatedCostBrl||0),0);

  if (editing!==null) return (
    <div style={{ padding:24, maxWidth:600 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="ghost" onClick={cancel}>← Voltar</button>
        <div style={{ fontSize:16, fontWeight:700 }}>Item de manutenção</div>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Identificação</div>
          <div className="g2" style={{ marginBottom:14 }}>
            <div><label>Aeronave *</label><select required value={form.aircraftId} onChange={e=>set('aircraftId',e.target.value)}><option value="">Selecione...</option>{aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration}</option>)}</select></div>
            <div><label>Tipo *</label><select required value={form.itemType} onChange={e=>set('itemType',e.target.value)}>{TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:14 }}><label>Nome / Descrição *</label><input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Inspeção 100 horas, AD 2023-15-01" /></div>
          <div className="g2">
            <div><label>Custo estimado (R$)</label><input type="number" step="0.01" value={form.estimatedCostBrl} onChange={e=>set('estimatedCostBrl',e.target.value)} placeholder="2800" /></div>
            <div><label>Status</label><select value={form.status} onChange={e=>set('status',e.target.value)}><option value="current"><Tip text="Item dentro do prazo — horas ou data da próxima manutenção ainda não foram atingidas.">Em dia</Tip></option><option value="due_soon">Próximo</option><option value="overdue">Vencido</option><option value="deferred">Diferido</option></select></div>
          </div>
        </div>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Último cumprimento</div>
          <div className="g2">
            <div><label>Horas da aeronave</label><input type="number" step="0.1" value={form.lastDoneHours} onChange={e=>set('lastDoneHours',e.target.value)} placeholder="1195" /></div>
            <div><label>Data</label><input type="date" value={form.lastDoneDate} onChange={e=>set('lastDoneDate',e.target.value)} /></div>
          </div>
        </div>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <div className="section-title">Próximo vencimento</div>
          <div className="g3" style={{ marginBottom:14 }}>
            <div><label>Intervalo (horas)</label><input type="number" step="0.1" value={form.intervalHours} onChange={e=>set('intervalHours',e.target.value)} placeholder="100" /></div>
            <div><label>Intervalo (dias)</label><input type="number" value={form.intervalDays} onChange={e=>set('intervalDays',e.target.value)} placeholder="365" /></div>
            <div></div>
          </div>
          <div className="g2">
            <div><label>Vence em (horas)</label><input type="number" step="0.1" value={form.nextDueHours} onChange={e=>set('nextDueHours',e.target.value)} placeholder="1295" /></div>
            <div><label>Vence em (data)</label><input type="date" value={form.nextDueDate} onChange={e=>set('nextDueDate',e.target.value)} /></div>
          </div>
        </div>
        <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <label>Notas</label>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Referência ao manual, mecânico responsável..." />
        </div>
        <div className="card" style={{ padding:'16px 20px', marginBottom:20, borderLeft:'3px solid var(--amber-mid)' }}>
          <div className="section-title" style={{ color:'var(--amber)' }}>⏸ Diferimento</div>
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, lineHeight:1.6 }}>
            Diferir um item permite adiar temporariamente um vencimento com base em aprovação técnica ou regulatória. O item volta a ser calculado normalmente quando o prazo ou horas do diferimento forem atingidos.
          </div>
          <div className="g3" style={{ marginBottom:10 }}>
            <div><label>Diferido até (data)</label><input type="date" value={form.deferredUntilDate||''} onChange={e=>set('deferredUntilDate',e.target.value)} /></div>
            <div><label>Diferido até (horas)</label><input type="number" step="0.1" value={form.deferredUntilHours||''} onChange={e=>set('deferredUntilHours',e.target.value)} placeholder="1350" /></div>
            <div><label>Ref. aprovação</label><input value={form.deferralRef||''} onChange={e=>set('deferralRef',e.target.value)} placeholder="MEL item 28-1, AME nº 042" /></div>
          </div>
          {(form.deferredUntilDate||form.deferredUntilHours) && (
            <button type="button" className="ghost" style={{ fontSize:11 }} onClick={()=>{ set('deferredUntilDate',''); set('deferredUntilHours',''); set('deferralRef',''); }}>
              ✕ Remover diferimento
            </button>
          )}
        </div>
        <div style={{ position:'sticky', bottom:0, background:'var(--bg0)', padding:'12px 0', marginTop:4, display:'flex', gap:10, borderTop:'1px solid var(--bg2)' }}>
          <button type="submit" className="primary">Salvar</button>
          <button type="button" onClick={cancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ padding:24 }}>
      {ms.count > 0 && (
        <div className="bulk-bar">
          <input type="checkbox" checked={ms.allSelected} onChange={ms.toggleAll} style={{ width:15, height:15 }} />
          <span>{ms.count} item{ms.count>1?'s':''} selecionado{ms.count>1?'s':''}</span>
          <button className="destructive" onClick={bulkDelete} disabled={deleting} style={{ fontSize:12, padding:'5px 14px' }}>
            {deleting ? 'Removendo...' : `🗑 Remover ${ms.count}`}
          </button>
          <button className="ghost" onClick={ms.clear} style={{ fontSize:12 }}>Cancelar</button>
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:400 }}>Gestão de Manutenção</div>
          <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{maintenance.length} item(ns) · Custo pendente: <span style={{ color:'var(--amber)', fontFamily:'var(--font-mono)' }}>R$ {Math.round(costPreview).toLocaleString('pt-BR')}</span></div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* View tabs */}
          <div style={{ display:'flex', background:'var(--bg2)', borderRadius:8, padding:3, gap:2 }}>
            {[['list','☰ Lista'],['timeline','📅 Timeline'],['oil','🛢 Óleo']].map(([v,l]) => (
              <button type="button" key={v} onClick={()=>setView(v)} style={{ padding:'5px 11px', borderRadius:6, border:'none', fontSize:11, fontWeight:500, cursor:'pointer', background:view===v?'var(--bg1)':'transparent', color:view===v?'var(--text1)':'var(--text3)', boxShadow:view===v?'0 1px 3px rgba(0,0,0,.15)':'' }}>{l}</button>
            ))}
          </div>
          {aircraft.length>1 && <select value={filterAc} onChange={e=>setFilterAc(e.target.value)} style={{ width:180 }}><option value="">Todas aeronaves</option>{aircraft.map(ac=><option key={ac.id} value={ac.id}>{ac.registration}</option>)}</select>}
          {aircraft.length>0 && view==='list' && <button className="primary" onClick={startNew}>+ Novo item</button>}
        </div>
      </div>

      <div className="g4" style={{ marginBottom:20 }}>
        {[
          {label:'Vencidos',   count:counts.overdue,  color:'var(--red)',    bg:'var(--red-dim)',    border:'var(--red-mid)'},
          {label:'Próximos',   count:counts.due_soon, color:'var(--amber)',  bg:'var(--amber-dim)',  border:'var(--amber-mid)'},
          {label:'Em dia',     count:counts.current,  color:'var(--green)',  bg:'var(--green-dim)',  border:'var(--green-mid)'},
          {label:'Diferidos',  count:counts.deferred, color:'var(--purple)', bg:'var(--purple-dim)', border:'var(--purple-mid)'},
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:28, fontWeight:400, color:s.color, fontFamily:'var(--font-mono)' }}>{s.count}</div>
            <div style={{ fontSize:11, color:s.color, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {view === 'list' && (maintenance.length===0 ? (
        <div className="card" style={{ padding:'40px 20px', textAlign:'center', color:'var(--text3)' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔧</div>
          <div style={{ fontWeight:600 }}>Nenhum item cadastrado</div>
          {aircraft.length>0 && <button className="primary" style={{ marginTop:16 }} onClick={startNew}>Cadastrar primeiro item</button>}
        </div>
      ) : enriched.map(m=>{
        const sc = m.status==='overdue'
          ? {color:'var(--red)',   bg:'var(--red-dim)',   border:'var(--red-mid)',   label:'VENCIDO',
             tip:'Este item passou das horas ou da data prevista. Requer atenção antes do próximo voo.'}
          : m.status==='due_soon'
          ? {color:'var(--amber)', bg:'var(--amber-dim)', border:'var(--amber-mid)', label:'PRÓXIMO',
             tip:'Vencimento próximo — planeje a manutenção para não passar da data ou horas previstas.'}
          : m.status==='deferred'
          ? {color:'var(--purple)',bg:'var(--purple-dim)',border:'var(--purple-mid)', label:'DIFERIDO'}
          : {color:'var(--green)', bg:'transparent',      border:'var(--border)',    label:'Em dia',
             tip:'Item dentro do prazo — horas ou data da próxima manutenção ainda não foram atingidas.'};
        const isSel = ms.isSelected(m.id);
        return (
          <div key={m.id} style={{ background: isSel ? 'var(--blue-dim)' : sc.bg, border:`1px solid ${isSel ? 'var(--blue-mid)' : sc.border}`, borderRadius:10, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
            <input type="checkbox" checked={isSel} onChange={()=>ms.toggle(m.id)} style={{ width:14, height:14, flexShrink:0 }} />
            <div style={{ width:8, height:8, borderRadius:'50%', background:sc.color, boxShadow:m.status!=='current'?`0 0 5px ${sc.color}`:'none', flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:500, fontSize:13, color:'var(--text1)' }}>{m.name}</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>
                {m.aircraft?.registration} · {TYPES.find(t=>t.v===m.itemType)?.l}
                {m.nextDueHours && ` · Vence ${m.nextDueHours}h`}
                {m.nextDueDate && ` · ${new Date(m.nextDueDate+'T12:00:00').toLocaleDateString('pt-BR')}`}
              </div>
              {m.isDeferred && (
                <div style={{ fontSize:10, color:'var(--purple)', marginTop:3, display:'flex', gap:8 }}>
                  <span>⏸ Diferido</span>
                  {m.deferredUntilDate && <span>até {new Date(m.deferredUntilDate+'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  {m.deferredUntilHours && <span>até {m.deferredUntilHours}h</span>}
                  {m.deferralRef && <span>· {m.deferralRef}</span>}
                </div>
              )}
              {m.notes && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{m.notes}</div>}
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:10, fontWeight:700, color:sc.color, padding:'2px 8px', background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:8, marginBottom:4, cursor:sc.tip?'help':'default' }} title={sc.tip||''}>{sc.label}</div>
              {m.estimatedCostBrl && <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--font-mono)' }}>R$ {parseFloat(m.estimatedCostBrl).toLocaleString('pt-BR')}</div>}
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>startEdit(m)}>Editar</button>
              <button className="danger" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>remove(m.id)}>✕</button>
            </div>
          </div>
        );
      })
      )}

      {view === 'timeline' && (
        <React.Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando...</div>}>
          <MxTimeline maintenance={enriched.filter(m => !filterAc || m.aircraftId === filterAc)} aircraft={aircraft} />
        </React.Suspense>
      )}

      {view === 'oil' && (
        <React.Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Carregando...</div>}>
          <OilView aircraft={aircraft.filter(a => !filterAc || a.id === filterAc)} />
        </React.Suspense>
      )}
    </div>
  );
}
