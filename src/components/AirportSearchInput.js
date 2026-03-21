import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import AirportRegisterModal from './AirportRegisterModal';

export default function AirportSearchInput({ value='', onChange, placeholder='ICAO ou nome do aeródromo', label, required=false, className='' }) {
  const [query, setQuery] = useState(value||'');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [selected, setSelected] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value !== query && !selected) setQuery(value||'');
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const upper = q.toUpperCase();
      const { data, error } = await supabase
        .from('airports_db')
        .select('id, icao, iata, name, city, state, type, lat, lng, elevation_ft, runway_length_ft, runway_surface, freq_tower, has_tower')
        .or(`icao.ilike.${upper}%,name.ilike.%${q}%,city.ilike.%${q}%`)
        .order('type', { ascending: false })
        .limit(10);
      if (!error && data) {
        const sorted = [...data].sort((a, b) => {
          const aE = a.icao?.toUpperCase()===upper ? 0 : a.icao?.toUpperCase().startsWith(upper) ? 1 : 2;
          const bE = b.icao?.toUpperCase()===upper ? 0 : b.icao?.toUpperCase().startsWith(upper) ? 1 : 2;
          return aE - bE;
        });
        setResults(sorted);
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    setSelected(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 280);
  };

  const handleSelect = (airport) => {
    setSelected(airport);
    setQuery(airport.icao || airport.name);
    // Mostrar IATA se disponível
    if (airport.iata) setQuery(airport.icao + (airport.iata ? ' / ' + airport.iata : ''));
    setOpen(false);
    setResults([]);
    if (onChange) onChange(airport.icao||'', airport);
  };

  const typeIcon = (t) => t === 'heliponto' ? '🚁' : t === 'public' ? '✈️' : '🛩️';
  const typeLabel = (t) => t === 'heliponto' ? 'Heliponto' : t === 'public' ? 'Público' : 'Privado';

  return (
    <div ref={containerRef} className={['airport-search-wrapper', className].filter(Boolean).join(' ')} style={{ position: 'relative' }}>
      {label && (
        <label className="airport-search-label">
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
      )}
      <div className="airport-search-input-row">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="airport-search-input"
        />
        {loading && <span className="airport-search-spinner">...</span>}
      </div>
      {open && (
        <div className="airport-search-dropdown">
          {results.length > 0 ? (
            <>
              {results.map(a => (
                <button key={a.id} type="button" className="airport-search-item" onClick={() => handleSelect(a)}>
                  <span className="airport-search-item-icon">{typeIcon(a.type)}</span>
                  <span className="airport-search-item-icao">{a.icao || '---'}</span>
                  <span className="airport-search-item-name">{a.name}</span>
                  <span className="airport-search-item-city">{[a.city, a.state].filter(Boolean).join(' / ')}</span>
                  <span className="airport-search-item-type">{typeLabel(a.type)}</span>
                  {(a.runway_length_ft || a.elevation_ft || a.has_tower) && (
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
                      {a.runway_length_ft && <span>▬ {Math.round(a.runway_length_ft/3.281)}m</span>}
                      {a.elevation_ft && <span>▲ {a.elevation_ft}ft</span>}
                      {a.has_tower && <span style={{color:'#10b981'}}>TWR</span>}
                    </span>
                  )}
                </button>
              ))}
              <button type="button" className="airport-search-not-found" onClick={() => { setOpen(false); setShowRegister(true); }}>
                + Não encontrou? Cadastrar novo aeródromo
              </button>
            </>
          ) : (
            !loading && (
              <div className="airport-search-empty">
                <p>Nenhum aeródromo encontrado para <strong>{query}</strong></p>
                <button type="button" className="airport-search-register-btn" onClick={() => { setOpen(false); setShowRegister(true); }}>
                  + Cadastrar novo aeródromo
                </button>
              </div>
            )
          )}
        </div>
      )}
      {showRegister && (
        <AirportRegisterModal
          initialName={query}
          onClose={() => setShowRegister(false)}
          onSuccess={(a) => { setShowRegister(false); if (a) handleSelect(a); }}
        />
      )}
    </div>
  );
}
