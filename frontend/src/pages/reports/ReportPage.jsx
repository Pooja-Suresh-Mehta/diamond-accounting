/**
 * Generic report page template.
 * Usage:
 *   <ReportPage title="..." endpoint="..." filters={[...]} columns={[...]} totalKeys={[...]} />
 *
 * filters: [{ key, label, type?: 'text'|'date'|'select', options?: [] }]
 * columns: [{ key, label, format?: (val, row) => string }]
 * totalKeys: keys from data.totals to show in footer
 */
import { useState, useEffect, useRef } from 'react';
import { Search, Columns } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

export default function ReportPage({ title, endpoint, filters: filterDefs, columns, totalKeys = [], extraParams = {} }) {
  const initFilters = Object.fromEntries((filterDefs || []).map(f => [f.key, f.type === 'checkbox' ? false : '']));
  const [filters, setFilters] = useState(initFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({});
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [showColChooser, setShowColChooser] = useState(false);
  const colChooserRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (colChooserRef.current && !colChooserRef.current.contains(e.target)) {
        setShowColChooser(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const hasApiSelect = (filterDefs || []).some(f => f.type === 'api-select');
    if (hasApiSelect) {
      api.get('/parcel-reports/options').then(res => setFilterOptions(res.data)).catch(() => {});
    }
  }, []);

  const visibleCols = columns ? columns.filter(c => !hiddenCols.has(c.key)) : [];

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const search = async () => {
    setLoading(true);
    try {
      const params = { ...extraParams, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== false)) };
      const r = await api.get(endpoint, { params });
      setData(r.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const fmt = (col, row) => {
    const val = row[col.key];
    if (col.format) return col.format(val, row);
    if (val === null || val === undefined) ';return '
    if (typeof val === 'number') return val.toFixed ? val.toFixed(2) : val;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const results = data?.results || data?.entries || (Array.isArray(data) ? data : []);
  const totals = data?.totals || {};

  const ColChooser = () => (
    <div className="relative" ref={colChooserRef}>
      <button onClick={() => setShowColChooser(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
        <Columns className="w-4 h-4" /> Columns
        {hiddenCols.size > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">{hiddenCols.size}</span>
        )}
      </button>
      {showColChooser && (
        <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase">Show/Hide Columns</span>
            <div className="flex gap-2">
              <button onClick={() => setHiddenCols(new Set())} className="text-xs text-blue-600 hover:underline">All</button>
              <button onClick={() => setHiddenCols(new Set(columns.map(c => c.key)))} className="text-xs text-red-500 hover:underline">None</button>
            </div>
          </div>
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1">
              <input
                type="checkbox"
                checked={!hiddenCols.has(col.key)}
                onChange={() => setHiddenCols(prev => {
                  const s = new Set(prev);
                  s.has(col.key) ? s.delete(col.key) : s.add(col.key);
                  return s;
                })}
                className="w-3.5 h-3.5"
              />
              <span className="text-sm text-gray-700">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>

      {filterDefs && filterDefs.length > 0 && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filterDefs.map(f => (
              f.type === 'checkbox' ? (
                <div key={f.key} className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-2">
                    <input type="checkbox" checked={!!filters[f.key]} onChange={e => set(f.key, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    {f.label}
                  </label>
                </div>
              ) : (
              <div key={f.key} className={`space-y-1${f.type === 'textarea' ? ' col-span-2 md:col-span-4' : ''}`}>
                <label className="text-xs font-medium text-gray-600">{f.label}</label>
                {f.type === 'select' ? (
                  <select value={filters[f.key]} onChange={e => set(f.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="">All</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'api-select' ? (
                  <select value={filters[f.key]} onChange={e => set(f.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="">All</option>
                    {(filterOptions[f.optionsKey] || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={filters[f.key]} onChange={e => set(f.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder={f.placeholder || f.label} rows={3} />
                ) : (
                  <input type={f.type || 'text'} value={filters[f.key]} onChange={e => set(f.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder={f.label} />
                )}
              </div>
              )
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={search} disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm">
              <Search className="w-4 h-4" />{loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      )}

      {!filterDefs && (
        <div className="flex justify-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Load Report'}
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <ColChooser />
          </div>
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{visibleCols.map(c => <th key={c.key} className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr><td colSpan={visibleCols.length} className="text-center text-gray-400 py-8">No results found</td></tr>
                ) : results.map((row, i) => (
                  <tr key={row.id || i} className="border-b hover:bg-gray-50">
                    {visibleCols.map(c => (
                      <td key={c.key} className="px-3 py-2 whitespace-nowrap">{fmt(c, row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {results.length > 0 && totalKeys.length > 0 && (() => {
                const visibleTotalKeys = totalKeys.filter(k => visibleCols.some(c => c.key === k));
                if (visibleTotalKeys.length === 0) return null;
                return (
                  <tfoot className="bg-gray-50 border-t font-semibold">
                    <tr>
                      {visibleCols.map((c, i) => {
                        if (totalKeys.includes(c.key)) {
                          return (
                            <td key={c.key} className="px-3 py-2">
                              {typeof totals[c.key] === 'number' ? totals[c.key].toFixed(2) : (totals[c.key] || '—')}
                            </td>
                          );
                        }
                        if (i === 0) return <td key={c.key} className="px-3 py-2 text-right text-gray-600">Totals:</td>;
                        return <td key={c.key} className="px-3 py-2" />;
                      })}
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
