import { useState, useRef, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

/**
 * A searchable dropdown that allows adding new options.
 * New values are saved to the backend and merged into the list.
 *
 * Props:
 *   label      - field label
 *   name       - form field name
 *   value      - current value
 *   onChange   - (name, value) => void
 *   options    - string[] from parent (defaults + custom already merged)
 *   fieldKey   - backend field key: "shape" | "color" | "clarity" | "size" | "sieve"
 *   onNewOption - called with new value after it's saved, so parent can refresh opts
 */
export default function CreatableField({ label, name, value, onChange, options = [], fieldKey, onNewOption }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef(null);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());
  const showAddNew = query.trim() && !exactMatch;

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (val) => {
    onChange(name, val);
    setQuery(val);
    setOpen(false);
  };

  const handleAddNew = async () => {
    const newVal = query.trim();
    if (!newVal || saving) return;
    setSaving(true);
    try {
      await api.post(`/dropdown-options/${fieldKey}`, { value: newVal });
      select(newVal);
      onNewOption?.(fieldKey, newVal);
      toast.success(`"${newVal}" added to ${label} options`);
    } catch {
      toast.error('Failed to save new option');
    } finally {
      setSaving(false);
    }
  };

  const cls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div ref={wrapperRef} className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(name, ''); }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${label}`}
          className={cls}
        />
        {value && (
          <button type="button" onClick={() => { onChange(name, ''); setQuery(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">&times;</button>
        )}
        {open && (
          <ul className="absolute z-50 w-full mt-1 max-h-52 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
            {filtered.map((o) => (
              <li key={o} onMouseDown={() => select(o)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${o === value ? 'font-semibold text-blue-700' : ''}`}>
                {o}
              </li>
            ))}
            {showAddNew && (
              <li onMouseDown={handleAddNew}
                className="px-3 py-2 text-sm cursor-pointer text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
                {saving ? 'Saving...' : `+ Add "${query.trim()}" as new option`}
              </li>
            )}
            {filtered.length === 0 && !showAddNew && (
              <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
