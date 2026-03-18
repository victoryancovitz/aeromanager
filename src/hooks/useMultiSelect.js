import { useState, useCallback } from 'react';

export function useMultiSelect(items, getId = item => item.id) {
  const [selected, setSelected] = useState(new Set());

  const toggle = useCallback((id) => {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(s => s.size === items.length ? new Set() : new Set(items.map(getId)));
  }, [items, getId]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((id) => selected.has(id), [selected]);
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;
  const count = selected.size;
  const selectedIds = Array.from(selected);

  return { selected, toggle, toggleAll, clear, isSelected, allSelected, someSelected, count, selectedIds };
}
