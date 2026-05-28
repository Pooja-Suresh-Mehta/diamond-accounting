import { useState, useEffect, useRef } from 'react';

/**
 * A text input that shows a filtered dropdown of options.
 * - options: string[]
 * - value: currently selected value (string)
 * - onChange: called with the selected string ('' to clear)
 * - placeholder: input placeholder text
 */
export default function SearchableSelect({ value, options = [], onChange, placeholder = 'Search...' }) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const filtered = query
    ? options.filter(o => String(o).toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => { setQuery(value ?? ''); }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(value ?? '');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [value]);

  const select = (val) => {
    onChange(val);
    setQuery(val);
    setOpen(false);
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    if (e.target.value === '') onChange('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto text-sm">
          <li
            className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-400 italic"
            onMouseDown={() => select('')}
          >All</li>
          {filtered.map(o => (
            <li
              key={o}
              className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${value === String(o) ? 'bg-blue-100 font-medium' : ''}`}
              onMouseDown={() => select(String(o))}
            >{o}</li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-gray-400">No results</li>
          )}
        </ul>
      )}
    </div>
  );
}
