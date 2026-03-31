/**
 * Generic report page template.
 * Usage:
 *   <ReportPage title="..." endpoint="..." filters={[...]} columns={[...]} totalKeys={[...]} />
 *
 * filters: [{ key, label, type?: 'text'|'date'|'select', options?: [] }]
 * columns: [{ key, label, format?: (val, row) => string }]
 * totalKeys: keys from data.totals to show in footer
 */
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

export default function ReportPage({ title, endpoint, filters: filterDefs, columns, totalKeys = [], extraParams = {} }) {
  const initFilters = Object.fromEntries((filterDefs || []).map(f => [f.key, f.type === 'checkbox' ? false : '']));
  const [filters, setFilters] = useState(initFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({});

  useEffect(() => {
    const hasApiSelect = (filterDefs || []).some(f => f.type === 'api-select');
    if (hasApiSelect) {
      api.get('/parcel-reports/options').then(res => setFilterOptions(res.data)).catch(() => {});
    }
  }, []);

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
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') return val.toFixed ? val.toFixed(2) : val;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const results = data?.results || data?.entries || (Array.isArray(data) ? data : []);
  const totals = data?.totals || {};

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
          <div>
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
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{columns.map(c => <th key={c.key} className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={columns.length} className="text-center text-gray-400 py-8">No results found</td></tr>
              ) : results.map((row, i) => (
                <tr key={row.id || i} className="border-b hover:bg-gray-50">
                  {columns.map(c => (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">{fmt(c, row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {results.length > 0 && totalKeys.length > 0 && (
              <tfoot className="bg-gray-50 border-t font-semibold">
                <tr>
                  <td colSpan={columns.length - totalKeys.length} className="px-3 py-2 text-right text-gray-600">Totals:</td>
                  {totalKeys.map(k => (
                    <td key={k} className="px-3 py-2">
                      {typeof totals[k] === 'number' ? totals[k].toFixed(2) : (totals[k] || '—')}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
