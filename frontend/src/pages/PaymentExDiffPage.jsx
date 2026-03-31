import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save } from 'lucide-react';
import api from '../api';
import F from '../components/FormField';
import ListPageControls from '../components/ListPageControls';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { getCurrencyDefaults } from '../utils/parcelTransactionCalc';

const INIT = {
  vtype: 'Receipt',
  pay_type: 'ExDiff',
  date: getCurrentDateISO(),
  main_account: '',
  party_account: '',
  received_dr: 0,
  paid_cr: 0,
  currency: 'USD',
  inr_rate: 85,
  usd_rate: 1,
  auto_adjust: false,
  description: '',
  amount: 0,
  inr_amt: 0,
  usd_amt: 0,
};

const numericFields = new Set(['inr_rate', 'usd_rate', 'received_dr', 'paid_cr', 'amount', 'inr_amt', 'usd_amt']);

export default function PaymentExDiffPage() {
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
  const [opts, setOpts] = useState({ voucher_types: [], currencies: [], accounts: [] });
  const [form, setForm] = useState({ ...INIT });
  const [invoiceRows, setInvoiceRows] = useState([]);

  useEffect(() => {
    api.get('/payments/options').then(r => setOpts(r.data)).catch(() => {});
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/payments', { params: { pay_type: 'ExDiff', search, page: 1, page_size: 50 } });
      setRows(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (view === 'list') fetchList(); }, [view, search]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/payments/${id}`).then(r => { setForm(r.data); setView('form'); }).catch(() => toast.error('Failed to load'));
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
      return next;
    });
  };

  const handleLoadInvoices = () => {
    if (!form.party_account) return toast.error('Select Transaction Account first');
    toast(`Loading invoices for ${form.party_account}...`);
    // Future: api.get('/payments/pending-invoices', { params: { party: form.party_account, type: 'ExDiff' } })
  };

  const handleSave = async () => {
    if (!form.main_account) return toast.error('Select Main Account');
    if (!form.party_account) return toast.error('Select Transaction Account');
    if (!form.received_dr && !form.paid_cr) return toast.error('Enter Received or Paid amount');
    if (form.received_dr > 0 && form.paid_cr > 0) return toast.error('Cannot set both Received and Paid — enter only one');
    setSaving(true);
    try {
      const payload = { ...form, pay_type: 'ExDiff', amount: form.received_dr || form.paid_cr };
      if (isEdit) {
        await api.put(`/payments/${id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/payments', payload);
        toast.success('Saved');
      }
      setView('list');
      navigate('/financial/payment-exdiff');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (rowId) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/payments/${rowId}`);
      toast.success('Deleted');
      fetchList();
    } catch { toast.error('Delete failed'); }
  };

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['Date', 'Type', 'Main Account', 'Transaction Account', 'Currency', 'Received Dr', 'Paid Cr', 'INR Amt', 'USD Amt'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([r.date, r.vtype, `"${r.main_account || ''}"`, `"${r.party_account || ''}"`, r.currency, (r.received_dr || 0).toFixed(2), (r.paid_cr || 0).toFixed(2), (r.inr_amt || 0).toFixed(2), (r.usd_amt || 0).toFixed(2)].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'payment_exdiff.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Payment / Payment &amp; Receipt WithEx.Diff List</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { setForm({ ...INIT }); setView('form'); navigate('/financial/payment-exdiff/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Payment &amp; Receipt With ExDiff</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit} onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages} onPageChange={setPage} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Transaction Date', 'Vtype', 'Main Account', 'Party Account', 'Amount', 'Symbol', 'INR Amt', 'USD Amt', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : pagedRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">No records</td></tr>
                ) : pagedRows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.vtype === 'Receipt' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.vtype}</span>
                    </td>
                    <td className="px-4 py-3">{r.main_account}</td>
                    <td className="px-4 py-3">{r.party_account}</td>
                    <td className="px-4 py-3">{(r.received_dr || r.paid_cr || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{r.currency}</td>
                    <td className="px-4 py-3">{(r.inr_amt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{(r.usd_amt || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => navigate(`/financial/payment-exdiff/edit/${r.id}`)} className="text-blue-600 hover:underline text-xs">Edit</button>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => { setView('list'); navigate('/financial/payment-exdiff'); }} className="text-sm text-blue-600 hover:underline">← Back</button>
        <h2 className="text-lg font-semibold">Payment / {isEdit ? 'Edit' : 'Add'} Payment &amp; Receipt With Ex.Diff</h2>
        <button onClick={handleSave} disabled={saving} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Row 1: Main Account */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Main Account" name="main_account" value={form.main_account} onChange={handleField} options={opts.accounts || []} searchable />
        </div>

        {/* Row 2: Transaction fields */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <F label="Transaction Date" name="date" value={form.date} onChange={handleField} type="date" />
          <F label="Transaction Account" name="party_account" value={form.party_account} onChange={handleField} options={opts.accounts || []} searchable />
          <F label="Received [Dr.]" name="received_dr" value={form.received_dr} onChange={handleField} type="number" />
          <F label="Paid [Cr.]" name="paid_cr" value={form.paid_cr} onChange={handleField} type="number" />
          <F label="Currency" name="currency" value={form.currency} onChange={handleField} options={['USD']} readOnly />
          <div className="grid grid-cols-2 gap-2">
            <F label="INR *" name="inr_rate" value={form.inr_rate} onChange={handleField} type="number" />
            <F label="USD *" name="usd_rate" value={form.usd_rate} onChange={handleField} type="number" />
          </div>
        </div>

        {/* Row 3: Description + buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea rows={3} value={form.description || ''} onChange={e => handleField('description', e.target.value)}
              placeholder="Description"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.auto_adjust || false} onChange={e => handleField('auto_adjust', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300" />
              Auto Adjust
            </label>
            <div className="flex gap-2">
              <button onClick={handleLoadInvoices} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">On Invoice</button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice table — ExDiff variant has DueDate and Ex Diff INR columns */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b">
            <tr>{['Date', 'Invoice Number', 'DueDate', 'BillNo', 'Carats', 'Inv.Cur', 'USD Amount', 'Base Rate', 'INR Amount', 'Adj USD Amt', 'Adj INR Amt', 'Ex Diff INR', 'Rem USD Amt', 'Rem INR Amt', 'TrnType', 'Invoice Code'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {invoiceRows.length === 0 ? (
              <tr><td colSpan={16} className="text-center py-6 text-gray-400">Click On Invoice to load pending items</td></tr>
            ) : invoiceRows.map((r, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">{r.invoice_number}</td>
                <td className="px-3 py-2">{r.due_date}</td>
                <td className="px-3 py-2">{r.bill_no}</td>
                <td className="px-3 py-2">{r.carats}</td>
                <td className="px-3 py-2">{r.inv_cur}</td>
                <td className="px-3 py-2">{r.usd_amount}</td>
                <td className="px-3 py-2">{r.base_rate}</td>
                <td className="px-3 py-2">{r.inr_amount}</td>
                <td className="px-3 py-2">{r.adj_usd_amt}</td>
                <td className="px-3 py-2">{r.adj_inr_amt}</td>
                <td className="px-3 py-2">{r.ex_diff_inr}</td>
                <td className="px-3 py-2">{r.rem_usd_amt}</td>
                <td className="px-3 py-2">{r.rem_inr_amt}</td>
                <td className="px-3 py-2">{r.trn_type}</td>
                <td className="px-3 py-2">{r.invoice_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
