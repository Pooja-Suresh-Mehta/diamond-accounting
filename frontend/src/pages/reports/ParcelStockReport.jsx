import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, RotateCcw, Download, ChevronLeft, Columns } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { getCurrentDateISO } from '../../utils/dateDefaults';

// ── Reusable filter components ───────────────────────────

function Chip({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded border transition ${
        selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
      }`}>
      {label}
    </button>
  );
}

function ChipGroup({ label, options, selected, onChange }) {
  const toggle = (val) => onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => <Chip key={opt} label={opt} selected={selected.includes(opt)} onClick={() => toggle(opt)} />)}
      </div>
    </div>
  );
}

function RangeInput({ label, fromVal, toVal, onFromChange, onToChange, type = 'number', step = 'any' }) {
  const cls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none';
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        <input type={type} placeholder="From" step={type === 'number' ? step : undefined} value={fromVal ?? ''}
          onChange={e => onFromChange(type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)} className={cls} />
        <input type={type} placeholder="To" step={type === 'number' ? step : undefined} value={toVal ?? ''}
          onChange={e => onToChange(type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)} className={cls} />
      </div>
    </div>
  );
}

function DateRangeRow({ label, enabled, onToggle, fromVal, toVal, onFromChange, onToChange }) {
  const cls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400';
  return (
    <div className="flex items-center gap-3">
      <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide w-36 shrink-0">{label}</label>
      <input type="date" value={fromVal || ''} onChange={e => onFromChange(e.target.value)} disabled={!enabled} className={cls} />
      <span className="text-xs text-gray-400">to</span>
      <input type="date" value={toVal || ''} onChange={e => onToChange(e.target.value)} disabled={!enabled} className={cls} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none">
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <input type={type} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
    </div>
  );
}

// ── Initial filter state ─────────────────────────────────

const getInitFilters = () => {
  const today = getCurrentDateISO();
  return {
    stock_to_date: today, show: '', hold_status: '', single_parcel: '',
    shapes: [], colors: [], clarities: [],
    size: '', lot_no: '', sieve: '',
    carat_from: null, carat_to: null,
    price_from: null, price_to: null,
    table_depth_from: null, table_depth_to: null,
    table_pct_from: null, table_pct_to: null,
    ca_from: null, ca_to: null, ch_from: null, ch_to: null,
    ph_from: null, ph_to: null, pa_from: null, pa_to: null,
    purchase_date_enabled: false, purchase_date_from: today, purchase_date_to: today,
    revision_date_enabled: false, revision_date_from: today, revision_date_to: today,
    new_arrival_enabled: false, new_arrival_from: today, new_arrival_to: today,
    web_revised_enabled: false, web_revised_from: today, web_revised_to: today,
    unhold_date_enabled: false, unhold_date_from: today, unhold_date_to: today,
    lab_date_enabled: false, lab_date_from: today, lab_date_to: today,
  };
};

// ── Result table columns ─────────────────────────────────

const COLS = [
  { key: 'cur_status',             label: 'Status' },
  { key: 'created_date',           label: 'Date' },
  { key: 'lot_no',                 label: 'LotNo' },
  { key: 'item_name',              label: 'Item' },
  { key: 'shape',                  label: 'Shape' },
  { key: 'color',                  label: 'Color' },
  { key: 'clarity',                label: 'Clarity' },
  { key: 'size',                   label: 'Size' },
  { key: 'sieve_mm',               label: 'Sieve' },
  { key: 'stock_group_id',         label: 'Group' },
  { key: 'stock_type',             label: 'Stock Type' },
  { key: 'stock_subtype',          label: 'Sub Type' },
  { key: 'grown_process_type',     label: 'Process' },
  { key: 'opening_weight_carats',  label: 'Opening Wt', num: true },
  { key: 'carats',                 label: 'Total Carats', num: true },
  { key: 'purchased_weight',       label: 'Purch Wt', num: true },
  { key: 'purchased_pcs',          label: 'Purch Pcs', num: true },
  { key: 'sold_weight',            label: 'Sold Wt', num: true },
  { key: 'sold_pcs',               label: 'Sold Pcs', num: true },
  { key: 'on_memo_weight',         label: 'Memo Wt', num: true },
  { key: 'on_memo_pcs',            label: 'Memo Pcs', num: true },
  { key: 'on_hand_weight',         label: 'On Hand', num: true },
  { key: 'purchase_price',         label: 'Purch Price', num: true },
  { key: 'purchase_price_currency',label: 'Currency' },
  { key: 'usd_to_inr_rate',        label: 'USD/INR Rate', num: true },
  { key: 'purchase_cost_usd_carat',label: 'Cost USD/Ct', num: true },
  { key: 'purchase_cost_inr_carat',label: 'Cost INR/Ct', num: true },
  { key: 'purchase_cost_usd_amount',label: 'Cost USD Amt', num: true },
  { key: 'purchase_cost_inr_amount',label: 'Cost INR Amt', num: true },
  { key: 'asking_price_usd_carats',label: 'Ask USD/Ct', num: true },
  { key: 'asking_price_inr_carats',label: 'Ask INR/Ct', num: true },
  { key: 'asking_usd_amount',      label: 'Ask USD Amt', num: true },
  { key: 'asking_inr_amount',      label: 'Ask INR Amt', num: true },
];

// ── Main component ───────────────────────────────────────

export default function ParcelStockReport() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState(getInitFilters());
  const [options, setOptions] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('search'); // 'search' | 'results'

  // Result table state
  const [selected, setSelected] = useState(new Set());
  const [colFilters, setColFilters] = useState({});
  const [showMorePopup, setShowMorePopup] = useState(false);
  const [moreTab, setMoreTab] = useState('location');
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [showColChooser, setShowColChooser] = useState(false);
  const colChooserRef = useRef(null);
  const [locationForm, setLocationForm] = useState({ city: '', state: '', country: '' });
  const [boxGroupForm, setBoxGroupForm] = useState({ box_name: '', group_name: '' });
  const [moreLoading, setMoreLoading] = useState(false);

  useEffect(() => {
    api.get('/parcel-master/options').then(res => setOptions(res.data)).catch(() => {});
  }, []);

  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  const buildParams = useCallback(() => {
    const p = {};
    if (filters.stock_to_date) p.stock_to_date = filters.stock_to_date;
    if (filters.show) p.show = filters.show;
    if (filters.hold_status) p.hold_status = filters.hold_status;
    if (filters.single_parcel) p.single_parcel = filters.single_parcel;
    if (filters.shapes.length) p.shape = filters.shapes.join(',');
    if (filters.colors.length) p.color = filters.colors.join(',');
    if (filters.clarities.length) p.clarity = filters.clarities.join(',');
    if (filters.size) p.size = filters.size;
    if (filters.lot_no) p.lot_no = filters.lot_no;
    if (filters.sieve) p.sieve = filters.sieve;
    if (filters.carat_from != null) p.carat_from = filters.carat_from;
    if (filters.carat_to != null) p.carat_to = filters.carat_to;
    if (filters.price_from != null) p.price_from = filters.price_from;
    if (filters.price_to != null) p.price_to = filters.price_to;
    if (filters.table_depth_from != null) p.table_depth_from = filters.table_depth_from;
    if (filters.table_depth_to != null) p.table_depth_to = filters.table_depth_to;
    if (filters.table_pct_from != null) p.table_pct_from = filters.table_pct_from;
    if (filters.table_pct_to != null) p.table_pct_to = filters.table_pct_to;
    if (filters.ca_from != null) p.ca_from = filters.ca_from;
    if (filters.ca_to != null) p.ca_to = filters.ca_to;
    if (filters.ch_from != null) p.ch_from = filters.ch_from;
    if (filters.ch_to != null) p.ch_to = filters.ch_to;
    if (filters.ph_from != null) p.ph_from = filters.ph_from;
    if (filters.ph_to != null) p.ph_to = filters.ph_to;
    if (filters.pa_from != null) p.pa_from = filters.pa_from;
    if (filters.pa_to != null) p.pa_to = filters.pa_to;
    if (filters.purchase_date_enabled) { p.purchase_date_from = filters.purchase_date_from; p.purchase_date_to = filters.purchase_date_to; }
    if (filters.revision_date_enabled) { p.revision_date_from = filters.revision_date_from; p.revision_date_to = filters.revision_date_to; }
    if (filters.new_arrival_enabled) { p.new_arrival_from = filters.new_arrival_from; p.new_arrival_to = filters.new_arrival_to; }
    if (filters.web_revised_enabled) { p.web_revised_from = filters.web_revised_from; p.web_revised_to = filters.web_revised_to; }
    if (filters.unhold_date_enabled) { p.unhold_date_from = filters.unhold_date_from; p.unhold_date_to = filters.unhold_date_to; }
    if (filters.lab_date_enabled) { p.lab_date_from = filters.lab_date_from; p.lab_date_to = filters.lab_date_to; }
    return p;
  }, [filters]);

  const handleReport = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/parcel-reports/stock', { params: buildParams() });
      setData(r.data);
      setSelected(new Set());
      setColFilters({});
      setView('results');
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [buildParams]);

  const handleClear = () => { setFilters(getInitFilters()); setData(null); setView('search'); };

  // ── Filtered rows (client-side column filters) ──────────
  const filteredRows = useMemo(() => {
    if (!data?.results) return [];
    return data.results.filter(r =>
      COLS.every(col => {
        const f = colFilters[col.key];
        if (!f) return true;
        return String(r[col.key] ?? '').toLowerCase().includes(f.toLowerCase());
      })
    );
  }, [data, colFilters]);

  const visibleCols = useMemo(() => COLS.filter(c => !hiddenCols.has(c.key)), [hiddenCols]);

  // ── Selection helpers ────────────────────────────────────
  const allChecked = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id));
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filteredRows.map(r => r.id)));
  };
  const toggleRow = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const selRows = filteredRows.filter(r => selected.has(r.id));
  const selCarats = selRows.reduce((s, r) => s + (r.carats || 0), 0);
  const selAmount = selRows.reduce((s, r) => s + (r.asking_usd_amount || 0), 0);
  const selAvgRate = selCarats > 0 ? selAmount / selCarats : 0;
  const selLotNos = selRows.map(r => r.lot_no).join(', ');

  // ── Footer totals ────────────────────────────────────────
  const totalCarats = filteredRows.reduce((s, r) => s + (r.carats || 0), 0);
  const totalOnHand = filteredRows.reduce((s, r) => s + (r.on_hand_weight || 0), 0);
  const totalMemo = filteredRows.reduce((s, r) => s + (r.on_memo_weight || 0), 0);
  const totalAmount = filteredRows.reduce((s, r) => s + (r.asking_usd_amount || 0), 0);
  const avgRate = totalCarats > 0 ? totalAmount / totalCarats : 0;

  // ── Export ───────────────────────────────────────────────
  const exportExcel = () => {
    const headers = visibleCols.map(c => c.label);
    const csvRows = [headers.join(',')];
    filteredRows.forEach(r => {
      csvRows.push(visibleCols.map(c => {
        const v = r[c.key] ?? '';
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'parcel_stock.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── More popup handlers ──────────────────────────────────
  const submitLocation = async () => {
    const ids = selRows.map(r => r.id);
    if (!ids.length) return toast.error('Select at least one row');
    setMoreLoading(true);
    try {
      await api.post('/parcel-reports/update-location', { ids, ...locationForm });
      toast.success('Location updated');
      setShowMorePopup(false);
      handleReport();
    } catch { toast.error('Update failed'); }
    finally { setMoreLoading(false); }
  };

  const submitBoxGroup = async () => {
    const ids = selRows.map(r => r.id);
    if (!ids.length) return toast.error('Select at least one row');
    setMoreLoading(true);
    try {
      await api.post('/parcel-reports/update-box-group', { ids, ...boxGroupForm });
      toast.success('Box/Group updated');
      setShowMorePopup(false);
      handleReport();
    } catch { toast.error('Update failed'); }
    finally { setMoreLoading(false); }
  };

  // ── PMemo / PSale navigation ─────────────────────────────
  const goMemo = () => navigate('/parcel/memo-out/add');
  const goSale = () => navigate('/parcel/sale/add');

  const tabs = ['Basic & Grading Search', 'Numeric Search', 'Date Search'];
  const shapes = options?.shapes || [];
  const colors = options?.colors || [];
  const clarities = options?.clarities || [];

  // ═══════════════════════════════════════════════════════
  // RESULTS VIEW
  // ═══════════════════════════════════════════════════════
  if (view === 'results') {
    return (
      <div className="space-y-3">
        {/* Header bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setView('search')}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <h2 className="text-lg font-semibold text-gray-800">Parcel Stock Search — {filteredRows.length} records</h2>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative" ref={colChooserRef}>
              <button onClick={() => setShowColChooser(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
                <Columns className="w-4 h-4" /> Columns {hiddenCols.size > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full">{hiddenCols.size}</span>}
              </button>
              {showColChooser && (
                <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Show/Hide Columns</span>
                    {hiddenCols.size > 0 && (
                      <button onClick={() => setHiddenCols(new Set())} className="text-xs text-blue-600 hover:underline">Reset</button>
                    )}
                  </div>
                  {COLS.map(col => (
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
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => setShowMorePopup(true)}
              className="px-3 py-2 text-sm bg-gray-700 text-white hover:bg-gray-800 rounded-lg">
              More
            </button>
            <button onClick={goMemo}
              className="px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg">
              PMemo
            </button>
            <button onClick={goSale}
              className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg">
              PSale
            </button>
          </div>
        </div>

        {/* Selection summary */}
        {selected.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
            <span><strong>Tot Pcs:</strong> {selRows.length}</span>
            <span><strong>Carats:</strong> {selCarats.toFixed(3)}</span>
            <span><strong>Amt Tot:</strong> {selAmount.toFixed(2)}</span>
            <span><strong>Avg Rate:</strong> {selAvgRate.toFixed(2)}</span>
            {selLotNos && <span className="truncate max-w-xs"><strong>LotNos:</strong> {selLotNos}</span>}
          </div>
        )}

        {/* Result table */}
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4" />
                </th>
                {visibleCols.map(col => (
                  <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
              {/* Column filter row */}
              <tr className="bg-gray-50 border-b">
                <td />
                {visibleCols.map(col => (
                  <td key={col.key} className="px-2 py-1">
                    <input
                      type="text"
                      placeholder="filter"
                      value={colFilters[col.key] || ''}
                      onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => (
                <tr key={r.id} className={`border-b hover:bg-gray-50 ${selected.has(r.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} className="w-4 h-4" />
                  </td>
                  {visibleCols.map(col => {
                    if (col.key === 'cur_status') return (
                      <td key={col.key} className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                          r.cur_status === 'Available' ? 'bg-green-100 text-green-800' :
                          r.cur_status === 'Memo' ? 'bg-yellow-100 text-yellow-800' :
                          r.cur_status === 'Sold' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'}`}>
                          {r.cur_status || '—'}
                        </span>
                      </td>
                    );
                    return (
                      <td key={col.key} className={`px-3 py-2 ${col.num ? 'text-right' : ''}`}>
                        {col.num ? (Number(r[col.key] || 0).toFixed(col.key.includes('weight') || col.key === 'carats' || col.key === 'opening_weight_carats' ? 3 : 2)) : (r[col.key] ?? '')}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={COLS.length + 1} className="text-center py-8 text-gray-400">No records</td></tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-gray-100 border-t font-semibold text-sm">
                <tr>
                  <td className="px-3 py-2 text-right text-gray-600">Totals</td>
                  {visibleCols.map(col => {
                    const totalsMap = {
                      carats: totalCarats.toFixed(3),
                      on_hand_weight: totalOnHand.toFixed(3),
                      on_memo_weight: totalMemo.toFixed(3),
                      asking_usd_amount: totalAmount.toFixed(2),
                    };
                    return (
                      <td key={col.key} className={`px-3 py-2 ${col.num ? 'text-right' : ''}`}>
                        {totalsMap[col.key] ?? ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* More popup */}
        {showMorePopup && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowMorePopup(false)}>
            <div className="bg-white rounded-xl shadow-xl p-5 w-96 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Edit Details</h3>
                <button onClick={() => setShowMorePopup(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
              </div>
              <div className="flex gap-2 border-b pb-2">
                <button onClick={() => setMoreTab('location')}
                  className={`px-3 py-1 text-sm rounded ${moreTab === 'location' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  Update Location
                </button>
                <button onClick={() => setMoreTab('boxgroup')}
                  className={`px-3 py-1 text-sm rounded ${moreTab === 'boxgroup' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  Update Box &amp; Group
                </button>
              </div>
              {moreTab === 'location' && (
                <div className="space-y-3">
                  {['city', 'state', 'country'].map(f => (
                    <div key={f}>
                      <label className="text-xs font-semibold text-gray-600 uppercase">{f}</label>
                      <input value={locationForm[f]} onChange={e => setLocationForm(p => ({ ...p, [f]: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  ))}
                  <button onClick={submitLocation} disabled={moreLoading}
                    className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {moreLoading ? 'Saving...' : 'Update Location'}
                  </button>
                </div>
              )}
              {moreTab === 'boxgroup' && (
                <div className="space-y-3">
                  {[['box_name', 'Box Name'], ['group_name', 'Group Name']].map(([f, lbl]) => (
                    <div key={f}>
                      <label className="text-xs font-semibold text-gray-600 uppercase">{lbl}</label>
                      <input value={boxGroupForm[f]} onChange={e => setBoxGroupForm(p => ({ ...p, [f]: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  ))}
                  <button onClick={submitBoxGroup} disabled={moreLoading}
                    className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {moreLoading ? 'Saving...' : 'Update Box &amp; Group'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // SEARCH VIEW
  // ═══════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Parcel Stock Search</h2>
        <div className="flex gap-2">
          <button onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
            <RotateCcw className="w-4 h-4" /> Clear
          </button>
          <button onClick={handleReport} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
            <Search className="w-4 h-4" /> {loading ? 'Loading...' : 'Report'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ─── TAB 1: Basic & Grading Search ─── */}
          {activeTab === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TextField label="Stock Till Date" value={filters.stock_to_date} onChange={v => update('stock_to_date', v)} type="date" />
                <SelectField label="Show" value={filters.show} onChange={v => update('show', v)}
                  options={['Available', 'Hold', 'Memo', 'Sold']} />
                <SelectField label="Unsold / Hold / Unhold" value={filters.hold_status} onChange={v => update('hold_status', v)}
                  options={['Hold', 'Unhold']} />
                <SelectField label="Single / Parcel" value={filters.single_parcel} onChange={v => update('single_parcel', v)}
                  options={['Single', 'Parcel']} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <TextField label="Enter Lot No" value={filters.lot_no} onChange={v => update('lot_no', v)} placeholder="Search LotNo..." />
                <TextField label="Size" value={filters.size} onChange={v => update('size', v)} />
                <TextField label="Sieve" value={filters.sieve} onChange={v => update('sieve', v)} />
              </div>

              <ChipGroup label="Shape" options={shapes} selected={filters.shapes} onChange={v => update('shapes', v)} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChipGroup label="Color" options={colors} selected={filters.colors} onChange={v => update('colors', v)} />
                <ChipGroup label="Clarity" options={clarities} selected={filters.clarities} onChange={v => update('clarities', v)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RangeInput label="Carats From / To" fromVal={filters.carat_from} toVal={filters.carat_to}
                  onFromChange={v => update('carat_from', v)} onToChange={v => update('carat_to', v)} step="0.01" />
                <RangeInput label="Price From / To" fromVal={filters.price_from} toVal={filters.price_to}
                  onFromChange={v => update('price_from', v)} onToChange={v => update('price_to', v)} step="1" />
              </div>
            </div>
          )}

          {/* ─── TAB 2: Numeric Search ─── */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RangeInput label="Table Depth %" fromVal={filters.table_depth_from} toVal={filters.table_depth_to}
                  onFromChange={v => update('table_depth_from', v)} onToChange={v => update('table_depth_to', v)} step="0.1" />
                <RangeInput label="Table %" fromVal={filters.table_pct_from} toVal={filters.table_pct_to}
                  onFromChange={v => update('table_pct_from', v)} onToChange={v => update('table_pct_to', v)} step="0.1" />
                <RangeInput label="CA (Crown Angle)" fromVal={filters.ca_from} toVal={filters.ca_to}
                  onFromChange={v => update('ca_from', v)} onToChange={v => update('ca_to', v)} step="0.1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RangeInput label="CH (Crown Height)" fromVal={filters.ch_from} toVal={filters.ch_to}
                  onFromChange={v => update('ch_from', v)} onToChange={v => update('ch_to', v)} step="0.1" />
                <RangeInput label="PH (Pavilion Height)" fromVal={filters.ph_from} toVal={filters.ph_to}
                  onFromChange={v => update('ph_from', v)} onToChange={v => update('ph_to', v)} step="0.1" />
                <RangeInput label="PA (Pavilion Angle)" fromVal={filters.pa_from} toVal={filters.pa_to}
                  onFromChange={v => update('pa_from', v)} onToChange={v => update('pa_to', v)} step="0.1" />
              </div>
            </div>
          )}

          {/* ─── TAB 3: Date Search ─── */}
          {activeTab === 2 && (
            <div className="space-y-4 max-w-2xl">
              <DateRangeRow label="Purchase Date" enabled={filters.purchase_date_enabled}
                onToggle={v => update('purchase_date_enabled', v)}
                fromVal={filters.purchase_date_from} toVal={filters.purchase_date_to}
                onFromChange={v => update('purchase_date_from', v)} onToChange={v => update('purchase_date_to', v)} />
              <DateRangeRow label="Revision Date" enabled={filters.revision_date_enabled}
                onToggle={v => update('revision_date_enabled', v)}
                fromVal={filters.revision_date_from} toVal={filters.revision_date_to}
                onFromChange={v => update('revision_date_from', v)} onToChange={v => update('revision_date_to', v)} />
              <DateRangeRow label="New Arrival" enabled={filters.new_arrival_enabled}
                onToggle={v => update('new_arrival_enabled', v)}
                fromVal={filters.new_arrival_from} toVal={filters.new_arrival_to}
                onFromChange={v => update('new_arrival_from', v)} onToChange={v => update('new_arrival_to', v)} />
              <DateRangeRow label="Web Revised" enabled={filters.web_revised_enabled}
                onToggle={v => update('web_revised_enabled', v)}
                fromVal={filters.web_revised_from} toVal={filters.web_revised_to}
                onFromChange={v => update('web_revised_from', v)} onToChange={v => update('web_revised_to', v)} />
              <DateRangeRow label="Unhold Date" enabled={filters.unhold_date_enabled}
                onToggle={v => update('unhold_date_enabled', v)}
                fromVal={filters.unhold_date_from} toVal={filters.unhold_date_to}
                onFromChange={v => update('unhold_date_from', v)} onToChange={v => update('unhold_date_to', v)} />
              <DateRangeRow label="Lab Date" enabled={filters.lab_date_enabled}
                onToggle={v => update('lab_date_enabled', v)}
                fromVal={filters.lab_date_from} toVal={filters.lab_date_to}
                onFromChange={v => update('lab_date_from', v)} onToChange={v => update('lab_date_to', v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
