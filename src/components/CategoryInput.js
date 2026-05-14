// CategoryInput — autocomplete em cost_categories com quickcreate.
// Quando o usuário digita um nome inexistente e dá blur (ou Enter), cria a categoria automaticamente.
//
// Uso:
//   <CategoryInput
//     value={lineCategory}
//     onChange={(name) => updateLine(id, { category: name })}
//     placeholder="ex.: Manutenção"
//   />
//
// Opcional: passar `groupType` para defaults de criação (operational/fixed/variable).

import React, { useState, useEffect, useRef } from 'react';
import { getCostCategories, ensureCostCategory } from '../store';

export default function CategoryInput({ value, onChange, placeholder, groupType, style }) {
  const [allCats, setAllCats] = useState([]);
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setText(value || ''); }, [value]);

  useEffect(() => {
    getCostCategories().then(setAllCats).catch(() => setAllCats([]));
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const q = text.trim().toLowerCase();
  const matches = q
    ? allCats.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8)
    : allCats.slice(0, 8);

  const exactExists = allCats.some(c => c.name.toLowerCase() === q);
  const showCreateOption = q && !exactExists;

  async function commitNew(name) {
    setCreating(true);
    try {
      const cat = await ensureCostCategory(name, { groupType });
      // Atualiza lista local para feedback imediato
      setAllCats(list => {
        if (list.some(c => c.id === cat.id)) return list;
        return [...list, cat].sort((a,b) => (a.sort_order||0) - (b.sort_order||0));
      });
      setText(cat.name);
      onChange?.(cat.name);
    } catch(e) {
      // Mantém o texto e propaga (mesmo sem criar, o budget_line.category aceita texto livre)
      console.warn('quickcreate falhou:', e.message);
      onChange?.(name);
    }
    setCreating(false);
    setOpen(false);
  }

  function pickExisting(cat) {
    setText(cat.name);
    onChange?.(cat.name);
    setOpen(false);
    setHighlight(-1);
  }

  function handleKey(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }
    const items = [...matches, ...(showCreateOption ? [{ id: '__new__', name: `+ Criar "${text}"` }] : [])];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = items[highlight] || items[0];
      if (!picked) return;
      if (picked.id === '__new__') commitNew(text);
      else pickExisting(picked);
    } else if (e.key === 'Escape') {
      setOpen(false); setHighlight(-1);
    }
  }

  async function handleBlur() {
    // Atraso pequeno pra permitir clique nos dropdown items
    setTimeout(async () => {
      if (!open) return;
      // Se o texto não é exato e o usuário não picou nada, criamos
      if (text.trim() && !exactExists) {
        await commitNew(text);
      } else if (text.trim() && exactExists) {
        onChange?.(text);
        setOpen(false);
      }
    }, 150);
  }

  return (
    <div ref={wrapRef} style={{ position:'relative', ...style }}>
      <input
        value={text}
        onChange={e => { setText(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        placeholder={placeholder || 'Categoria'}
        disabled={creating}
        style={{ width:'100%' }}
      />
      {open && (matches.length > 0 || showCreateOption) && (
        <div style={{
          position:'absolute', top:'calc(100% + 2px)', left:0, right:0,
          background:'var(--bg0)', border:'1px solid var(--border)', borderRadius:6,
          boxShadow:'0 4px 16px rgba(0,0,0,.25)', zIndex:1000,
          maxHeight:240, overflowY:'auto'
        }}>
          {matches.map((c, i) => (
            <button
              type="button"
              key={c.id}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); pickExisting(c); }}
              style={{
                display:'flex', alignItems:'center', gap:8, width:'100%',
                padding:'7px 10px', border:'none', background: highlight === i ? 'var(--bg2)' : 'transparent',
                cursor:'pointer', textAlign:'left', fontSize:12, color:'var(--text1)'
              }}>
              {c.icon && <span>{c.icon}</span>}
              {c.color && <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }} />}
              <span style={{ flex:1 }}>{c.name}</span>
              <span style={{ fontSize:10, color:'var(--text3)' }}>{c.group_type}</span>
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              onMouseEnter={() => setHighlight(matches.length)}
              onMouseDown={(e) => { e.preventDefault(); commitNew(text); }}
              disabled={creating}
              style={{
                display:'flex', alignItems:'center', gap:8, width:'100%',
                padding:'7px 10px', border:'none',
                borderTop: matches.length > 0 ? '1px solid var(--border)' : 'none',
                background: highlight === matches.length ? 'var(--blue-dim)' : 'rgba(77,157,224,0.06)',
                cursor:'pointer', textAlign:'left', fontSize:12, color:'var(--blue)', fontWeight:600
              }}>
              ＋ Criar nova categoria "{text}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
