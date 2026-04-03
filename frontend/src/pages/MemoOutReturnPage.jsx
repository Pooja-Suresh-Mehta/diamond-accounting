import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api';
import ListPageControls from '../components/ListPageControls';
import PartyField from '../components/PartyField';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { calculateTotals, getCurrencyDefaults } from '../utils/parcelTransactionCalc';

const INIT_ITEM = {
  lot_number: '',
  item_name: '',
  weight: 0,
  pcs: 0,
  rate: 0,
  usd_rate: 0,
  less1_sign: '-',
  less1: 0,
  less2_sign: '-',
  less2: 0,
  less3_sign: '+',
  less3: 0,
  amount: 0,
};

const INIT = {
  date: getCurrentDateISO(),
  print_date: getCurrentDateISO(),
  invoice_number: '',
  source_memo_number: '',
  purchase_type: 'LOCAL',
  sub_type: '',
  category: 'Natural Diamond',
  party: '',
  due_days: 0,
  due_date: getCurrentDateISO(),
  currency: 'USD',
  inr_rate: 85,
  usd_rate: 1,
  save_grading: false,
  plus_minus_amount: 0,
  net_amount: 0,
  m_currency_net_amount: 0,
  cgst_pct: 0,
  cgst_amount: 0,
  sgst_pct: 0,
  sgst_amount: 0,
  igst_pct: 0,
  igst_amount: 0,
  vat_pct: 0,
  vat_amount: 0,
  inr_final_amount: 0,
  usd_final_amount: 0,
  transaction_final_amount: 0,
  payment_status: 'Pending',
  items: [],
};

const numericFields = new Set([
  'due_days', 'inr_rate', 'usd_rate',
  'plus_minus_amount', 'net_amount', 'm_currency_net_amount', 'cgst_pct', 'cgst_amount',
  'sgst_pct', 'sgst_amount', 'igst_pct', 'igst_amount', 'vat_pct', 'vat_amount',
  'inr_final_amount', 'usd_final_amount', 'transaction_final_amount',
]);
const itemNumericFields = new Set(['weight', 'pcs', 'rate', 'usd_rate', 'less1', 'less2', 'less3', 'amount']);

function F({ label, name, value, onChange, options = [], type = 'text', readOnly = false, searchable = false, onAddNew }) {
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
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        {onAddNew && (
          <button type="button" onClick={onAddNew} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ New</button>
        )}
      </div>
      {options.length ? (
        shouldSearch ? (
          <>
            <input list={`list-${name}`} value={value || ''} onChange={(e) => onChange(name, e.target.value)}
              placeholder={`Search ${label}`} readOnly={readOnly} className={cls} />
            <datalist id={`list-${name}`}>{options.map((o) => <option key={o} value={o} />)}</datalist>
          </>
        ) : (
          <select value={value || ''} onChange={(e) => onChange(name, e.target.value)} disabled={readOnly} className={cls}>
            <option value="">Select {label}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      ) : (
        <input type={type} value={inputValue}
          onFocus={() => { if (isNumber && numericZero) onChange(name, ''); }}
          onBlur={handleBlur}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly} placeholder={isNumber ? '0.00' : ''} step={isNumber ? '0.01' : undefined}
          className={cls} />
      )}
    </div>
  );
}

function calcItemAmount(item) {
  const base = Number(item.weight || 0) * Number(item.rate || 0);
  const l1 = (base * Number(item.less1 || 0)) / 100;
  const l2 = (base * Number(item.less2 || 0)) / 100;
  const l3 = (base * Number(item.less3 || 0)) / 100;
  const sign = (s, v) => (s === '+' ? v : -v);
  return Number((base + sign(item.less1_sign, l1) + sign(item.less2_sign, l2) + sign(item.less3_sign, l3)).toFixed(2));
}

function calcUsdRate(rate, currency, inrRate, aedRate) {
  const r = Number(rate || 0);
  if (currency === 'INR') return inrRate > 0 ? Number((r / inrRate).toFixed(2)) : 0;
  if (currency === 'AED') return aedRate > 0 ? Number((r / aedRate).toFixed(2)) : 0;
  return r;
}

export default function MemoOutReturnPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isAddMode = location.pathname.endsWith('/add');
  const isEditMode = location.pathname.includes('/edit/');
  const isFormMode = isAddMode || isEditMode;

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INIT);
  const [opts, setOpts] = useState({
    types: [], sub_types: [], categories: [], currencies: ['USD', 'INR', 'AED'],
    currency_rates: {}, parties: [], payment_statuses: [],
    next_invoice_number: '1', memo_numbers: [], memo_items: [],
  });
  const [memoSearch, setMemoSearch] = useState('');

  const loadRows = async () => {
    const res = await api.get('/memo-out-return', { params: { search } });
    setRows(Array.isArray(res.data) ? res.data : []);
    setPage(1);
  };
  const loadOpts = async () => {
    const res = await api.get('/memo-out-return/options');
    setOpts(res.data);
  };
  const loadEdit = async () => {
    if (!id) return;
    const res = await api.get(`/memo-out-return/${id}`);
    const base = { ...INIT, ...res.data, date: res.data.date || getCurrentDateISO(), due_date: res.data.due_date || getCurrentDateISO() };
    setForm({
      ...base,
      items: (base.items || []).map((item) => ({
        ...item,
        less1_sign: item.less1_sign || '-',
        less2_sign: item.less2_sign || '-',
        less3_sign: item.less3_sign || '+',
      })),
    });
    setMemoSearch(base.source_memo_number || '');
  };

  useEffect(() => {
    loadOpts().catch(() => toast.error('Failed to load options'));
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadOpts().catch(() => {}); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  useEffect(() => { if (!isFormMode) loadRows().catch(() => toast.error('Failed to load memo out returns')); }, [search, isFormMode]);
  useEffect(() => {
    if (isEditMode) loadEdit().catch(() => toast.error('Failed to load record'));
    if (isAddMode) {
      setForm({ ...INIT, invoice_number: String(opts.next_invoice_number || '1') });
      setMemoSearch('');
    }
  }, [isEditMode, isAddMode, id, opts.next_invoice_number]);

  const setValue = (name, value) => {
    setForm((p) => {
      const next = { ...p, [name]: numericFields.has(name) ? (value === '' ? '' : Number(value)) : value };
      if (name === 'currency') {
        const defaults = opts.currency_rates?.[value] || getCurrencyDefaults(value);
        next.inr_rate = defaults.inr_rate;
        next.usd_rate = defaults.usd_rate;
      }
      return next;
    });
  };

  const updateItemField = (idx, name, value) => {
    setForm((p) => {
      const items = p.items.map((it, i) => {
        if (i !== idx) return it;
        const raw = { ...it, [name]: itemNumericFields.has(name) ? (value === '' ? '' : Number(value)) : value };
        raw.usd_rate = calcUsdRate(raw.rate, p.currency, p.inr_rate, p.usd_rate);
        raw.amount = calcItemAmount(raw);
        return raw;
      });
      return { ...p, items };
    });
  };

  const setLessSign = (idx, field, sign) => {
    setForm((p) => {
      const items = p.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: sign };
        updated.amount = calcItemAmount(updated);
        return updated;
      });
      return { ...p, items };
    });
  };

  // Load items from selected memo
  const loadMemoItems = () => {
    const memo = (opts.memo_items || []).find((m) => m.invoice_number === memoSearch);
    if (!memo) return toast.error('Memo not found');
    setForm((p) => ({
      ...p,
      source_memo_number: memo.invoice_number,
      party: memo.party || p.party,
      currency: memo.currency || p.currency,
      inr_rate: memo.inr_rate || p.inr_rate,
      usd_rate: memo.usd_rate || p.usd_rate,
      items: (memo.items || []).map((it) => ({
        ...INIT_ITEM,
        lot_number: it.lot_number || '',
        item_name: it.item_name || '',
        weight: Number(it.weight || 0),
        pcs: Number(it.pcs || 0),
        rate: Number(it.rate || 0),
        usd_rate: Number(it.usd_rate || 0),
        amount: calcItemAmount({ ...INIT_ITEM, weight: it.weight || 0, rate: it.rate || 0 }),
      })),
    }));
    toast.success(`Loaded memo ${memo.invoice_number}`);
  };

  const removeLot = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  useEffect(() => {
    setForm((p) => ({ ...p, ...calculateTotals(p) }));
  }, [form.items, form.currency, form.cgst_pct, form.sgst_pct, form.igst_pct, form.vat_pct, form.inr_rate, form.usd_rate]);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['Invoice','Memo No.','Date','Print Date','Party','Type','Sub Type','Category','Carats','Amount','Currency','INR Amt','USD Amt','Due Date','Status'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([r.invoice_number,r.source_memo_number||'',r.date,r.print_date||'',r.party,r.purchase_type,r.sub_type,r.category,Number(r.total_carats||0).toFixed(2),Number(r.total_amount||0).toFixed(2),r.currency,Number(r.inr_amt||0).toFixed(2),Number(r.usd_amt||0).toFixed(2),r.due_date||'',r.payment_status].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'memo_out_return.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (!form.invoice_number.trim()) return toast.error('Invoice Number is required');
    if (!form.items.length) return toast.error('Add at least one lot item');
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.map(({ less1_sign, less2_sign, less3_sign, ...rest }) => ({
          ...rest, less1: Number(rest.less1 || 0), less2: Number(rest.less2 || 0), less3: Number(rest.less3 || 0),
        })),
      };
      if (isEditMode) await api.put(`/memo-out-return/${id}`, payload);
      else await api.post('/memo-out-return', payload);
      toast.success(isEditMode ? 'Updated' : 'Created');
      navigate('/parcel/memo-out-return', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (rid) => {
    if (!confirm('Delete memo out return?')) return;
    await api.delete(`/memo-out-return/${rid}`);
    await loadRows();
  };

  if (!isFormMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Parcel Transactions / Memo Out Return</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { navigate('/parcel/memo-out-return/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Memo Out Return</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit}
            onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages}
            onPageChange={setPage} pageOptions={[100, 500, 1000, 1500]} />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['Action', 'Invoice', 'Memo No.', 'Date', 'Print Date', 'Party', 'Type', 'Sub Type', 'Category', 'Carats', 'Amount', 'Currency', 'INR Amt', 'USD Amt', 'DueDate', 'Status'].map((h) => (
                    <th key={h} className="text-left px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/parcel/memo-out-return/edit/${r.id}`)} className="text-blue-600">Edit</button>
                        <button onClick={() => removeRow(r.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.invoice_number}</td>
                    <td className="px-3 py-2">{r.source_memo_number || ''}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.print_date || ''}</td>
                    <td className="px-3 py-2">{r.party}</td>
                    <td className="px-3 py-2">{r.purchase_type}</td>
                    <td className="px-3 py-2">{r.sub_type}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2 text-right">{Number(r.total_carats || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.total_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.currency}</td>
                    <td className="px-3 py-2 text-right">{Number(r.inr_amt || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.usd_amt || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.due_date || ''}</td>
                    <td className="px-3 py-2">{r.payment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Memo Out Return / {isEditMode ? 'Edit' : 'Add'}</h1>
        <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Submit'}</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <F label="Date" name="date" type="date" value={form.date} onChange={setValue} />
          <F label="Print Date" name="print_date" type="date" value={form.print_date} onChange={setValue} />
          <F label="Invoice Number" name="invoice_number" value={form.invoice_number} onChange={setValue} readOnly />
          <F label="Type" name="purchase_type" value={form.purchase_type} onChange={setValue} options={opts.types} />
          <F label="Sub Type" name="sub_type" value={form.sub_type} onChange={setValue} options={opts.sub_types} />
          <F label="Category" name="category" value={form.category} onChange={setValue} options={opts.categories} />
          <PartyField value={form.party} onChange={setValue} options={opts.parties} />
          <F label="Due Days" name="due_days" value={form.due_days} onChange={setValue} type="number" />
          <F label="Due Date" name="due_date" value={form.due_date} onChange={setValue} type="date" />
          <F label="Currency" name="currency" value={form.currency} onChange={setValue} options={opts.currencies} />
          <F label="INR *" name="inr_rate" value={form.inr_rate} onChange={setValue} type="number" />
          <F label="USD /" name="usd_rate" value={form.usd_rate} onChange={setValue} type="number" />
        </div>

        {/* Show Memo section */}
        <div className="border-t pt-5">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Show Memo</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Memo Number</label>
              <input
                list="memo-list"
                value={memoSearch}
                onChange={(e) => setMemoSearch(e.target.value)}
                placeholder="Type or select memo number"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <datalist id="memo-list">
                {(opts.memo_numbers || []).map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
            <button
              onClick={loadMemoItems}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg whitespace-nowrap"
            >
              Show Memo
            </button>
          </div>
        </div>

        {/* Lot items from memo */}
        {form.items.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Memo Items (Return)</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['LotNo', 'Item', 'Weight', 'Pcs', 'Rate', '$Rate', 'Less1', 'Less2', 'Less3', 'Amount', 'Action'].map((h) => (
                      <th key={h} className="text-left px-2 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={`${it.lot_number}-${idx}`} className="border-t border-gray-100">
                      <td className="px-2 py-1">{it.lot_number}</td>
                      <td className="px-2 py-1">{it.item_name}</td>
                      <td className="px-2 py-1 text-right">{Number(it.weight || 0).toFixed(2)}</td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-16 px-1 py-1 border rounded text-right text-sm" value={it.pcs || ''} placeholder="0"
                          onChange={(e) => updateItemField(idx, 'pcs', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-20 px-1 py-1 border rounded text-right text-sm" value={it.rate || ''} placeholder="0.00" step="0.01"
                          onChange={(e) => updateItemField(idx, 'rate', e.target.value)} />
                      </td>
                      <td className="px-2 py-1 text-right">{Number(it.usd_rate || 0).toFixed(2)}</td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <select className="w-10 px-1 py-1 border rounded text-sm" value={it.less1_sign} onChange={(e) => setLessSign(idx, 'less1_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                          <input type="number" className="w-16 px-1 py-1 border rounded text-right text-sm" value={it.less1 || ''} placeholder="0.00" step="0.01" onChange={(e) => updateItemField(idx, 'less1', e.target.value)} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <select className="w-10 px-1 py-1 border rounded text-sm" value={it.less2_sign} onChange={(e) => setLessSign(idx, 'less2_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                          <input type="number" className="w-16 px-1 py-1 border rounded text-right text-sm" value={it.less2 || ''} placeholder="0.00" step="0.01" onChange={(e) => updateItemField(idx, 'less2', e.target.value)} />
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <select className="w-10 px-1 py-1 border rounded text-sm" value={it.less3_sign} onChange={(e) => setLessSign(idx, 'less3_sign', e.target.value)}><option value="+">+</option><option value="-">-</option></select>
                          <input type="number" className="w-16 px-1 py-1 border rounded text-right text-sm" value={it.less3 || ''} placeholder="0.00" step="0.01" onChange={(e) => updateItemField(idx, 'less3', e.target.value)} />
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">{Number(it.amount || 0).toFixed(2)}</td>
                      <td className="px-2 py-1"><button onClick={() => removeLot(idx)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Amount section */}
        <div className="border-t pt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="font-semibold text-gray-700">Net Amount ({form.currency || 'USD'})</span><span className="text-2xl font-bold text-gray-700">{Number(form.net_amount || 0).toFixed(2)}</span></div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">CGST%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.cgst_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('cgst_pct', e.target.value)} />
              <input type="number" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={form.cgst_amount} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">SGST%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.sgst_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('sgst_pct', e.target.value)} />
              <input type="number" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={form.sgst_amount} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">IGST%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.igst_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('igst_pct', e.target.value)} />
              <input type="number" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={form.igst_amount} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">VAT%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.vat_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('vat_pct', e.target.value)} />
              <input type="number" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={form.vat_amount} readOnly />
            </div>
          </div>
          <div className="space-y-3 border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>INR FINAL AMOUNT</span><span className="text-3xl">{Number(form.inr_final_amount || 0).toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>USD FINAL AMOUNT</span><span className="text-3xl">{Number(form.usd_final_amount || 0).toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>TRANSACTION FINAL AMOUNT</span><span className="text-3xl">{Number(form.transaction_final_amount || 0).toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
