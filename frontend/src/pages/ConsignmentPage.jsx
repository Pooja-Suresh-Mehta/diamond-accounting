import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api';
import F from '../components/FormField';
import ListPageControls from '../components/ListPageControls';
import PartyField from '../components/PartyField';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { INIT_LINE_ITEM, applyLotAutoFields, calculateTotals, getCurrencyDefaults, normalizeLineItem } from '../utils/parcelTransactionCalc';

const INIT_ITEM = { ...INIT_LINE_ITEM };

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
  broker: '',
  bro_pct: 0,
  bro_amount: 0,
  description: '',
  plus_minus_amount: 0,
  net_amount: 0,
  m_currency_net_amount: 0,
  cgst_pct: 0, cgst_amount: 0,
  sgst_pct: 0, sgst_amount: 0,
  igst_pct: 0, igst_amount: 0,
  vat_pct: 0, vat_amount: 0,
  inr_final_amount: 0,
  usd_final_amount: 0,
  transaction_final_amount: 0,
  payment_status: 'Pending',
  items: [],
};

const numericFields = new Set([
  'due_days', 'inr_rate', 'usd_rate', 'bro_pct', 'bro_amount',
  'plus_minus_amount', 'net_amount', 'm_currency_net_amount',
  'cgst_pct', 'cgst_amount', 'sgst_pct', 'sgst_amount', 'igst_pct', 'igst_amount',
  'vat_pct', 'vat_amount', 'inr_final_amount', 'usd_final_amount', 'transaction_final_amount',
]);
const itemNumericFields = new Set(['issue_carats', 'reje_pct', 'rejection', 'selected_carat', 'pcs', 'rate', 'usd_rate', 'less1', 'less2', 'less3', 'amount']);

export default function ConsignmentPage() {
  const { id } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const isAdd = loc.pathname.endsWith('/add');
  const isEdit = Boolean(id);
  const isForm = isAdd || isEdit;
  const [view, setView] = useState(isForm ? 'form' : 'list');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opts, setOpts] = useState({ types: [], currencies: [], currency_rates: {}, parties: [], lot_items: [], payment_statuses: [] });
  const [form, setForm] = useState({ ...INIT });

  const PAGE_SIZE = 50;

  useEffect(() => {
    api.get('/consignment/options').then(r => setOpts(r.data)).catch(() => {});
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/consignment', { params: { search, page, page_size: PAGE_SIZE } });
      setRows(r.data);
      setTotal(r.data.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (view === 'list') fetchList(); }, [view, page, search]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/consignment/${id}`).then(r => {
        const d = r.data;
        setForm({
          ...d,
          items: (d.items || []).map(i => ({ ...i, less1_sign: '-', less2_sign: '-', less3_sign: '+' })),
        });
        setView('form');
      }).catch(() => toast.error('Failed to load consignment'));
    }
  }, [id]);

  const handleField = (name, value) => {
    setForm(f => {
      const next = { ...f, [name]: numericFields.has(name) ? (value === '' ? 0 : Number(value)) : value };
      if (name === 'currency') {
        const def = getCurrencyDefaults(value);
        next.inr_rate = def.inr_rate;
        next.usd_rate = def.usd_rate;
      }
      if (['cgst_pct', 'sgst_pct', 'igst_pct', 'vat_pct'].includes(name)) {
        return { ...next, ...calculateTotals({ ...next, items: f.items }) };
      }
      return next;
    });
  };

  const handleItem = (idx, name, value) => {
    setForm(f => {
      const items = f.items.map((item, i) => {
        if (i !== idx) return item;
        const raw = { ...item, [name]: itemNumericFields.has(name) ? (value === '' ? 0 : Number(value)) : value };
        if (name === 'lot_number') {
          const lot = (opts.lot_items || []).find(l => l.lot_no === value);
          return lot ? applyLotAutoFields(raw, lot) : raw;
        }
        return normalizeLineItem(raw, { currency: f.currency, inrRate: f.inr_rate, aedRate: f.usd_rate, sourceField: name });
      });
      return { ...f, items, ...calculateTotals({ ...f, items }) };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...INIT_ITEM }] }));
  const removeItem = idx => setForm(f => {
    const items = f.items.filter((_, i) => i !== idx);
    return { ...f, items, ...calculateTotals({ ...f, items }) };
  });

  const handleSave = async () => {
    if (!form.invoice_number) return toast.error('Invoice Number required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.map(({ less1_sign, less2_sign, less3_sign, ...i }) => i),
      };
      if (isEdit) {
        await api.put(`/consignment/${id}`, payload);
        toast.success('Consignment updated');
      } else {
        await api.post('/consignment', payload);
        toast.success('Consignment saved');
      }
      navigate('/parcel/consignment-in');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rowId) => {
    if (!confirm('Delete this consignment?')) return;
    try {
      await api.delete(`/consignment/${rowId}`);
      toast.success('Deleted');
      fetchList();
    } catch {
      toast.error('Delete failed');
    }
  };

  const rowLimit = PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / rowLimit));

  const exportExcel = () => {
    const headers = ['Invoice #', 'Date', 'Party', 'Currency', 'Amount', 'Status'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => { csvRows.push([r.invoice_number, r.date, `"${r.party || ''}"`, r.currency, (r.usd_amt || 0).toFixed(2), r.payment_status].join(',')); });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'consignment_in.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Parcel Transactions / Consignment In</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { setForm({ ...INIT, invoice_number: opts.next_invoice_number || '' }); setView('form'); navigate('/parcel/consignment-in/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Consignment</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit} onRowLimitChange={() => {}} page={page} totalPages={totalPages} onPageChange={setPage} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Invoice #', 'Date', 'Party', 'Currency', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No consignments found</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.invoice_number}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.party}</td>
                    <td className="px-4 py-3">{r.currency}</td>
                    <td className="px-4 py-3">{(r.usd_amt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">{r.payment_status}</span></td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => navigate(`/parcel/consignment-in/edit/${r.id}`)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const lots = (opts.lot_items || []).map(l => l.lot_no);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => { navigate('/parcel/consignment-in'); setView('list'); }} className="text-sm text-blue-600 hover:underline">← Back to list</button>
        <h2 className="text-lg font-semibold">{isEdit ? 'Edit' : 'New'} Consignment In</h2>
        <button onClick={handleSave} disabled={saving} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <F label="Invoice #" name="invoice_number" value={form.invoice_number} onChange={handleField} />
        <F label="Date" name="date" value={form.date} onChange={handleField} type="date" />
        <F label="Print Date" name="print_date" value={form.print_date} onChange={handleField} type="date" />
        <F label="Type" name="purchase_type" value={form.purchase_type} onChange={handleField} options={opts.types || []} />
        <F label="Category" name="category" value={form.category} onChange={handleField} options={opts.categories || []} />
        <PartyField value={form.party} onChange={handleField} options={opts.parties || []} />
        <F label="Due Days" name="due_days" value={form.due_days} onChange={handleField} type="number" />
        <F label="Due Date" name="due_date" value={form.due_date} onChange={handleField} type="date" />
        <F label="Currency" name="currency" value={form.currency} onChange={handleField} options={opts.currencies || []} />
        <F label="INR Rate" name="inr_rate" value={form.inr_rate} onChange={handleField} type="number" />
        <F label="USD Rate" name="usd_rate" value={form.usd_rate} onChange={handleField} type="number" />
        <F label="Broker" name="broker" value={form.broker} onChange={handleField} options={opts.parties || []} searchable />
        <F label="Bro %" name="bro_pct" value={form.bro_pct} onChange={handleField} type="number" />
        <F label="Bro Amount" name="bro_amount" value={form.bro_amount} onChange={handleField} type="number" />
        <F label="Payment Status" name="payment_status" value={form.payment_status} onChange={handleField} options={opts.payment_statuses || []} />
        <F label="Description" name="description" value={form.description} onChange={handleField} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Items</h3>
          <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs">
            <Plus className="w-3 h-3" />Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>{['Lot #', 'Item', 'Shape', 'Color', 'Clarity', 'Size', 'Issue Cts', 'Reje%', 'Rejection', 'Sel.Cts', 'Pcs', 'Rate', 'Amount', ''].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx} className="border-t">
                  {[
                    { name: 'lot_number', opts: lots, w: '120px' },
                    { name: 'item_name', w: '120px' },
                    { name: 'shape', w: '80px' },
                    { name: 'color', w: '60px' },
                    { name: 'clarity', w: '60px' },
                    { name: 'size', w: '80px' },
                    { name: 'issue_carats', type: 'number', w: '80px' },
                    { name: 'reje_pct', type: 'number', w: '60px' },
                    { name: 'rejection', type: 'number', w: '80px' },
                    { name: 'selected_carat', type: 'number', w: '80px' },
                    { name: 'pcs', type: 'number', w: '60px' },
                    { name: 'rate', type: 'number', w: '80px' },
                    { name: 'amount', type: 'number', w: '100px', readOnly: true },
                  ].map(({ name, opts: o, type = 'text', w, readOnly }) => (
                    <td key={name} className="px-1 py-1" style={{ minWidth: w }}>
                      {o ? (
                        <select value={item[name] || ''} onChange={e => handleItem(idx, name, e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded px-1 py-1">
                          <option value="">--</option>
                          {o.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input type={type} value={type === 'number' && Number(item[name] || 0) === 0 ? '' : (item[name] ?? '')}
                          readOnly={readOnly}
                          onChange={e => handleItem(idx, name, e.target.value)}
                          className={`w-full text-xs border border-gray-200 rounded px-1 py-1 ${readOnly ? 'bg-gray-50' : ''}`} />
                      )}
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {form.items.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No items — click "Add Item"</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <F label="Net Amount" name="net_amount" value={form.net_amount} onChange={handleField} type="number" readOnly />
        <div className="grid grid-cols-2 gap-2">
          <F label="CGST %" name="cgst_pct" value={form.cgst_pct} onChange={handleField} type="number" />
          <F label="CGST Amt" name="cgst_amount" value={form.cgst_amount} onChange={handleField} type="number" readOnly />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <F label="SGST %" name="sgst_pct" value={form.sgst_pct} onChange={handleField} type="number" />
          <F label="SGST Amt" name="sgst_amount" value={form.sgst_amount} onChange={handleField} type="number" readOnly />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <F label="IGST %" name="igst_pct" value={form.igst_pct} onChange={handleField} type="number" />
          <F label="IGST Amt" name="igst_amount" value={form.igst_amount} onChange={handleField} type="number" readOnly />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <F label="VAT %" name="vat_pct" value={form.vat_pct} onChange={handleField} type="number" />
          <F label="VAT Amt" name="vat_amount" value={form.vat_amount} onChange={handleField} type="number" readOnly />
        </div>
        <F label="INR Final" name="inr_final_amount" value={form.inr_final_amount} onChange={handleField} type="number" readOnly />
        <F label="USD Final" name="usd_final_amount" value={form.usd_final_amount} onChange={handleField} type="number" readOnly />
        <F label="Transaction Final" name="transaction_final_amount" value={form.transaction_final_amount} onChange={handleField} type="number" readOnly />
      </div>
    </div>
  );
}
