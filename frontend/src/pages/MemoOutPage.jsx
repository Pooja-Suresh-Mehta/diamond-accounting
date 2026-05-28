import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import ListPageControls from '../components/ListPageControls';
import PartyField from '../components/PartyField';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { calculateTotals, getCurrencyDefaults } from '../utils/parcelTransactionCalc';
import NumericInput from '../components/NumericInput';
import { fmtAmt, fmtDate } from '../utils/format';
import F from '../components/FormField';

const INIT_ITEM = {
  lot_number: '',
  item_name: '',
  weight: 0,
  pcs: 0,
  rate: 0,
  usd_rate: 0,
  less1_sign: '-',
  less1: '',
  less2_sign: '-',
  less2: '',
  less3_sign: '+',
  less3: '',
  amount: 0,
};

const INIT = {
  date: getCurrentDateISO(),
  print_date: getCurrentDateISO(),
  invoice_number: '',
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
  if (currency === 'INR') return aedRate > 0 ? Number((r / aedRate).toFixed(2)) : 0;
  if (currency === 'AED') return aedRate > 0 ? Number((r / aedRate).toFixed(2)) : 0;
  return r;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value) => {
  if (!DATE_RE.test(String(value || ''))) return false;
  const dt = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(dt.getTime());
};

const addDaysToIsoDate = (value, days) => {
  const dt = new Date(`${value}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

export default function MemoOutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isAddMode = location.pathname.endsWith('/add');
  const isEditMode = location.pathname.includes('/edit/');
  const isFormMode = isAddMode || isEditMode;

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [lotNumberSearch, setLotNumberSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INIT);
  const [lotDraft, setLotDraft] = useState({ ...INIT_ITEM });
  const [opts, setOpts] = useState({
    types: [], sub_types: [], categories: [], currencies: ['USD', 'INR', 'AED'],
    currency_rates: {}, parties: [], lot_numbers: [], lot_items: [], payment_statuses: [],
    next_invoice_number: '1',
  });
  const [masterOpts, setMasterOpts] = useState({ sizes: [], sieves: [] });
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotFilters, setLotFilters] = useState({});
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const loadRows = async () => {
    const res = await api.get('/memo-out', { params: { search, lot_number: lotNumberSearch || undefined } });
    setRows(Array.isArray(res.data) ? res.data : []);
    setPage(1);
  };
  const loadOpts = async () => {
    const [memoRes, masterRes] = await Promise.all([
      api.get('/memo-out/options'),
      api.get('/parcel-master/options'),
    ]);
    setOpts(memoRes.data);
    setMasterOpts({ sizes: masterRes.data.sizes || [], sieves: masterRes.data.sieves || [] });
  };
  const loadNextInvoiceNumber = async () => {
    try {
      const res = await api.get('/memo-out/next-invoice-number');
      setOpts((p) => ({ ...p, next_invoice_number: res.data.next_invoice_number }));
    } catch (e) {
      toast.error('Failed to load next invoice number');
    }
  };
  const loadEdit = async () => {
    if (!id) return;
    const res = await api.get(`/memo-out/${id}`);
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
  };

  useEffect(() => {
    loadOpts().catch(() => toast.error('Failed to load options'));
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadOpts().catch(() => {}); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  useEffect(() => { if (!isFormMode) loadRows().catch(() => toast.error('Failed to load memo outs')); }, [search, lotNumberSearch, isFormMode]);
  useEffect(() => {
    if (isEditMode) loadEdit().catch(() => toast.error('Failed to load memo out'));
    if (isAddMode) {
      loadNextInvoiceNumber();
      setLotDraft({ ...INIT_ITEM });
      setForm((p) => ({ ...p, invoice_number: opts.next_invoice_number ? String(opts.next_invoice_number) : '1' }));
    }
  }, [isEditMode, isAddMode, id]);
  useEffect(() => {
    if (isAddMode && opts.next_invoice_number) {
      setForm((p) => ({ ...p, invoice_number: String(opts.next_invoice_number) }));
    }
  }, [opts.next_invoice_number, isAddMode]);

  const setValue = (name, value) => {
    setForm((p) => {
      const next = { ...p, [name]: numericFields.has(name) ? (value === '' ? '' : Number(value)) : value };
      if (name === 'currency') {
        const defaults = opts.currency_rates?.[value] || getCurrencyDefaults(value);
        next.inr_rate = defaults.inr_rate;
        next.usd_rate = defaults.usd_rate;
        // Re-normalize items and draft when currency or rates change
        next.items = next.items.map((item) => ({
          ...item,
          usd_rate: calcUsdRate(item.rate, next.currency, next.inr_rate, next.usd_rate),
          amount: calcItemAmount({ ...item, usd_rate: calcUsdRate(item.rate, next.currency, next.inr_rate, next.usd_rate) }),
        }));
        setLotDraft((draft) => ({
          ...draft,
          usd_rate: calcUsdRate(draft.rate, next.currency, next.inr_rate, next.usd_rate),
          amount: calcItemAmount({ ...draft, usd_rate: calcUsdRate(draft.rate, next.currency, next.inr_rate, next.usd_rate) }),
        }));
      }
      if (name === 'inr_rate' || name === 'usd_rate') {
        // Re-normalize items and draft when rates change
        next.items = next.items.map((item) => ({
          ...item,
          usd_rate: calcUsdRate(item.rate, next.currency, next.inr_rate, next.usd_rate),
          amount: calcItemAmount({ ...item, usd_rate: calcUsdRate(item.rate, next.currency, next.inr_rate, next.usd_rate) }),
        }));
        setLotDraft((draft) => ({
          ...draft,
          usd_rate: calcUsdRate(draft.rate, next.currency, next.inr_rate, next.usd_rate),
          amount: calcItemAmount({ ...draft, usd_rate: calcUsdRate(draft.rate, next.currency, next.inr_rate, next.usd_rate) }),
        }));
      }
      if (name === 'due_days' || name === 'date') {
        const d = name === 'date' ? value : next.date;
        const days = name === 'due_days' ? Number(value) : Number(next.due_days);
        if (isValidIsoDate(d) && Number.isFinite(days) && days >= 0) {
          next.due_date = addDaysToIsoDate(d, days);
        }
      }
      return next;
    });
  };

  const setDraftValue = (name, value) => {
    setLotDraft((draft) => {
      const raw = { ...draft, [name]: itemNumericFields.has(name) ? (value === '' ? '' : Number(value)) : value };
      raw.usd_rate = calcUsdRate(raw.rate, form.currency, form.inr_rate, form.usd_rate);
      raw.amount = calcItemAmount(raw);
      return raw;
    });
  };

  const setLessSign = (field, sign) => {
    setLotDraft((draft) => {
      const updated = { ...draft, [field]: sign };
      updated.amount = calcItemAmount(updated);
      return updated;
    });
  };

  const setLotFromMaster = (lotNo) => {
    if (!lotNo) { setLotDraft({ ...INIT_ITEM }); return; }
    const found = (opts.lot_items || []).find((l) => String(l.lot_no) === String(lotNo));
    setLotDraft((draft) => {
      const updated = {
        ...draft,
        lot_number: lotNo,
        item_name: found?.item_name || '',
        weight: Number(found?.opening_weight_carats || 0),
        pcs: Number(found?.opening_pcs || 0),
      };
      updated.usd_rate = calcUsdRate(updated.rate, form.currency, form.inr_rate, form.usd_rate);
      updated.amount = calcItemAmount(updated);
      return updated;
    });
  };

  const addLot = () => {
    if (!String(lotDraft.lot_number || '').trim()) return toast.error('Lot selection is required');
    const found = (opts.lot_items || []).find((l) => String(l.lot_no) === String(lotDraft.lot_number));
    if (found && !Number(found.purchase_cost_usd_amount || 0)) {
      return toast.error('Not enough stock in hand to make sale or memo.');
    }
    if (!Number(lotDraft.rate || 0)) return toast.error('Rate can not be 0');
    const item = {
      ...lotDraft,
      amount: calcItemAmount(lotDraft),
    };
    setForm((p) => ({ ...p, items: [...p.items, item] }));
    setLotDraft({ ...INIT_ITEM });
  };

  const removeLot = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const updateEditingItem = (name, value) => {
    setEditingItem((prev) => {
      const updated = { ...prev, [name]: itemNumericFields.has(name) ? (value === '' ? '' : Number(value)) : value };
      updated.usd_rate = calcUsdRate(updated.rate, form.currency, form.inr_rate, form.usd_rate);
      updated.amount = calcItemAmount(updated);
      return updated;
    });
  };

  const updateEditingLessSign = (field, sign) => {
    setEditingItem((prev) => {
      const updated = { ...prev, [field]: sign };
      updated.amount = calcItemAmount(updated);
      return updated;
    });
  };

  const saveEditingItem = () => {
    if (!editingItem || editingItemIdx === null) return;
    if (!Number(editingItem.rate || 0)) {
      return toast.error('Rate is required');
    }
    setForm((p) => {
      const updated = [...p.items];
      updated[editingItemIdx] = {
        ...editingItem,
        usd_rate: calcUsdRate(editingItem.rate, p.currency, p.inr_rate, p.usd_rate),
        amount: calcItemAmount(editingItem),
      };
      return { ...p, items: updated };
    });
    setEditingItem(null);
    setEditingItemIdx(null);
    toast.success('Item updated');
  };

  useEffect(() => {
    setForm((p) => ({ ...p, ...calculateTotals(p) }));
  }, [form.items, form.currency, form.cgst_pct, form.sgst_pct, form.igst_pct, form.vat_pct, form.inr_rate, form.usd_rate]);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['Invoice','Date','Print Date','Party','Type','Sub Type','Category','Carats','Amount','Currency','INR Amt','USD Amt','Due Date','Status'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([r.invoice_number,r.date,r.print_date||'',r.party,r.purchase_type,r.sub_type,r.category,Number(r.total_carats||0).toFixed(2),Number(r.total_amount||0).toFixed(2),r.currency,Number(r.inr_amt||0).toFixed(2),Number(r.usd_amt||0).toFixed(2),r.due_date||'',r.payment_status].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'memo_out.csv'; a.click();
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
      if (isEditMode) await api.put(`/memo-out/${id}`, payload);
      else await api.post('/memo-out', payload);
      toast.success(isEditMode ? 'Updated' : 'Created');
      navigate('/parcel-transaction/memo-out', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (rid) => {
    if (!confirm('Delete memo out?')) return;
    await api.delete(`/memo-out/${rid}`);
    await loadRows();
  };

  if (!isFormMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Parcel Transactions / Memo Out</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { navigate('/parcel-transaction/memo-out/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Memo Out</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">General Search</label>
              <input
                type="text"
                placeholder="Search memo outs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Search by Lot No</label>
              <SearchableSelect
                value={lotNumberSearch}
                options={(opts.lot_numbers || []).map(String)}
                onChange={setLotNumberSearch}
                placeholder="Select lot number..."
              />
            </div>
            <div className="pt-5">
              <button
                onClick={() => {
                  setSearch('');
                  setLotNumberSearch('');
                }}
                className="px-3 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit}
            onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages}
            onPageChange={setPage} pageOptions={[100, 500, 1000, 1500]} />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Invoice</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Print Date</th>
                  <th className="text-left px-3 py-2">Party</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Sub Type</th>
                  <th className="text-left px-3 py2">Category</th>
                  <th className="text-right px-3 py-2">Carats</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Currency</th>
                  <th className="text-right px-3 py-2">INR Amt</th>
                  <th className="text-right px-3 py-2">USD Amt</th>
                  <th className="text-left px-3 py-2">DueDate</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Created At</th>
                  <th className="text-left px-3 py-2">Created By</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/parcel-transaction/memo-out/edit/${r.id}`)} className="text-blue-600">Edit</button>
                        <button onClick={() => removeRow(r.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.invoice_number}</td>
                    <td className="px-3 py-2">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2">{fmtDate(r.print_date)}</td>
                    <td className="px-3 py-2">{r.party}</td>
                    <td className="px-3 py-2">{r.purchase_type}</td>
                    <td className="px-3 py-2">{r.sub_type}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.total_carats)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.total_amount)}</td>
                    <td className="px-3 py-2">{r.currency}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.inr_amt)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.usd_amt)}</td>
                    <td className="px-3 py-2">{fmtDate(r.due_date)}</td>
                    <td className="px-3 py-2">{r.payment_status}</td>
                    <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                    <td className="px-3 py-2">{r.created_by_name || ''}</td>
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
        <h1 className="text-2xl font-bold text-gray-800">Memo Out / {isEditMode ? 'Edit' : 'Add'}</h1>
        <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Submit'}</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-6">
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

        {/* Lot section */}
        <div className="border-t pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-700">Lot</h3>
            <div className="flex gap-2">
              <button onClick={() => window.open('/parcel-master/add', '_blank')} className="px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded">Add Parcel Master</button>
              <button
                onClick={() => {
                  setLotFilters({ shape: lotDraft.shape || '', color: lotDraft.color || '', clarity: lotDraft.clarity || '' });
                  setShowLotModal(true);
                }}
                className="px-3 py-1.5 text-sm border border-green-500 text-green-600 rounded"
              >
                Browse Lots
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Item Name</label>
              <select className="w-full px-2 py-2 border rounded" value={lotDraft.lot_number || ''} onChange={(e) => setLotFromMaster(e.target.value)}>
                <option value="">Select Item</option>
                {(opts.lot_items || []).map((lot) => <option key={lot.lot_no} value={lot.lot_no}>{lot.item_name} ({lot.lot_no})</option>)}
              </select>
            </div>
            <F label="Lot Number" name="lot_number" value={lotDraft.lot_number} onChange={setDraftValue} readOnly />
            <F label="Weight" name="weight" value={lotDraft.weight} onChange={setDraftValue} type="number" readOnly />
            <F label="Pcs" name="pcs" value={lotDraft.pcs} onChange={setDraftValue} type="number" />
            <F label="Rate *" name="rate" value={lotDraft.rate} onChange={setDraftValue} type="number" />
            <F label="$Rate" name="usd_rate" value={lotDraft.usd_rate} onChange={setDraftValue} type="number" readOnly />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less1</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less1_sign} onChange={(e) => setLessSign('less1_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                <NumericInput name="less1" value={lotDraft.less1} onChange={(_, val) => setDraftValue('less1', val)} className="w-full px-2 py-2 border rounded text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less2</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less2_sign} onChange={(e) => setLessSign('less2_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                <NumericInput name="less2" value={lotDraft.less2} onChange={(_, val) => setDraftValue('less2', val)} className="w-full px-2 py-2 border rounded text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less3</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less3_sign} onChange={(e) => setLessSign('less3_sign', e.target.value)}><option value="+">+</option><option value="-">-</option></select>
                <NumericInput name="less3" value={lotDraft.less3} onChange={(_, val) => setDraftValue('less3', val)} className="w-full px-2 py-2 border rounded text-right" />
              </div>
            </div>
            <F label="Amount" name="amount" value={lotDraft.amount} onChange={setDraftValue} type="number" readOnly />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={addLot} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Add Item</button>
          </div>
          {form.items.length > 0 && (
            <table className="w-full text-sm mt-4">
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
                    <td className="px-2 py-2">{it.lot_number}</td>
                    <td className="px-2 py-2">{it.item_name}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.weight)}</td>
                    <td className="px-2 py-2 text-right">{Number(it.pcs || 0)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.rate)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.usd_rate)}</td>
                    <td className="px-2 py-2 text-right">{`${it.less1_sign}${fmtAmt(it.less1)}`}</td>
                    <td className="px-2 py-2 text-right">{`${it.less2_sign}${fmtAmt(it.less2)}`}</td>
                    <td className="px-2 py-2 text-right">{`${it.less3_sign}${fmtAmt(it.less3)}`}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.amount)}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingItem(it); setEditingItemIdx(idx); }} className="text-blue-600">Edit</button>
                        <button onClick={() => removeLot(idx)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Amount section */}
        <div className="border-t pt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="font-semibold text-gray-700">Net Amount ({form.currency || 'USD'})</span><span className="text-2xl font-bold text-gray-700">{fmtAmt(form.net_amount)}</span></div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">CGST%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.cgst_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('cgst_pct', e.target.value)} />
              <input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.cgst_amount)} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">SGST%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.sgst_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('sgst_pct', e.target.value)} />
              <input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.sgst_amount)} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">IGST%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.igst_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('igst_pct', e.target.value)} />
              <input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.igst_amount)} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">VAT%</span>
              <input type="number" className="px-3 py-2 text-sm border rounded" value={form.vat_pct || ''} placeholder="0.00" step="0.01" onChange={(e) => setValue('vat_pct', e.target.value)} />
              <input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.vat_amount)} readOnly />
            </div>
          </div>
          <div className="space-y-3 border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>INR FINAL AMOUNT</span><span className="text-3xl">{fmtAmt(form.inr_final_amount)}</span></div>
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>USD FINAL AMOUNT</span><span className="text-3xl">{fmtAmt(form.usd_final_amount)}</span></div>
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>TRANSACTION FINAL AMOUNT</span><span className="text-3xl">{fmtAmt(form.transaction_final_amount)}</span></div>
          </div>
        </div>

        {/* Edit Item Modal */}
        {editingItem !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">Edit Item</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <F label="Lot Number" name="lot_number" value={editingItem.lot_number} readOnly />
                <F label="Item Name" name="item_name" value={editingItem.item_name} readOnly />
                <F label="Weight" name="weight" value={editingItem.weight} type="number" readOnly />
                <F label="Pcs" name="pcs" value={editingItem.pcs} onChange={(_, val) => updateEditingItem('pcs', val)} type="number" />
                <F label="Rate *" name="rate" value={editingItem.rate} onChange={(_, val) => updateEditingItem('rate', val)} type="number" />
                <F label="$Rate" name="usd_rate" value={editingItem.usd_rate} readOnly type="number" />
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less1</label>
                  <div className="flex gap-1">
                    <select className="w-12 px-1 py-2 border rounded" value={editingItem.less1_sign} onChange={(e) => updateEditingLessSign('less1_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                    <NumericInput name="less1" value={editingItem.less1} onChange={(_, val) => updateEditingItem('less1', val)} className="w-full px-2 py-2 border rounded text-right" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less2</label>
                  <div className="flex gap-1">
                    <select className="w-12 px-1 py-2 border rounded" value={editingItem.less2_sign} onChange={(e) => updateEditingLessSign('less2_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                    <NumericInput name="less2" value={editingItem.less2} onChange={(_, val) => updateEditingItem('less2', val)} className="w-full px-2 py-2 border rounded text-right" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less3</label>
                  <div className="flex gap-1">
                    <select className="w-12 px-1 py-2 border rounded" value={editingItem.less3_sign} onChange={(e) => updateEditingLessSign('less3_sign', e.target.value)}><option value="+">+</option><option value="-">-</option></select>
                    <NumericInput name="less3" value={editingItem.less3} onChange={(_, val) => updateEditingItem('less3', val)} className="w-full px-2 py-2 border rounded text-right" />
                  </div>
                </div>
                <F label="Amount" name="amount" value={editingItem.amount} readOnly type="number" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditingItem(null); setEditingItemIdx(null); }} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
                <button onClick={saveEditingItem} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Browse Lots Modal */}
        {showLotModal && <LotBrowseModal onClose={() => setShowLotModal(false)} onSelect={(lotNo) => { setLotFromMaster(lotNo); setShowLotModal(false); setLotFilters({}); }} filters={lotFilters} setFilters={setLotFilters} lotItems={opts.lot_items || []} />}
      </div>
    </div>
  );
}

const LOT_COLS_MEMO = [
  { key: 'lot_no', label: 'Lot No' },
  { key: 'item_name', label: 'Item Name' },
  { key: 'opening_weight_carats', label: 'Weight' },
  { key: 'opening_pcs', label: 'Pcs' },
];

function LotBrowseModal({ lotItems, filters, setFilters, onSelect, onClose }) {
  const [sortDir, setSortDir] = useState('desc');
  const filtered = lotItems.filter((lot) =>
    LOT_COLS_MEMO.every(({ key }) => {
      const f = String(filters[key] || '').trim().toLowerCase();
      return !f || String(lot[key] || '').toLowerCase().includes(f);
    })
  );
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return dir * String(a.lot_no ?? '').localeCompare(String(b.lot_no ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Browse Lots</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {LOT_COLS_MEMO.map(({ key, label }) => (
                  <th key={label} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                    {key === 'lot_no' ? (
                      <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="flex items-center gap-1 hover:text-blue-600 uppercase tracking-wide">
                        {label} <span className="text-xs normal-case font-normal">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      </button>
                    ) : label}
                  </th>
                ))}
                <th className="px-3 py-2" />
              </tr>
              <tr className="bg-white border-b">
                {LOT_COLS_MEMO.map(({ key }) => (
                  <td key={key} className="px-2 py-1">
                    <input
                      type="text"
                      placeholder="filter"
                      value={filters[key] || ''}
                      onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button
                    onClick={() => LOT_COLS_MEMO.forEach(({ key }) => setFilters((p) => ({ ...p, [key]: '' })))}
                    className="text-xs text-gray-400 hover:text-red-500 whitespace-nowrap"
                  >Clear</button>
                </td>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={LOT_COLS_MEMO.length + 1} className="text-center py-8 text-gray-400">No lots found</td></tr>
              )}
              {sorted.map((lot) => (
                <tr key={lot.lot_no} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-3 py-2">{lot.lot_no}</td>
                  <td className="px-3 py-2">{lot.item_name}</td>
                  <td className="px-3 py-2 text-right">{lot.opening_weight_carats}</td>
                  <td className="px-3 py-2 text-right">{lot.opening_pcs}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onSelect(lot.lot_no)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >Select</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t text-xs text-gray-400">{filtered.length} lot{filtered.length !== 1 ? 's' : ''} shown</div>
      </div>
    </div>
  );
}
