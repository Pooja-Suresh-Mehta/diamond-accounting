import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, FileUp, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api';
import ListPageControls from '../components/ListPageControls';
import PartyField, { BrokerField } from '../components/PartyField';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { INIT_LINE_ITEM, applyLotAutoFields, calculateTotals, getCurrencyDefaults, normalizeLineItem } from '../utils/parcelTransactionCalc';
import NumericInput from '../components/NumericInput';
import { fmtAmt } from '../utils/format';
import F from '../components/FormField';

const INIT_ITEM = INIT_LINE_ITEM;

const INIT = {
  date: getCurrentDateISO(),
  invoice_number: '',
  bill_no: '',
  purchase_type: 'LOCAL',
  sub_type: '',
  category: 'Natural Diamond',
  party: '',
  due_days: 0,
  due_date: getCurrentDateISO(),
  currency: 'USD',
  inr_rate: 85,
  usd_rate: 1,
  comm_agent: '',
  com_pct: 0,
  com_amount: 0,
  save_grading: false,
  purchase_last_year: false,
  broker: '',
  bro_pct: 0,
  bro_amount: 0,
  description: '',
  consignment_no: '',
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
  'due_days', 'inr_rate', 'usd_rate', 'com_pct', 'com_amount', 'bro_pct', 'bro_amount',
  'plus_minus_amount', 'net_amount', 'm_currency_net_amount', 'cgst_pct', 'cgst_amount',
  'sgst_pct', 'sgst_amount', 'igst_pct', 'igst_amount', 'vat_pct', 'vat_amount',
  'inr_final_amount', 'usd_final_amount', 'transaction_final_amount',
]);
const itemNumericFields = new Set(['issue_carats', 'reje_pct', 'rejection', 'selected_carat', 'pcs', 'rate', 'usd_rate', 'less1', 'less2', 'less3', 'amount']);

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

export default function PurchasePage() {
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
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(INIT);
  const [lotDraft, setLotDraft] = useState({ ...INIT_ITEM });
  const [opts, setOpts] = useState({ types: ['LOCAL', 'External', 'Internal', 'Pend Sale', 'HOLD', 'LAB'], sub_types: ['Bank', 'Cash'], categories: [], currencies: ['USD', 'INR', 'AED'], currency_rates: {}, parties: [], brokers: [], payment_statuses: [], lot_numbers: [], lot_items: [], next_invoice_number: '1' });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState([]);

  const loadRows = async () => {
    const res = await api.get('/parcel/purchase', { params: { search } });
    setRows(Array.isArray(res.data) ? res.data : []);
    setPage(1);
  };
  const loadOpts = async () => {
    const res = await api.get('/parcel/purchase/options');
    setOpts(res.data);
  };
  const loadEdit = async () => {
    if (!id) return;
    const res = await api.get(`/parcel/purchase/${id}`);
    const base = { ...INIT, ...res.data, date: res.data.date || getCurrentDateISO(), due_date: res.data.due_date || getCurrentDateISO() };
    setForm({
      ...base,
      items: (base.items || []).map((item) => normalizeLineItem(item, {
        currency: base.currency,
        inrRate: base.inr_rate,
        aedRate: base.usd_rate,
      })),
    });
  };

  useEffect(() => {
    loadOpts().catch(() => toast.error('Failed to load options'));
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadOpts().catch(() => {}); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  useEffect(() => { if (!isFormMode) loadRows().catch(() => toast.error('Failed to load purchases')); }, [search, isFormMode]);
  useEffect(() => {
    if (isEditMode) loadEdit().catch(() => toast.error('Failed to load purchase'));
    if (isAddMode) {
      setForm({ ...INIT, invoice_number: String(opts.next_invoice_number || '1') });
      setLotDraft({ ...INIT_ITEM });
      setImportedRows([]);
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
      if (name === 'currency' || name === 'inr_rate' || name === 'usd_rate') {
        next.items = next.items.map((item) => normalizeLineItem(item, {
          currency: next.currency,
          inrRate: next.inr_rate,
          aedRate: next.usd_rate,
        }));
        setLotDraft((draft) => normalizeLineItem(draft, {
          currency: next.currency,
          inrRate: next.inr_rate,
          aedRate: next.usd_rate,
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
  const setItemValue = (name, value) => {
    setForm((p) => {
      setLotDraft((draft) => {
        const raw = { ...draft, [name]: itemNumericFields.has(name) ? (value === '' ? '' : Number(value)) : value };
        return normalizeLineItem(raw, {
          currency: p.currency,
          inrRate: p.inr_rate,
          aedRate: p.usd_rate,
          sourceField: name,
        });
      });
      return p;
    });
  };
  const setLessSign = (field, sign) => {
    setForm((p) => {
      setLotDraft((draft) => normalizeLineItem(
        { ...draft, [field]: sign },
        { currency: p.currency, inrRate: p.inr_rate, aedRate: p.usd_rate },
      ));
      return p;
    });
  };
  const setLotFromMaster = (lotNo) => {
    if (!lotNo) {
      return setForm((p) => {
        setLotDraft(normalizeLineItem({ ...INIT_ITEM }, {
          currency: p.currency,
          inrRate: p.inr_rate,
          aedRate: p.usd_rate,
        }));
        return p;
      });
    }
    const found = (opts.lot_items || []).find((l) => l.lot_no === lotNo);
    setForm((p) => {
      const line = found ? applyLotAutoFields(lotDraft, found) : { ...lotDraft, lot_number: lotNo };
      setLotDraft(normalizeLineItem(line, {
        currency: p.currency,
        inrRate: p.inr_rate,
        aedRate: p.usd_rate,
      }));
      return p;
    });
  };
  const addSubmittedLot = () => {
    if (!String(lotDraft.lot_number || '').trim()) return toast.error('Lot selection is required');
    if (Number(lotDraft.issue_carats || 0) <= 0 || Number(lotDraft.rate || 0) <= 0) return toast.error('Issue Carats and Rate are required');
    setForm((p) => ({ ...p, items: [...p.items, normalizeLineItem(lotDraft, { currency: p.currency, inrRate: p.inr_rate, aedRate: p.usd_rate })] }));
    setLotDraft({ ...INIT_ITEM });
  };
  const removeSubmittedLot = (idx) => {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  useEffect(() => {
    setForm((p) => {
      return { ...p, ...calculateTotals(p) };
    });
  }, [form.items, form.currency, form.cgst_pct, form.sgst_pct, form.igst_pct, form.vat_pct, form.inr_rate, form.usd_rate]);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const save = async () => {
    if (!form.invoice_number.trim()) return toast.error('Invoice Number is required');
    const activeItems = form.items.filter((i) => String(i.lot_number || '').trim());
    if (!activeItems.length) return toast.error('Lot selection is required');
    const invalidRow = activeItems.find((i) => Number(i.issue_carats || 0) <= 0 || Number(i.rate || 0) <= 0);
    if (invalidRow) return toast.error('Issue Carats and Rate are required for selected lots');
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: activeItems.map((i) => {
          const { less1_sign, less2_sign, less3_sign, ...rest } = i;
          return { ...rest, less1: Number(rest.less1 || 0), less2: Number(rest.less2 || 0), less3: Number(rest.less3 || 0) };
        }),
      };
      if (isEditMode) await api.put(`/parcel/purchase/${id}`, payload);
      else await api.post('/parcel/purchase', payload);
      toast.success(isEditMode ? 'Updated' : 'Created');
      navigate('/parcel/purchase', { replace: true });
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (rid) => {
    if (!confirm('Delete purchase?')) return;
    await api.delete(`/parcel/purchase/${rid}`);
    await loadRows();
  };

  const exportExcel = async () => {
    const res = await api.get('/parcel/purchase/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchase.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleTemplate = () => {
    const a = document.createElement('a');
    a.href = '/PurchaseParcel.xlsx';
    a.download = 'PurchaseParcel.xlsx';
    a.click();
  };

  const importExcel = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/parcel/purchase/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const rowsFromImport = Array.isArray(res.data?.rows) ? res.data.rows : [];
      setImportedRows(rowsFromImport);
      if (rowsFromImport.length) {
        setForm((p) => ({
          ...p,
          invoice_number: p.invoice_number || rowsFromImport[0]?.invoice_number || '',
          items: rowsFromImport.map((r) => normalizeLineItem({
            ...INIT_ITEM,
            lot_number: r.lot_number || '',
            item_name: r.item_name || r.lot_number || '',
            shape: r.shape || '',
            color: r.color || '',
            clarity: r.clarity || '',
            size: r.size || '',
            sieve: r.sieve || '',
            issue_carats: Number(r.issue_carats || 0),
            rejection: Number(r.rejection || 0),
            reje_pct: Number(r.reje_pct || 0),
            selected_carat: Number(r.selected_carat || r.issue_carats || 0),
            pcs: Number(r.pcs || 0),
            rate: Number(r.rate || 0),
            less1_sign: '-',
            less2_sign: '-',
            less3_sign: '+',
            less1: 0,
            less2: 0,
            less3: 0,
            amount: Number(r.amount || 0),
          }, {
            currency: p.currency,
            inrRate: p.inr_rate,
            aedRate: p.usd_rate,
          })),
        }));
        setLotDraft({ ...INIT_ITEM });
      }
      toast.success(`Imported ${res.data.imported} rows`);
    } catch (e) {
      toast.error(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isFormMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Parcel Transactions / Purchase</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => navigate('/parcel/purchase/add')} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Purchase</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls
            search={search}
            onSearchChange={setSearch}
            rowLimit={rowLimit}
            onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageOptions={[100, 500, 1000, 1500]}
          />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Action</th><th className="text-left px-3 py-2">Invoice</th><th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Sub Type</th><th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Party</th><th className="text-right px-3 py-2">Carats</th><th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Currency</th><th className="text-right px-3 py-2">INR Amt</th><th className="text-right px-3 py-2">USD Amt</th>
                  <th className="text-left px-3 py-2">DueDate</th><th className="text-left px-3 py-2">Payment Status</th><th className="text-left px-3 py-2">Created At</th><th className="text-left px-3 py-2">Created By</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/parcel/purchase/edit/${r.id}`)} className="text-blue-600">Edit</button>
                        <button onClick={() => removeRow(r.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.invoice_number}</td><td className="px-3 py-2">{r.date}</td><td className="px-3 py-2">{r.purchase_type}</td>
                    <td className="px-3 py-2">{r.sub_type}</td><td className="px-3 py-2">{r.category}</td><td className="px-3 py-2">{r.party}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.total_carats)}</td><td className="px-3 py-2 text-right">{fmtAmt(r.total_amount)}</td>
                    <td className="px-3 py-2">{r.currency}</td><td className="px-3 py-2 text-right">{fmtAmt(r.inr_amt)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.usd_amt)}</td><td className="px-3 py-2">{r.due_date || ''}</td><td className="px-3 py-2">{r.payment_status}</td><td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td><td className="px-3 py-2">{r.created_by_name || ''}</td>
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
        <h1 className="text-2xl font-bold text-gray-800">Purchases / Add PurchaseParcel</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="px-3 py-2 text-sm border border-blue-500 text-blue-600 rounded-lg cursor-pointer flex items-center gap-1.5">
            <FileUp className="w-4 h-4" /> {uploading ? 'Importing...' : 'Import Excel'}
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Submit'}</button>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Import Purchase Excel</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadSampleTemplate} className="px-3 py-2 text-sm border border-blue-500 text-blue-600 rounded-lg">Download Sample Template</button>
            </div>
            <label className="block text-sm text-gray-600">Upload File (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={async (e) => {
                await importExcel(e.target.files?.[0]);
                setShowImportModal(false);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
            <div className="flex justify-end">
              <button onClick={() => setShowImportModal(false)} className="px-3 py-2 text-sm bg-gray-200 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <F label="Date" name="date" type="date" value={form.date} onChange={setValue} />
          <F label="Invoice Number" name="invoice_number" value={form.invoice_number} onChange={setValue} readOnly />
          <F label="Bill No" name="bill_no" value={form.bill_no} onChange={setValue} />
          <F label="Type" name="purchase_type" value={form.purchase_type} onChange={setValue} options={opts.types} />
          <F label="Sub Type" name="sub_type" value={form.sub_type} onChange={setValue} options={opts.sub_types} />
          <F label="Category" name="category" value={form.category} onChange={setValue} options={opts.categories} />
          <PartyField value={form.party} onChange={setValue} options={opts.parties} />
          <F label="Due Days" name="due_days" value={form.due_days} onChange={setValue} type="number" />
          <F label="Due Date" name="due_date" value={form.due_date} onChange={setValue} type="date" />
          <F label="Currency" name="currency" value={form.currency} onChange={setValue} options={opts.currencies} />
          <F label="INR *" name="inr_rate" value={form.inr_rate} onChange={setValue} type="number" />
          <F label="USD /" name="usd_rate" value={form.usd_rate} onChange={setValue} type="number" />
          <PartyField name="comm_agent" label="Comm.Agent" value={form.comm_agent} onChange={setValue} options={opts.parties} />
          <F label="Com %" name="com_pct" value={form.com_pct} onChange={setValue} type="number" />
          <F label="Com Amount" name="com_amount" value={form.com_amount} onChange={setValue} type="number" />
          <BrokerField name="broker" value={form.broker} onChange={setValue} options={opts.brokers} />
          <F label="Bro %" name="bro_pct" value={form.bro_pct} onChange={setValue} type="number" />
          <F label="Bro Amount" name="bro_amount" value={form.bro_amount} onChange={setValue} type="number" />
          <F label="Description" name="description" value={form.description} onChange={setValue} />
          <F label="Consignment No" name="consignment_no" value={form.consignment_no} onChange={setValue} />
        </div>

        <div className="border-t pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-700">Lot Number</h3>
            <button onClick={() => window.open('/parcel-master/add', '_blank')} className="px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded">Add Parcel Master</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Item Name</label>
              <select className="w-full px-2 py-2 border rounded" value={lotDraft.lot_number || ''} onChange={(e) => setLotFromMaster(e.target.value)}>
                <option value="">Select Item</option>
                {(opts.lot_items || []).map((lot) => <option key={lot.lot_no} value={lot.lot_no}>{lot.item_name} ({lot.lot_no})</option>)}
              </select>
            </div>
            <F label="Lot Number" name="lot_number" value={lotDraft.lot_number} onChange={setItemValue} readOnly />
            <F label="Shape" name="shape" value={lotDraft.shape} onChange={setItemValue} readOnly />
            <F label="Color" name="color" value={lotDraft.color} onChange={setItemValue} readOnly />
            <F label="Clarity" name="clarity" value={lotDraft.clarity} onChange={setItemValue} readOnly />
            <F label="Size" name="size" value={lotDraft.size} onChange={setItemValue} readOnly />
            <F label="Sieve" name="sieve" value={lotDraft.sieve} onChange={setItemValue} readOnly />
            <F label="Issue Carats *" name="issue_carats" value={lotDraft.issue_carats} onChange={setItemValue} type="number" />
            <F label="Reje%" name="reje_pct" value={lotDraft.reje_pct} onChange={setItemValue} type="number" />
            <F label="Rejection" name="rejection" value={lotDraft.rejection} onChange={setItemValue} type="number" />
            <F label="Selected Carat" name="selected_carat" value={lotDraft.selected_carat} onChange={setItemValue} type="number" />
            <F label="Pcs" name="pcs" value={lotDraft.pcs} onChange={setItemValue} type="number" />
            <F label="Rate *" name="rate" value={lotDraft.rate} onChange={setItemValue} type="number" />
            <F label="$Rate" name="usd_rate" value={lotDraft.usd_rate} onChange={setItemValue} type="number" readOnly />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less1</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less1_sign || '-'} onChange={(e) => setLessSign('less1_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                <NumericInput name="less1" value={lotDraft.less1} onChange={(_, val) => setItemValue('less1', val)} className="w-full px-2 py-2 border rounded text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less2</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less2_sign || '-'} onChange={(e) => setLessSign('less2_sign', e.target.value)}><option value="-">-</option><option value="+">+</option></select>
                <NumericInput name="less2" value={lotDraft.less2} onChange={(_, val) => setItemValue('less2', val)} className="w-full px-2 py-2 border rounded text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Less3</label>
              <div className="flex gap-1">
                <select className="w-12 px-1 py-2 border rounded" value={lotDraft.less3_sign || '+'} onChange={(e) => setLessSign('less3_sign', e.target.value)}><option value="+">+</option><option value="-">-</option></select>
                <NumericInput name="less3" value={lotDraft.less3} onChange={(_, val) => setItemValue('less3', val)} className="w-full px-2 py-2 border rounded text-right" />
              </div>
            </div>
            <F label="Amount" name="amount" value={lotDraft.amount} onChange={setItemValue} type="number" readOnly />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={addSubmittedLot} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Add Item</button>
          </div>
          {form.items.length > 0 && (
            <table className="w-full text-sm mt-4">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['LotNo', 'Item', 'Issue', 'Reje%', 'Rejection', 'Carats', 'Pcs', 'Rate', '$Rate', 'Less1', 'Less2', 'Less3', 'Amount', 'Action'].map((h) => (
                    <th key={h} className="text-left px-2 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={`${it.lot_number}-${idx}`} className="border-t border-gray-100">
                    <td className="px-2 py-2">{it.lot_number}</td>
                    <td className="px-2 py-2">{it.item_name}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.issue_carats)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.reje_pct)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.rejection)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.selected_carat)}</td>
                    <td className="px-2 py-2 text-right">{Number(it.pcs || 0)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.rate)}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.usd_rate)}</td>
                    <td className="px-2 py-2 text-right">{`${it.less1_sign || '-'}${fmtAmt(it.less1)}`}</td>
                    <td className="px-2 py-2 text-right">{`${it.less2_sign || '-'}${fmtAmt(it.less2)}`}</td>
                    <td className="px-2 py-2 text-right">{`${it.less3_sign || '+'}${fmtAmt(it.less3)}`}</td>
                    <td className="px-2 py-2 text-right">{fmtAmt(it.amount)}</td>
                    <td className="px-2 py-2"><button onClick={() => removeSubmittedLot(idx)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t pt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="font-semibold text-gray-700">Net Amount ({form.currency || 'USD'})</span><span className="text-2xl font-bold text-gray-700">{fmtAmt(form.net_amount)}</span></div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">CGST%</span><input type="number" className="px-3 py-2 text-sm border rounded" value={form.cgst_pct} onChange={(e) => setValue('cgst_pct', e.target.value)} /><input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.cgst_amount)} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">SGST%</span><input type="number" className="px-3 py-2 text-sm border rounded" value={form.sgst_pct} onChange={(e) => setValue('sgst_pct', e.target.value)} /><input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.sgst_amount)} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">IGST%</span><input type="number" className="px-3 py-2 text-sm border rounded" value={form.igst_pct} onChange={(e) => setValue('igst_pct', e.target.value)} /><input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.igst_amount)} readOnly />
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="font-semibold text-gray-700">VAT%</span><input type="number" className="px-3 py-2 text-sm border rounded" value={form.vat_pct} onChange={(e) => setValue('vat_pct', e.target.value)} /><input type="text" className="px-3 py-2 text-sm border rounded bg-gray-100 text-right" value={fmtAmt(form.vat_amount)} readOnly />
            </div>
          </div>
          <div className="space-y-3 border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>INR FINAL AMOUNT</span><span className="text-3xl">{fmtAmt(form.inr_final_amount)}</span></div>
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>USD FINAL AMOUNT</span><span className="text-3xl">{fmtAmt(form.usd_final_amount)}</span></div>
            <div className="flex items-center justify-between text-blue-600 font-semibold"><span>TRANSACTION FINAL AMOUNT</span><span className="text-3xl">{fmtAmt(form.transaction_final_amount)}</span></div>
          </div>
        </div>

        {importedRows.length > 0 && (
          <div className="border-t pt-5">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Imported Records</h3>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-2 py-2">Invoice</th>
                    <th className="text-left px-2 py-2">Lot Number</th>
                    <th className="text-left px-2 py-2">Shape</th>
                    <th className="text-left px-2 py-2">Color</th>
                    <th className="text-left px-2 py-2">Clarity</th>
                    <th className="text-left px-2 py-2">Size</th>
                    <th className="text-right px-2 py-2">Carats</th>
                    <th className="text-right px-2 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {importedRows.map((r, idx) => (
                    <tr key={`${r.invoice_number}-${r.lot_number}-${idx}`} className="border-t border-gray-100">
                      <td className="px-2 py-1">{r.invoice_number || ''}</td>
                      <td className="px-2 py-1">{r.lot_number || ''}</td>
                      <td className="px-2 py-1">{r.shape || ''}</td>
                      <td className="px-2 py-1">{r.color || ''}</td>
                      <td className="px-2 py-1">{r.clarity || ''}</td>
                      <td className="px-2 py-1">{r.size || ''}</td>
                      <td className="px-2 py-1 text-right">{fmtAmt(r.selected_carat || r.issue_carats)}</td>
                      <td className="px-2 py-1 text-right">{fmtAmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
