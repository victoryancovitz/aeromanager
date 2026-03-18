import React from 'react';

// Arc gauge — cockpit instrument, theme-aware
export function ArcGauge({ value, max, label, unit, color = 'var(--blue)', size = 110, warning = 0.8, danger = 0.95, tooltip }) {
  const numValue = parseFloat(value) || 0;
  const numMax   = parseFloat(max) || 1;
  const pct      = Math.min(1, numValue / numMax);
  const r        = (size / 2) - 14;
  const cx = size / 2, cy = size / 2;
  const startAngle = -220, sweep = 260;
  const angle = startAngle + sweep * pct;

  function polar(deg, radius) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function arcPath(from, to, rad) {
    const s = polar(from, rad), e = polar(to, rad);
    const large = (to - from) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rad} ${rad} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const arcColor = pct >= danger ? 'var(--red)' : pct >= warning ? 'var(--amber)' : color;
  const needle   = polar(angle, r - 6);
  const display  = numValue % 1 === 0 ? numValue : parseFloat(numValue.toFixed(1));

  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', cursor: tooltip ? 'help' : 'default' }} title={tooltip || ''}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={arcPath(startAngle, startAngle+sweep, r)} fill="none" stroke="var(--bg3)" strokeWidth="6" strokeLinecap="round" />
      {pct > 0 && <path d={arcPath(startAngle, angle, r)} fill="none" stroke={arcColor} strokeWidth="6" strokeLinecap="round" />}
      <text x={cx} y={cy-3} textAnchor="middle" fill={arcColor} fontSize="14" fontWeight="400" fontFamily="var(--font-mono)">{display}</text>
      <text x={cx} y={cy+11} textAnchor="middle" fill="var(--text3)" fontSize="8.5" fontFamily="var(--font-body)" fontWeight="500" letterSpacing=".05em">{unit}</text>
      <text x={cx} y={size-5} textAnchor="middle" fill="var(--text3)" fontSize="8.5" fontFamily="var(--font-body)" fontWeight="500" letterSpacing=".08em">{label.toUpperCase()}</text>
      <circle cx={needle.x} cy={needle.y} r="2.5" fill={arcColor} />
    </svg>
    </div>
  );
}

// Progress bar — theme-aware
export function ProgressBar({ value, max, color = 'var(--blue)', height = 5 }) {
  const pct = Math.min(100, Math.max(0, (parseFloat(value)||0) / (parseFloat(max)||1) * 100));
  const c   = pct >= 90 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : color;
  return (
    <div style={{ background:'var(--bg3)', borderRadius:height, height, overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:height, transition:'width .4s ease' }} />
    </div>
  );
}

// KPI card — theme-aware (kept for backward compat, Dashboard uses inline now)
export function KpiCard({ label, value, sub, color = 'var(--blue)', onClick }) {
  return (
    <div onClick={onClick} style={{ background:'var(--bg1)', border:`1px solid var(--border)`, borderTop:`2px solid ${color}`, borderRadius:12, padding:'14px 16px', cursor:onClick?'pointer':'default', transition:'border-color .15s' }}>
      <div style={{ fontSize:9.5, color:'var(--text3)', fontWeight:500, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:400, color, fontFamily:'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, fontWeight:300 }}>{sub}</div>}
    </div>
  );
}

// Aircraft icon — theme-aware
export function AcIcon({ type, size = 36 }) {
  const colors = { single_engine:'var(--blue)', multi_engine:'var(--green)', experimental:'var(--amber)' };
  const hexBg  = { single_engine:'var(--blue-dim)', multi_engine:'var(--green-dim)', experimental:'var(--amber-dim)' };
  const c  = colors[type]  || 'var(--text3)';
  const bg = hexBg[type]   || 'var(--bg3)';
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.25, background:bg, border:`1px solid`, borderColor:'var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <svg width={size*0.55} height={size*0.55} viewBox="0 0 24 24" fill={c}>
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>
  );
}
