import { useState, useRef, useEffect } from 'react';

export default function FormField({
  label, name, value, onChange, options = [], type = 'text',
  searchable = false, readOnly = false, onAddNew,
}) {
  const cls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none';
  const shouldSearch = options.length > 0 && (searchable || options.length > 10);
  const isNumber = type === 'number';
  const numericZero = isNumber && Number(value || 0) === 0;
  const inputValue = isNumber && numericZero ? '' : (value ?? '');

  const handleBlur = (e) => {
    if (!isNumber) return;
    const raw = e.target.value;
    if (raw === '') return onChange(name, 0);
    const n = Number(raw);
    onChange(name, Number.isFinite(n) ? Number(n.toFixed(2)) : 0);
  };

  if (shouldSearch) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
          {onAddNew && (
            <button type="button" onClick={onAddNew} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ New</button>
          )}
        </div>
        <SearchableSelect
          value={value || ''}
          options={options}
          onChange={(v) => onChange(name, v)}
          placeholder={`Search ${label}`}
          readOnly={readOnly}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        {onAddNew && (
          <button type="button" onClick={onAddNew} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ New</button>
        )}
      </div>
      {options.length ? (
        <select value={value || ''} onChange={(e) => onChange(name, e.target.value)} disabled={readOnly} className={cls}>
          <option value="">Select {label}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={inputValue}
          onFocus={() => { if (isNumber && numericZero) onChange(name, ''); }}
          onBlur={handleBlur}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly}
          placeholder={isNumber ? '0.00' : ''}
          step={isNumber ? '0.01' : undefined}
          className={cls}
        />
      )}
    </div>
  );
}


function SearchableSelect({ value, options, onChange, placeholder, readOnly }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const select = (val) => {
    onChange(val);
    setQuery(val);
    setOpen(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) {
      e.preventDefault();
      select(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIdx(-1);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
      />
      {value && !readOnly && (
        <button
          type="button"
          onClick={() => { onChange(''); setQuery(''); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
        >
          &times;
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
        >
          {filtered.map((o, i) => (
            <li
              key={o}
              onClick={() => select(o)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlightIdx ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              } ${o === value ? 'font-semibold' : ''}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-lg text-sm text-gray-400">
          No matches
        </div>
      )}
    </div>
  );
}
