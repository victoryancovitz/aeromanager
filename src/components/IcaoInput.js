import React, { useState, useEffect, useRef } from 'react';
import { searchAirports, getAirportByIcao } from '../airportsData';

export default function IcaoInput({ value, onChange, placeholder = 'SBGR', label, required }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const ref = useRef();

  useEffect(() => {
    setQuery(value || '');
    if (value) setInfo(getAirportByIcao(value));
  }, [value]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleChange(e) {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setQuery(v);
    onChange(v);
    setInfo(null);
    if (v.length >= 2) {
      const r = searchAirports(v);
      setResults(r);
      setOpen(r.length > 0);
    } else {
      setResults([]);
      setOpen(false);
    }
  }

  function select(ap) {
    setQuery(ap.icao);
    onChange(ap.icao);
    setInfo(ap);
    setOpen(false);
    setResults([]);
  }

  const typeIcon = { large_airport:'✈', medium_airport:'✈', small_airport:'🛩', military:'⚔', heliport:'🚁' };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {label && <label>{label}</label>}
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        style={{ fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'.05em' }}
      />
      {info && (
        <div style={{ fontSize:10, color:'var(--text3)', marginTop:3, fontFamily:'var(--font-mono)' }}>
          {info.name} · {info.city}{info.state ? `, ${info.state}` : ''}
          {info.elev ? ` · ${info.elev}ft` : ''}
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:200,
          background:'var(--bg1)', border:'1px solid var(--border2)',
          borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.3)',
          maxHeight:280, overflowY:'auto', marginTop:3,
        }}>
          {results.map(ap => (
            <div
              key={ap.icao}
              onClick={() => select(ap)}
              style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize:11 }}>{typeIcon[ap.type] || '✈'}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontSize:13, color:'var(--blue)' }}>{ap.icao}</span>
                  {ap.iata && <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>{ap.iata}</span>}
                  <span style={{ fontSize:12, color:'var(--text1)' }}>{ap.name}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
                  {ap.city}{ap.state ? `, ${ap.state}` : ''} {ap.country !== 'BR' ? `· ${ap.country}` : ''}
                  {ap.elev ? ` · ${ap.elev}ft` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
