import { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { fmtAmt, fmtDate } from '../../utils/format';

// ── Searchable lot-number combobox ───────────────────────
function SearchableSelect({ value, options, onChange, placeholder = 'Search...' }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [value]);

  const select = (val) => { onChange(val); setQuery(val); setOpen(false); };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (e.target.value === '') onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto text-sm">
          {filtered.map(o => (
            <li
              key={o}
              className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${value === o ? 'bg-blue-100 font-medium' : ''}`}
              onMouseDown={() => select(o)}
            >{o}</li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-2 text-gray-400">No results</li>}
        </ul>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────
const N = (val, decimals = 2) => (val === null || val === undefined) ? '' : fmtAmt(val, decimals);
const ROW_CLASSES = {
  'Opening Stock': 'bg-blue-50 font-medium',
  'Purchase': 'hover:bg-gray-50',
  'Sale': 'bg-orange-50 hover:bg-orange-100',
};

// Returns true when INR value is NOT within ±20% of USD*90
function inrUsdMismatch(inr, usd) {
  if (!inr || !usd) return false;
  const expected = usd * 90;
  return inr < expected * 0.8 || inr > expected * 1.2;
}

// ── Main component ───────────────────────────────────────
export default function ParcelDetailedStockReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lotNo, setLotNo] = useState(searchParams.get('lot_no') || '');
  const [currency, setCurrency] = useState('USD');
  const [lotOptions, setLotOptions] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState({ col: '', dir: 'asc' });

  useEffect(() => {
    api.get('/parcel-reports/options')
      .then(res => setLotOptions(res.data.lot_nos || []))
      .catch(() => {});
  }, []);

  // Auto-search when navigated from stock report with lot_no in URL
  useEffect(() => {
    const urlLot = searchParams.get('lot_no');
    if (urlLot) {
      setLotNo(urlLot);
    }
  }, [searchParams]);

  const search = async () => {
    if (!lotNo) { toast.error('Please select a Lot Number'); return; }
    setLoading(true);
    try {
      const res = await api.get('/parcel-reports/detailed-stock', { params: { lot_no: lotNo, currency } });
      setData(res.data);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const rows = data?.rows || [];
  const total = data?.total;

  const handleSort = (key) => {
    setSort(prev => prev.col === key ? { col: key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col: key, dir: 'asc' });
  };

  const sortedRows = useMemo(() => {
    if (!sort.col) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sort.col] ?? '';
      const bVal = b[sort.col] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sort.dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [rows, sort]);

  const COLS = [
    { key: 'date',      label: 'Date',       align: 'left'  },
    { key: 'lot_no',    label: 'Lot No.',     align: 'left'  },
    { key: 'state',     label: 'State',       align: 'left'  },
    { key: 'p_ct',      label: 'P Ct',        align: 'right' },
    { key: 'p_rate',    label: 'P Rate',      align: 'right' },
    { key: 'p_amt',     label: `P Amt (${data?.currency || currency})`, align: 'right' },
    { key: 's_ct',      label: 'S Ct',        align: 'right' },
    { key: 's_rate',    label: 'S Rate',      align: 'right' },
    { key: 's_amt',     label: `S Amt (${data?.currency || currency})`, align: 'right' },
    { key: 'curr_ct',   label: 'Curr Ct',     align: 'right' },
    { key: 'curr_rate', label: 'Curr Rate',   align: 'right' },
    { key: 'curr_amt',  label: `Curr Amt (${data?.currency || currency})`, align: 'right' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Detailed Stock Report</h2>

      {/* Filter bar */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Lot Number</label>
            <SearchableSelect
              value={lotNo}
              options={lotOptions}
              onChange={setLotNo}
              placeholder="Search Lot No..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={search}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center disabled:opacity-60"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Results table */}
      {data && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className={`px-3 py-3 font-medium text-gray-600 whitespace-nowrap text-${c.align} cursor-pointer select-none hover:bg-gray-100`}
                  >
                    <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'justify-end w-full' : ''}`}>
                      {c.label}
                      <span className="text-gray-400 text-xs">{sort.col === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="text-center text-gray-400 py-8">No data found for this lot</td>
                </tr>
              ) : sortedRows.map((row, i) => {
                const pMismatch = row.state === 'Purchase' && inrUsdMismatch(row.p_amt_inr, row.p_amt_usd);
                const sMismatch = row.state === 'Sale'     && inrUsdMismatch(row.s_amt_inr, row.s_amt_usd);
                const mismatchCell = 'bg-red-100 text-red-700';
                return (
                <tr key={i} className={`border-b ${ROW_CLASSES[row.state] || 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{row.date ? fmtDate(row.date) : ''}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.lot_no || ''}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {row.state === 'Purchase' && row.purchase_id ? (
                      <button
                        onClick={() => navigate(`/parcel-transaction/purchase/edit/${row.purchase_id}`)}
                        className="text-blue-600 hover:underline font-medium"
                      >{row.state}</button>
                    ) : row.state === 'Sale' && row.sale_id ? (
                      <button
                        onClick={() => navigate(`/parcel-transaction/sale/edit/${row.sale_id}`)}
                        className="text-blue-600 hover:underline font-medium"
                      >{row.state}</button>
                    ) : row.state}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{N(row.p_ct, 3)}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-right${pMismatch ? ' ' + mismatchCell : ''}`}>{N(row.p_rate)}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-right${pMismatch ? ' ' + mismatchCell : ''}`}>{N(row.p_amt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{N(row.s_ct, 3)}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-right${sMismatch ? ' ' + mismatchCell : ''}`}>{N(row.s_rate)}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-right${sMismatch ? ' ' + mismatchCell : ''}`}>{N(row.s_amt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{N(row.curr_ct, 3)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{N(row.curr_rate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{N(row.curr_amt)}</td>
                </tr>
                );
              })}
            </tbody>
            {total && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-semibold text-gray-800">
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{N(total.p_ct, 3)}</td>
                  <td className="px-3 py-2 text-right">{N(total.p_rate)}</td>
                  <td className="px-3 py-2 text-right">{N(total.p_amt)}</td>
                  <td className="px-3 py-2 text-right">{N(total.s_ct, 3)}</td>
                  <td className="px-3 py-2 text-right">{N(total.s_rate)}</td>
                  <td className="px-3 py-2 text-right">{N(total.s_amt)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
