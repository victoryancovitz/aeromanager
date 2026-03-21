import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';

/**
 * AircraftSearchInput — autocomplete de aeronave usando o RAB/ANAC (34.000+ prefixos)
 * Ao selecionar, preenche automaticamente fabricante, modelo, motor, ano, etc.
 * Props:
 *   value: string (PR-VCO)
 *   onChange(registration, aircraftData): callback
 *   placeholder: string
 *   label: string
 *   required: bool
 */
export default function AircraftSearchInput({ value='', onChange, placeholder='PR-VCO ou PP-XYZ', label, required=false, className='' }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value !== query && !selected) setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const upper = q.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const { data, error } = await supabase
        .from('aircraft_rab')
        .select('matricula, fabricante, modelo, tipo_icao, ano_fabricacao, motor_modelo, motor_quantidade, lotacao, peso_max_decolagem_kg, uf_operador, situacao, categoria')
        .ilike('matricula', `${upper}%`)
        .in('situacao', ['RBAC 91', 'RBAC 135', 'RBAC 121'])
        .limit(8);
      if (!error && data && data.length > 0) {
        setResults(data);
        setOpen(true);
      } else if (!error) {
        // Busca mais ampla ignorando situação
        const { data: data2 } = await supabase
          .from('aircraft_rab')
          .select('matricula, fabricante, modelo, tipo_icao, ano_fabricacao, motor_modelo, motor_quantidade, lotacao, peso_max_decolagem_kg, uf_operador, situacao, categoria')
          .ilike('matricula', `${upper}%`)
          .limit(8);
        setResults(data2 || []);
        setOpen((data2 || []).length > 0);
      }
    } finally { setLoading(false); }
  }, []);

  const handleInput = (e) => {
    const q = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8);
    setQuery(q); setSelected(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 250);
  };

  const handleSelect = (ac) => {
    setSelected(ac);
    setQuery(ac.matricula);
    setOpen(false); setResults([]);
    onChange?.(ac.matricula, ac);
  };

  const situacaoBadge = (s) => {
    if (!s) return null;
    const colors = { 'RBAC 91': '#10b981', 'RBAC 135': '#3b82f6', 'RBAC 121': '#8b5cf6' };
    return <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: colors[s] || '#6b7280', color: '#fff', marginLeft: 4 }}>{s}</span>;
  };

  return (
    <div ref={containerRef} className={['aircraft-search-wrapper', className].filter(Boolean).join(' ')} style={{ position: 'relative' }}>
      {label && (
        <label className="aircraft-search-label" style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em',
            width: '100%', paddingRight: loading ? 32 : undefined,
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 10, fontSize: 12, color: 'var(--text3)' }}>...</span>
        )}
      </div>
      {selected && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
          {[selected.fabricante, selected.modelo, selected.ano_fabricacao].filter(Boolean).join(' · ')}
          {selected.motor_modelo ? ` · ${selected.motor_modelo}${selected.motor_quantidade > 1 ? ` (x${selected.motor_quantidade})` : ''}` : ''}
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          maxHeight: 300, overflowY: 'auto', marginTop: 3,
        }}>
          {results.map(ac => (
            <button
              key={ac.matricula}
              type="button"
              onClick={() => handleSelect(ac)}
              style={{
                width: '100%', padding: '10px 14px', cursor: 'pointer', border: 'none',
                borderBottom: '1px solid var(--border)', background: 'transparent',
                display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--blue)', letterSpacing: '0.05em' }}>
                    {ac.matricula}
                  </span>
                  {situacaoBadge(ac.situacao)}
                  {ac.uf_operador && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{ac.uf_operador}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text1)', marginTop: 1 }}>
                  {[ac.fabricante, ac.modelo].filter(Boolean).join(' — ')}
                  {ac.ano_fabricacao ? ` (${ac.ano_fabricacao})` : ''}
                </div>
                {(ac.motor_modelo || ac.lotacao) && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                    {ac.motor_modelo ? `Motor: ${ac.motor_modelo}${ac.motor_quantidade > 1 ? ` x${ac.motor_quantidade}` : ''}` : ''}
                    {ac.lotacao ? ` · ${ac.lotacao} assentos` : ''}
                    {ac.peso_max_decolagem_kg ? ` · PMD: ${ac.peso_max_decolagem_kg}kg` : ''}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
