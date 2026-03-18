import React, { useState, useEffect, useRef } from 'react';

export default function NotificationBell({ maintenance = [], aircraft = [], crew = [], documents = [], setPage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build notifications
  const notifications = [];
  const now = new Date();

  // MX alerts
  maintenance.forEach(m => {
    const ac = aircraft.find(a => a.id === m.aircraftId);
    const reg = ac?.registration || '?';
    const currentH = parseFloat(ac?.baseAirframeHours||0) + parseFloat(ac?.totalFlightHours||0);

    let isDeferred = false;
    if (m.deferredUntilDate || m.deferredUntilHours) {
      const dateOk  = !m.deferredUntilDate  || new Date(m.deferredUntilDate) > now;
      const hoursOk = !m.deferredUntilHours || parseFloat(m.deferredUntilHours) > currentH;
      isDeferred = dateOk && hoursOk;
    }
    if (isDeferred) return;

    // Hours overdue / due soon
    if (m.nextDueHours) {
      const hLeft = parseFloat(m.nextDueHours) - currentH;
      if (hLeft <= 0) {
        notifications.push({ id:`mx-h-${m.id}`, level:'danger', title:`MX vencida — ${reg}`, body:`${m.name} venceu há ${Math.abs(hLeft).toFixed(0)}h`, page:'maintenance' });
      } else if (hLeft <= 20) {
        notifications.push({ id:`mx-h-soon-${m.id}`, level:'warning', title:`MX próxima — ${reg}`, body:`${m.name} vence em ${hLeft.toFixed(0)}h`, page:'maintenance' });
      }
    }

    // Calendar overdue / due soon
    if (m.nextDueDate) {
      const dLeft = Math.ceil((new Date(m.nextDueDate) - now) / 86400000);
      if (dLeft <= 0) {
        notifications.push({ id:`mx-d-${m.id}`, level:'danger', title:`MX vencida — ${reg}`, body:`${m.name} venceu há ${Math.abs(dLeft)} dia(s)`, page:'maintenance' });
      } else if (dLeft <= 30) {
        notifications.push({ id:`mx-d-soon-${m.id}`, level:'warning', title:`MX próxima — ${reg}`, body:`${m.name} vence em ${dLeft} dia(s)`, page:'maintenance' });
      }
    }
  });

  // Crew document expiry
  documents.forEach(doc => {
    if (!doc.expiryDate) return;
    const dLeft = Math.ceil((new Date(doc.expiryDate) - now) / 86400000);
    const member = crew.find(c => c.id === doc.crewMemberId);
    const name = member?.displayName || member?.fullName || '?';
    const docLabel = { medical:'CMA', license:'Licença ANAC', passport:'Passaporte', type_rating:'Habilitação', recurrent:'Recorrente', id_card:'RG/ID' }[doc.docType] || doc.docType;

    if (dLeft <= 0) {
      notifications.push({ id:`doc-${doc.id}`, level:'danger', title:`Documento vencido — ${name}`, body:`${docLabel} venceu há ${Math.abs(dLeft)} dia(s)`, page:'crew' });
    } else if (dLeft <= 60) {
      notifications.push({ id:`doc-soon-${doc.id}`, level:'warning', title:`Documento expirando — ${name}`, body:`${docLabel} vence em ${dLeft} dia(s)`, page:'crew' });
    }
  });

  // Deduplicate (hours + calendar can both fire for same item)
  const seen = new Set();
  const unique = notifications.filter(n => {
    const key = n.title + n.body;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dangerCount  = unique.filter(n => n.level === 'danger').length;
  const warningCount = unique.filter(n => n.level === 'warning').length;
  const totalCount   = unique.length;

  const badgeColor = dangerCount > 0 ? 'var(--red)' : warningCount > 0 ? 'var(--amber)' : null;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, color:'var(--text2)', display:'flex', alignItems:'center', justifyContent:'center' }}
        title="Notificações"
      >
        {/* Bell icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalCount > 0 && (
          <span style={{
            position:'absolute', top:2, right:2,
            minWidth:16, height:16, borderRadius:8,
            background: badgeColor,
            color:'#fff', fontSize:9, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'0 3px', lineHeight:1,
          }}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:300,
          width:320, maxHeight:420, overflowY:'auto',
          background:'var(--bg1)', border:'1px solid var(--border2)',
          borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.25)',
        }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600, color:'var(--text2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Notificações</span>
            {totalCount > 0 && <span style={{ fontSize:10, color:'var(--text3)' }}>{totalCount} alerta{totalCount>1?'s':''}</span>}
          </div>

          {unique.length === 0 ? (
            <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--text3)', fontSize:12 }}>
              <div style={{ fontSize:24, marginBottom:8, opacity:.5 }}>✓</div>
              Tudo em dia!
            </div>
          ) : unique.map(n => (
            <div
              key={n.id}
              onClick={() => { setPage(n.page); setOpen(false); }}
              style={{
                padding:'10px 16px', borderBottom:'1px solid var(--border)',
                cursor:'pointer', display:'flex', gap:10, alignItems:'flex-start',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:5,
                background: n.level === 'danger' ? 'var(--red)' : 'var(--amber)',
              }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', marginBottom:2 }}>{n.title}</div>
                <div style={{ fontSize:11, color:'var(--text2)' }}>{n.body}</div>
              </div>
              <span style={{ fontSize:10, color:'var(--text3)', flexShrink:0, marginTop:2 }}>→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
