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

function F({ label, name, value, onChange, options = [], type = 'text', searchable = false, readOnly = false, onAddNew }) {
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
  if (currency === 'INR') return aedRate > 0 ? Number((r / aedRate).toFixed(2)) : 0;
  if (currency === 'AED') return aedRate > 0 ? Number((r / aedRate).toFixed(2)) : 0;
  return r;
}

export default function MemoOutPage() {
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
  const [lotDraft, setLotDraft] = useState({ ...INIT_ITEM });
  const [opts, setOpts] = useState({
    types: [], sub_types: [], categories: [], currencies: ['USD', 'INR', 'AED'],
    currency_rates: {}, parties: [], lot_numbers: [], lot_items: [], payment_statuses: [],
    next_invoice_number: '1',
  });

  const loadRows = async () => {
    const res = await api.get('/memo-out', { params: { search } });
    setRows(Array.isArray(res.data) ? res.data : []);
    setPage(1);
  };
  const loadOpts = async () => {
    const res = await api.get('/memo-out/options');
    setOpts(res.data);
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

  useEffect(() => { loadOpts().catch(() => toast.error('Failed to load options')); }, []);
  useEffect(() => { if (!isFormMode) loadRows().catch(() => toast.error('Failed to load memo outs')); }, [search, isFormMode]);
  useEffect(() => {
    if (isEditMode) loadEdit().catch(() => toast.error('Failed to load memo out'));
    if (isAddMode) {
      setForm({ ...INIT, invoice_number: String(opts.next_invoice_number || '1') });
      setLotDraft({ ...INIT_ITEM });
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
    const found = (opts.lot_items || []).find((l) => l.lot_no === lotNo);
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
    const found = (opts.lot_items || []).find((l) => l.lot_no === lotDraft.lot_number);
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
        items: form.items.map(({ less1_sign, less2_sign, less3_sign, ...rest }) => rest),
      };
      if (isEditMode) await api.put(`/memo-out/${id}`, payload);
      else await api.post('/memo-out', payload);
      toast.success(isEditMode ? 'Updated' : 'Created');
      navigate('/parcel/memo-out', { replace: true });
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
            <button onClick={() => { navigate('/parcel/memo-out/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Memo Out</button>
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
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Invoice</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Print Date</th>
                  <th className="text-left px-3 py-2">Party</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Sub Type</th>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-right px-3 py-2">Carats</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Currency</th>
                  <th className="text-right px-3 py-2">INR Amt</th>
                  <th className="text-right px-3 py-2">USD Amt</th>
                  <th className="text-left px-3 py-2">DueDate</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/parcel/memo-out/edit/${r.id}`)} className="text-blue-600">Edit</button>
                        <button onClick={() => removeRow(r.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.invoice_number}</td>
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
            <button onClick={() => navigate('/parcel-master/add')} className="px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded">Add Parcel Master</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Lot Number</label>
              <select className="w-full px-2 py-2 border rounded" value={lotDraft.lot_number || ''} onChange={(e) => setLotFromMaster(e.target.value)}>
                <option value="">Lot Number</option>
                {(opts.lot_numbers || []).map((lot) => <option key={lot} value={lot}>{lot}</option>)}
              </select>
            </div>
            <F label="Item Name" name="item_name" value={lotDraft.item_name} onChange={setDraftValue} readOnly />
            <F label="Weight" name="weight" value={lotDraft.weight} onChange={setDraftValue} type="number" readOnly />
            <F label="Pcs" name="pcs" value={lotDraft.pcs} onChange={setDraftValue} type="number" />
            <F label="Rate *" name="rate" value={lotDraft.rate} onChange={setDraftValue} type="number" />
            <F label="$Rate" name="usd_rate" value={lotDraft.usd_rate} onChange={setDraftValue} type="number" readOnly />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less1</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less1_sign} onChange={(e) => setLessSign('less1_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                <input type="number" className="w-full px-2 py-2 border rounded text-right" value={lotDraft.less1 || ''} placeholder="0.00" step="0.01" onChange={(e) => setDraftValue('less1', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less2</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less2_sign} onChange={(e) => setLessSign('less2_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                <input type="number" className="w-full px-2 py-2 border rounded text-right" value={lotDraft.less2 || ''} placeholder="0.00" step="0.01" onChange={(e) => setDraftValue('less2', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less3</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less3_sign} onChange={(e) => setLessSign('less3_sign', e.target.value)}><option value="+">+</option><option value="-">-</option></select>
                <input type="number" className="w-full px-2 py-2 border rounded text-right" value={lotDraft.less3 || ''} placeholder="0.00" step="0.01" onChange={(e) => setDraftValue('less3', e.target.value)} />
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
                    <td className="px-2 py-2 text-right">{Number(it.weight || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{Number(it.pcs || 0)}</td>
                    <td className="px-2 py-2 text-right">{Number(it.rate || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{Number(it.usd_rate || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{`${it.less1_sign}${Number(it.less1 || 0).toFixed(2)}`}</td>
                    <td className="px-2 py-2 text-right">{`${it.less2_sign}${Number(it.less2 || 0).toFixed(2)}`}</td>
                    <td className="px-2 py-2 text-right">{`${it.less3_sign}${Number(it.less3 || 0).toFixed(2)}`}</td>
                    <td className="px-2 py-2 text-right">{Number(it.amount || 0).toFixed(2)}</td>
                    <td className="px-2 py-2"><button onClick={() => removeLot(idx)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
