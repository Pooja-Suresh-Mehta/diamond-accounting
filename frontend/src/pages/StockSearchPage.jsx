import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Search, RotateCcw, Download, Printer, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { fmtAmt } from '../utils/format';

// ── Filter chip component ─────────────────────────────
function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`filter-chip ${selected ? 'filter-chip-active' : 'filter-chip-inactive'}`}
    >
      {label}
    </button>
  );
}

// ── Multi-select chip group ───────────────────────────
function ChipGroup({ label, options, selected, onChange }) {
  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <Chip key={opt} label={opt} selected={selected.includes(opt)} onClick={() => toggle(opt)} />
        ))}
      </div>
    </div>
  );
}

// ── Range input pair ──────────────────────────────────
function RangeInput({ label, fromVal, toVal, onFromChange, onToChange, step = "any" }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        <input type="number" placeholder="From" step={step} value={fromVal || ''} onChange={e => onFromChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" />
        <input type="number" placeholder="To" step={step} value={toVal || ''} onChange={e => onToChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      </div>
    </div>
  );
}

// ── Radio group ───────────────────────────────────────
function RadioGroup({ label, options, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" name={label} checked={value === opt} onChange={() => onChange(opt)}
              className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Initial filter state ──────────────────────────────
const getInitFilters = () => {
  const today = getCurrentDateISO();
  return {
    show: 'All', hold_status: 'All', stone_type: 'All', status: 'All',
    stock_till_date: today, search_field_type: '', search_field_value: '',
    shapes: [], color_groups: [], colors: [], size_ranges: [], clarities: [],
    cuts: [], polishes: [], symmetries: [], labs: [],
    fluorescences: [], fl_colors: [], milky_values: [], shades: [],
    carats_from: null, carats_to: null, back_pct_from: null, back_pct_to: null,
    price_from: null, price_to: null, lot_no_from: '', lot_no_to: '',
    length_from: null, length_to: null, width_from: null, width_to: null,
    depth_from: null, depth_to: null, depth_pct_from: null, depth_pct_to: null,
    table_pct_from: null, table_pct_to: null, lw_ratio_from: null, lw_ratio_to: null,
    crown_angle_from: null, crown_angle_to: null, crown_height_from: null, crown_height_to: null,
    pavilion_angle_from: null, pavilion_angle_to: null, pavilion_height_from: null, pavilion_height_to: null,
    date_type: '', date_from: today, date_to: today,
    sort_by: '',
  };
};


export default function StockSearchPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState(getInitFilters());
  const [options, setOptions] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Load filter options
  useEffect(() => {
    api.get('/diamonds/filter-options').then(res => setOptions(res.data)).catch(() => {});
  }, []);

  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  const handleSearch = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const body = {
        ...filters,
        stock_till_date: filters.stock_till_date || null,
        date_from: filters.date_from || null,
        date_to: filters.date_to || null,
        search_field_type: filters.search_field_type || null,
        search_field_value: filters.search_field_value || null,
        date_type: filters.date_type || null,
        sort_by: filters.sort_by || null,
        lot_no_from: filters.lot_no_from || null,
        lot_no_to: filters.lot_no_to || null,
        page: p,
        page_size: pageSize,
      };
      const res = await api.post('/diamonds/search', body);
      setResults(res.data);
      setPage(p);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleReset = () => {
    setFilters(getInitFilters());
    setResults(null);
    setPage(1);
  };

  const tabs = ['Basic & Grading', 'Numeric Search', 'Date Search', 'Report'];

  if (!options) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Stock Search</h1>
        <div className="flex gap-2">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={() => handleSearch(1)} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50">
            <Search className="w-4 h-4" /> {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Tabs */}
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
          {/* ─── TAB 1: Basic & Grading ─── */}
          {activeTab === 0 && (
            <div className="space-y-5">
              {/* Inventory filters row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RadioGroup label="Show" options={['All', 'Sold', 'Unsold']} value={filters.show} onChange={v => update('show', v)} />
                <RadioGroup label="Hold / UnHold" options={['All', 'Hold', 'Unhold']} value={filters.hold_status} onChange={v => update('hold_status', v)} />
                <RadioGroup label="Single / Parcel" options={['Single', 'Parcel', 'All']} value={filters.stone_type} onChange={v => update('stone_type', v)} />
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</label>
                  <select value={filters.status} onChange={e => update('status', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none">
                    {options.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Date & Identifier row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stock Till Date</label>
                  <input type="date" value={filters.stock_till_date} onChange={e => update('stock_till_date', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Search Type</label>
                  <select value={filters.search_field_type} onChange={e => update('search_field_type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="">Select...</option>
                    {options.search_field_types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Search Value</label>
                  <input type="text" value={filters.search_field_value} onChange={e => update('search_field_value', e.target.value)}
                    placeholder="Enter value (comma-separated for multiple)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* Diamond Specs */}
              <ChipGroup label="Shape" options={options.shapes} selected={filters.shapes} onChange={v => update('shapes', v)} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChipGroup label="Color Group" options={options.color_groups} selected={filters.color_groups} onChange={v => update('color_groups', v)} />
                <ChipGroup label="Color" options={options.colors} selected={filters.colors} onChange={v => update('colors', v)} />
              </div>
              <ChipGroup label="Size (Carat Range)" options={options.size_ranges} selected={filters.size_ranges} onChange={v => update('size_ranges', v)} />
              <ChipGroup label="Clarity" options={options.clarities} selected={filters.clarities} onChange={v => update('clarities', v)} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChipGroup label="Cut (Prop)" options={options.cuts} selected={filters.cuts} onChange={v => update('cuts', v)} />
                <ChipGroup label="Polish" options={options.polishes} selected={filters.polishes} onChange={v => update('polishes', v)} />
                <ChipGroup label="Symmetry" options={options.symmetries} selected={filters.symmetries} onChange={v => update('symmetries', v)} />
              </div>
              <ChipGroup label="Lab" options={options.labs} selected={filters.labs} onChange={v => update('labs', v)} />

              {/* Advanced Visual */}
              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Advanced Visual Filters</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChipGroup label="Fluorescence" options={options.fluorescences} selected={filters.fluorescences} onChange={v => update('fluorescences', v)} />
                  <ChipGroup label="FL Color" options={options.fl_colors} selected={filters.fl_colors} onChange={v => update('fl_colors', v)} />
                  <ChipGroup label="Milky" options={options.milky_values} selected={filters.milky_values} onChange={v => update('milky_values', v)} />
                  <ChipGroup label="Shade" options={options.shades} selected={filters.shades} onChange={v => update('shades', v)} />
                </div>
              </div>

              {/* Numeric Range Overrides */}
              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Numeric Ranges</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <RangeInput label="Carats" fromVal={filters.carats_from} toVal={filters.carats_to} onFromChange={v => update('carats_from', v)} onToChange={v => update('carats_to', v)} step="0.01" />
                  <RangeInput label="Back %" fromVal={filters.back_pct_from} toVal={filters.back_pct_to} onFromChange={v => update('back_pct_from', v)} onToChange={v => update('back_pct_to', v)} step="0.1" />
                  <RangeInput label="Price" fromVal={filters.price_from} toVal={filters.price_to} onFromChange={v => update('price_from', v)} onToChange={v => update('price_to', v)} step="1" />
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Lot No Range</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="From" value={filters.lot_no_from} onChange={e => update('lot_no_from', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                      <input type="text" placeholder="To" value={filters.lot_no_to} onChange={e => update('lot_no_to', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sorting */}
              <div className="border-t pt-4 mt-2">
                <div className="max-w-md">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Sort By</label>
                  <select value={filters.sort_by} onChange={e => update('sort_by', e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="">Default (Lot No)</option>
                    {options.sort_options.map(s => <option key={s} value={s}>Sort On {s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: Numeric Search ─── */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Measurements</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <RangeInput label="Length (mm)" fromVal={filters.length_from} toVal={filters.length_to} onFromChange={v => update('length_from', v)} onToChange={v => update('length_to', v)} step="0.01" />
                  <RangeInput label="Width (mm)" fromVal={filters.width_from} toVal={filters.width_to} onFromChange={v => update('width_from', v)} onToChange={v => update('width_to', v)} step="0.01" />
                  <RangeInput label="Depth (mm)" fromVal={filters.depth_from} toVal={filters.depth_to} onFromChange={v => update('depth_from', v)} onToChange={v => update('depth_to', v)} step="0.01" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Proportions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <RangeInput label="Depth %" fromVal={filters.depth_pct_from} toVal={filters.depth_pct_to} onFromChange={v => update('depth_pct_from', v)} onToChange={v => update('depth_pct_to', v)} step="0.1" />
                  <RangeInput label="Table %" fromVal={filters.table_pct_from} toVal={filters.table_pct_to} onFromChange={v => update('table_pct_from', v)} onToChange={v => update('table_pct_to', v)} step="0.1" />
                  <RangeInput label="L/W Ratio" fromVal={filters.lw_ratio_from} toVal={filters.lw_ratio_to} onFromChange={v => update('lw_ratio_from', v)} onToChange={v => update('lw_ratio_to', v)} step="0.01" />
                  <RangeInput label="Crown Angle" fromVal={filters.crown_angle_from} toVal={filters.crown_angle_to} onFromChange={v => update('crown_angle_from', v)} onToChange={v => update('crown_angle_to', v)} step="0.1" />
                  <RangeInput label="Crown Height" fromVal={filters.crown_height_from} toVal={filters.crown_height_to} onFromChange={v => update('crown_height_from', v)} onToChange={v => update('crown_height_to', v)} step="0.1" />
                  <RangeInput label="Pavilion Angle" fromVal={filters.pavilion_angle_from} toVal={filters.pavilion_angle_to} onFromChange={v => update('pavilion_angle_from', v)} onToChange={v => update('pavilion_angle_to', v)} step="0.1" />
                  <RangeInput label="Pavilion Height" fromVal={filters.pavilion_height_from} toVal={filters.pavilion_height_to} onFromChange={v => update('pavilion_height_from', v)} onToChange={v => update('pavilion_height_to', v)} step="0.1" />
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 3: Date Search ─── */}
          {activeTab === 2 && (
            <div className="space-y-4 max-w-lg">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Date Type</label>
                <select value={filters.date_type} onChange={e => update('date_type', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="">Select date type...</option>
                  <option value="Purchase">Purchase Date</option>
                  <option value="LabIn">Lab In Date</option>
                  <option value="LabOut">Lab Out Date</option>
                  <option value="Status">Status Date</option>
                  <option value="Entry">Entry Date</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">From Date</label>
                  <input type="date" value={filters.date_from} onChange={e => update('date_from', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">To Date</label>
                  <input type="date" value={filters.date_to} onChange={e => update('date_to', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 4: Report (View Settings) ─── */}
          {activeTab === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Display Columns</h3>
                <p className="text-sm text-gray-500 mb-2">The results table below shows Image, Video, Cert, and Key to Symbols columns when available.</p>
                <div className="flex flex-wrap gap-2">
                  {['Image', 'Video', 'Certificate', 'Key to Symbols', 'Rapaport', 'Back %', 'Net Price'].map(col => (
                    <span key={col} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-md border border-blue-200">{col}</span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Export Actions</h3>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition">
                    <Download className="w-4 h-4" /> Export Excel
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Results Table ── */}
      {results && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{results.total.toLocaleString()}</span> stones found
            </p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => handleSearch(page - 1)}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">Page {results.page} of {Math.ceil(results.total / pageSize) || 1}</span>
              <button disabled={page >= Math.ceil(results.total / pageSize)} onClick={() => handleSearch(page + 1)}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['#', 'Lot No', 'Shape', 'Carats', 'Color', 'Clarity', 'Cut', 'Polish', 'Sym', 'Lab', 'Flou',
                    'Rap', 'Back%', '$/ct', 'Total', 'Status', 'Cert No'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.results.map((d, i) => (
                  <tr key={d.id} className="hover:bg-blue-50/50 transition">
                    <td className="px-3 py-2 text-gray-500">{(results.page - 1) * pageSize + i + 1}</td>
                    <td className="px-3 py-2 font-medium text-blue-600">{d.lot_no}</td>
                    <td className="px-3 py-2">{d.shape}</td>
                    <td className="px-3 py-2 font-medium">{fmtAmt(d.carats)}</td>
                    <td className="px-3 py-2">{d.color}</td>
                    <td className="px-3 py-2">{d.clarity}</td>
                    <td className="px-3 py-2">{d.cut}</td>
                    <td className="px-3 py-2">{d.polish}</td>
                    <td className="px-3 py-2">{d.symmetry}</td>
                    <td className="px-3 py-2">{d.lab}</td>
                    <td className="px-3 py-2">{d.fluorescence}</td>
                    <td className="px-3 py-2 text-right">{d.rap_price?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-600">{d.back_pct?.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{d.price_per_carat?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium">${d.total_price?.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.status === 'OnHand' ? 'bg-green-100 text-green-700' :
                        d.status === 'Sold' ? 'bg-red-100 text-red-700' :
                        d.status === 'OnMemo' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{d.cert_no}</td>
                  </tr>
                ))}
                {results.results.length === 0 && (
                  <tr><td colSpan={17} className="text-center py-8 text-gray-400">No diamonds found matching your criteria</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
