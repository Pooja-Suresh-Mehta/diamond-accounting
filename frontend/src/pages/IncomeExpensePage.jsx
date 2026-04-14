import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save } from 'lucide-react';
import api from '../api';
import F from '../components/FormField';
import ListPageControls from '../components/ListPageControls';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { getCurrencyDefaults } from '../utils/parcelTransactionCalc';
import { fmtAmt } from '../utils/format';

const INIT = {
  date: getCurrentDateISO(),
  main_account: '',
  trn_account: '',
  received_dr: 0,
  paid_cr: 0,
  currency: 'USD',
  inr_rate: 85,
  usd_rate: 1,
  amount: 0,
  inr_amt: 0,
  usd_amt: 0,
  description: '',
};

const numericFields = new Set(['received_dr', 'paid_cr', 'inr_rate', 'usd_rate', 'amount', 'inr_amt', 'usd_amt']);

function computeAmounts(form) {
  const amount = Number(form.received_dr) || Number(form.paid_cr) || 0;
  const inrRate = Number(form.inr_rate) || 85;
  const usdRate = Number(form.usd_rate) || 1;
  if (form.currency === 'INR') return { amount, inr_amt: amount, usd_amt: +(amount / inrRate).toFixed(2) };
  if (form.currency === 'USD') return { amount, inr_amt: +(amount * inrRate).toFixed(2), usd_amt: amount };
  if (form.currency === 'AED') return { amount, inr_amt: +(amount * inrRate).toFixed(2), usd_amt: +(amount / inrRate * usdRate).toFixed(2) };
  return { amount };
}

export default function IncomeExpensePage() {
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
  const [opts, setOpts] = useState({ currencies: [], accounts: [] });
  const [form, setForm] = useState({ ...INIT });

  useEffect(() => {
    api.get('/income-expense/options').then(r => setOpts(r.data)).catch(() => {});
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/income-expense', { params: { search, page: 1, page_size: 50 } });
      setRows(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (view === 'list') fetchList(); }, [view, search]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/income-expense/${id}`).then(r => { setForm(r.data); setView('form'); }).catch(() => toast.error('Failed to load'));
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
      if (['received_dr', 'paid_cr', 'inr_rate', 'usd_rate', 'currency'].includes(name)) {
        return { ...next, ...computeAmounts(next) };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.main_account) return toast.error('Main Account required');
    if (!form.received_dr && !form.paid_cr) return toast.error('Enter Received or Paid amount');
    if (form.received_dr > 0 && form.paid_cr > 0) return toast.error('Cannot set both Received and Paid — enter only one');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/income-expense/${id}`, form);
        toast.success('Updated');
      } else {
        await api.post('/income-expense', form);
        toast.success('Saved');
      }
      setView('list');
      navigate('/financial/income-expense');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (rowId) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/income-expense/${rowId}`);
      toast.success('Deleted');
      fetchList();
    } catch { toast.error('Delete failed'); }
  };

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['GCode', 'Transaction Date', 'Vtype', 'Main Account', 'Party Account', 'Amount', 'Symbol', 'INR Amt', 'USD Amt', 'Description'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([
        r.id,
        r.date,
        r.ie_type,
        `"${r.main_account || ''}"`,
        `"${r.trn_account || ''}"`,
        (r.amount || 0).toFixed(2),
        r.currency,
        (r.inr_amt || 0).toFixed(2),
        (r.usd_amt || 0).toFixed(2),
        `"${(r.description || '').replace(/"/g, '""')}"`
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'income_expense.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Payment / Income &amp; Expense List</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { setForm({ ...INIT }); setView('form'); navigate('/financial/income-expense/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Income &amp; Expense</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit} onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages} onPageChange={setPage} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Action', 'GCode', 'Transaction Date', 'Vtype', 'Main Account', 'Party Account', 'Amount', 'Symbol', 'INR Amt', 'USD Amt', 'Disc'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : pagedRows.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400">No records</td></tr>
                ) : pagedRows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => navigate(`/financial/income-expense/edit/${r.id}`)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.ie_type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                        {r.ie_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.main_account}</td>
                    <td className="px-4 py-3">{r.trn_account}</td>
                    <td className="px-4 py-3 text-right">{fmtAmt(r.amount)}</td>
                    <td className="px-4 py-3">{r.currency}</td>
                    <td className="px-4 py-3 text-right">{fmtAmt(r.inr_amt)}</td>
                    <td className="px-4 py-3 text-right">{fmtAmt(r.usd_amt)}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-500">{r.description}</td>
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
        <button onClick={() => { setView('list'); navigate('/financial/income-expense'); }} className="text-sm text-blue-600 hover:underline">← Back</button>
        <h2 className="text-lg font-semibold">Income &amp; Expense Entry</h2>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Row 1: Main Account + Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <F label="Main Account" name="main_account" value={form.main_account} onChange={handleField} options={opts.accounts || []} searchable />
          <F label="Transaction Date" name="date" value={form.date} onChange={handleField} type="date" />
        </div>

        {/* Row 2: Transaction Account + Received + Paid + Currency + Rates */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <F label="Transaction Account" name="trn_account" value={form.trn_account} onChange={handleField} options={opts.accounts || []} searchable />
          <F label="Received [Dr.]" name="received_dr" value={form.received_dr} onChange={handleField} type="number" />
          <F label="Paid [Cr.]" name="paid_cr" value={form.paid_cr} onChange={handleField} type="number" />
          <F label="Currency" name="currency" value={form.currency} onChange={handleField} options={opts.currencies || ['INR', 'USD', 'AED']} />
          <F label="INR *" name="inr_rate" value={form.inr_rate} onChange={handleField} type="number" />
          <F label="USD *" name="usd_rate" value={form.usd_rate} onChange={handleField} type="number" />
        </div>

        {/* Row 3: Description + Save */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea rows={4} value={form.description || ''} onChange={e => handleField('description', e.target.value)}
              placeholder="Description"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-start pt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
