import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, FileUp, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api';
import F from '../components/FormField';
import ListPageControls from '../components/ListPageControls';
import PartyField from '../components/PartyField';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { INIT_LINE_ITEM, applyLotAutoFields, calculateTotals, getCurrencyDefaults, normalizeLineItem } from '../utils/parcelTransactionCalc';
import NumericInput from '../components/NumericInput';
import { fmtAmt } from '../utils/format';

const INIT_ITEM = { ...INIT_LINE_ITEM };

const INIT = {
  date: getCurrentDateISO(),
  print_date: getCurrentDateISO(),
  invoice_number: '',
  source_consignment_number: '',
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

export default function ConsignmentReturnPage() {
  const { id } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const isAdd = loc.pathname.endsWith('/add');
  const isEdit = Boolean(id);
  const isForm = isAdd || isEdit;
  const [view, setView] = useState(isForm ? 'form' : 'list');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [opts, setOpts] = useState({ types: [], currencies: [], parties: [], lot_items: [], consignment_numbers: [], payment_statuses: [] });
  const [form, setForm] = useState({ ...INIT });

  useEffect(() => {
    api.get('/consignment-return/options').then(r => setOpts(r.data)).catch(() => {});
    const handleVisibility = () => { if (document.visibilityState === 'visible') api.get('/consignment-return/options').then(r => setOpts(r.data)).catch(() => {}); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/consignment-return', { params: { search, page: 1, page_size: 50 } });
      setRows(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (view === 'list') fetchList(); }, [view, search]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/consignment-return/${id}`).then(r => {
        const d = r.data;
        setForm({ ...d, items: (d.items || []).map(i => ({ ...i, less1_sign: '-', less2_sign: '-', less3_sign: '+' })) });
        setView('form');
      }).catch(() => toast.error('Failed to load'));
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
      const payload = { ...form, items: form.items.map(({ less1_sign, less2_sign, less3_sign, ...i }) => i) };
      if (isEdit) {
        await api.put(`/consignment-return/${id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/consignment-return', payload);
        toast.success('Saved');
      }
      navigate('/parcel/consignment-in-return');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (rowId) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/consignment-return/${rowId}`);
      toast.success('Deleted');
      fetchList();
    } catch { toast.error('Delete failed'); }
  };

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['Invoice #', 'Source Consignment', 'Date', 'Party', 'Currency', 'USD Amt'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([r.invoice_number, r.source_consignment_number, r.date, `"${r.party || ''}"`, r.currency, (r.usd_amt || 0).toFixed(2)].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'consignment_in_return.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Consignment In Return</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { setForm({ ...INIT }); setView('form'); navigate('/parcel/consignment-in-return/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Return</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit} onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages} onPageChange={setPage} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Invoice #', 'Source Consignment', 'Date', 'Party', 'USD Amt', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : pagedRows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No records</td></tr>
                ) : pagedRows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.invoice_number}</td>
                    <td className="px-4 py-3">{r.source_consignment_number}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.party}</td>
                    <td className="px-4 py-3">{fmtAmt(r.usd_amt)}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => navigate(`/parcel/consignment-in-return/edit/${r.id}`)} className="text-blue-600 hover:underline text-xs">Edit</button>
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

  const lots = opts.lot_items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/parcel/consignment-in-return')} className="text-sm text-blue-600 hover:underline">← Back</button>
        <h2 className="text-lg font-semibold">{isEdit ? 'Edit' : 'New'} Consignment In Return</h2>
        <button onClick={handleSave} disabled={saving} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <F label="Invoice #" name="invoice_number" value={form.invoice_number} onChange={handleField} />
        <F label="Source Consignment #" name="source_consignment_number" value={form.source_consignment_number} onChange={handleField}
          options={opts.consignment_numbers || []} searchable />
        <F label="Date" name="date" value={form.date} onChange={handleField} type="date" />
        <PartyField value={form.party} onChange={handleField} options={opts.parties || []} />
        <F label="Currency" name="currency" value={form.currency} onChange={handleField} options={opts.currencies || []} />
        <F label="INR Rate" name="inr_rate" value={form.inr_rate} onChange={handleField} type="number" />
        <F label="USD Rate" name="usd_rate" value={form.usd_rate} onChange={handleField} type="number" />
        <F label="Payment Status" name="payment_status" value={form.payment_status} onChange={handleField} options={opts.payment_statuses || []} />
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Items</h3>
          <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs">
            <Plus className="w-3 h-3" />Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>{['Item Name', 'Lot #', 'Issue Cts', 'Reje%', 'Sel.Cts', 'Pcs', 'Rate', 'Amount', ''].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium text-gray-600">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx} className="border-t">
                  {[
                    { name: 'lot_number', lotOpts: lots },
                    { name: 'lot_number', readOnly: true },
                    { name: 'issue_carats', type: 'number' },
                    { name: 'reje_pct', type: 'number' },
                    { name: 'selected_carat', type: 'number' },
                    { name: 'pcs', type: 'number' },
                    { name: 'rate', type: 'number' },
                    { name: 'amount', type: 'number', readOnly: true },
                  ].map(({ name, opts: o, lotOpts, type = 'text', readOnly }, colIdx) => (
                    <td key={colIdx} className="px-1 py-1" style={{ minWidth: '80px' }}>
                      {lotOpts ? (
                        <select value={item.lot_number || ''} onChange={e => handleItem(idx, 'lot_number', e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded px-1 py-1">
                          <option value="">-- Select Item --</option>
                          {lotOpts.map(lot => <option key={lot.lot_no} value={lot.lot_no}>{lot.item_name} ({lot.lot_no})</option>)}
                        </select>
                      ) : o ? (
                        <select value={item[name] || ''} onChange={e => handleItem(idx, name, e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded px-1 py-1">
                          <option value="">--</option>
                          {o.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        readOnly && type === 'number' ? (
                          <input type="text" value={fmtAmt(item[name])} readOnly className="w-full text-xs border border-gray-200 rounded px-1 py-1 bg-gray-50" />
                        ) : type === 'number' && !name.endsWith('_pct') ? (
                          <NumericInput name={name} value={item[name]} onChange={(_, val) => handleItem(idx, name, val)} className="w-full text-xs border border-gray-200 rounded px-1 py-1" />
                        ) : type === 'number' ? (
                          <input type="number" value={item[name] ?? ''} onChange={e => handleItem(idx, name, e.target.value)} className="w-full text-xs border border-gray-200 rounded px-1 py-1" />
                        ) : (
                          <input type="text" value={item[name] ?? ''} readOnly={readOnly} onChange={e => handleItem(idx, name, e.target.value)} className={`w-full text-xs border border-gray-200 rounded px-1 py-1 ${readOnly ? 'bg-gray-50' : ''}`} />
                        )
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
          {form.items.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No items</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
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
      </div>
    </div>
  );
}
