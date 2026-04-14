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
  vtype: 'Journal',
  date: getCurrentDateISO(),
  credit_account: '',
  debit_account: '',
  currency: 'USD',
  inr_rate: 85,
  usd_rate: 1,
  amount: 0,
  inr_amt: 0,
  usd_amt: 0,
  description: '',
};

const numericFields = new Set(['inr_rate', 'usd_rate', 'amount', 'inr_amt', 'usd_amt']);

function computeAmounts(form) {
  const amount = Number(form.amount) || 0;
  const inrRate = Number(form.inr_rate) || 85;
  const usdRate = Number(form.usd_rate) || 1;
  if (form.currency === 'INR') return { inr_amt: amount, usd_amt: +(amount / inrRate).toFixed(2) };
  if (form.currency === 'USD') return { inr_amt: +(amount * inrRate).toFixed(2), usd_amt: amount };
  if (form.currency === 'AED') return { inr_amt: +(amount * inrRate).toFixed(2), usd_amt: +(amount / inrRate * usdRate).toFixed(2) };
  return {};
}

export default function JournalEntriesPage() {
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
  const [opts, setOpts] = useState({ journal_types: [], currencies: [], accounts: [] });
  const [form, setForm] = useState({ ...INIT });

  useEffect(() => {
    api.get('/journal-entries/options').then(r => setOpts(r.data)).catch(() => {});
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/journal-entries', { params: { search, page: 1, page_size: 50 } });
      setRows(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (view === 'list') fetchList(); }, [view, search]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/journal-entries/${id}`).then(r => { setForm(r.data); setView('form'); }).catch(() => toast.error('Failed to load'));
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
      if (['amount', 'inr_rate', 'usd_rate', 'currency'].includes(name)) {
        return { ...next, ...computeAmounts(next) };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.amount) return toast.error('Amount required');
    if (!form.debit_account || !form.credit_account) return toast.error('Both Received and Paid accounts required');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/journal-entries/${id}`, form);
        toast.success('Updated');
      } else {
        await api.post('/journal-entries', form);
        toast.success('Saved');
      }
      setView('list');
      navigate('/financial/journal-entries');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (rowId) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/journal-entries/${rowId}`);
      toast.success('Deleted');
      fetchList();
    } catch { toast.error('Delete failed'); }
  };

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['Date', 'Vtype', 'Credit Acc', 'Debit Acc', 'Currency', 'Amount', 'INR Amt', 'USD Amt'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([r.date, r.vtype, `"${r.credit_account || ''}"`, `"${r.debit_account || ''}"`, r.currency, (r.amount || 0).toFixed(2), (r.inr_amt || 0).toFixed(2), (r.usd_amt || 0).toFixed(2)].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'journal_entries.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Payment / JV &amp; Expenses</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { setForm({ ...INIT }); setView('form'); navigate('/financial/journal-entries/add'); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add JV / Expense Entry</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit} onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages} onPageChange={setPage} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Date', 'Vtype', 'Credit Acc', 'Debit Acc', 'Amount', 'Symbol', 'INR Amt', 'USD Amt', 'Actions'].map(h => (
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
                    <td className="px-4 py-3">{r.vtype}</td>
                    <td className="px-4 py-3">{r.credit_account}</td>
                    <td className="px-4 py-3 font-medium">{r.debit_account}</td>
                    <td className="px-4 py-3">{fmtAmt(r.amount)}</td>
                    <td className="px-4 py-3">{r.currency}</td>
                    <td className="px-4 py-3">{fmtAmt(r.inr_amt)}</td>
                    <td className="px-4 py-3">{fmtAmt(r.usd_amt)}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => navigate(`/financial/journal-entries/edit/${r.id}`)} className="text-blue-600 hover:underline text-xs">Edit</button>
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
        <button onClick={() => { setView('list'); navigate('/financial/journal-entries'); }} className="text-sm text-blue-600 hover:underline">← Back</button>
        <h2 className="text-lg font-semibold">Payment / Journal &amp; Expense Entry</h2>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Row 1: Transaction Date */}
        <div>
          <F label="Transaction Date" name="date" value={form.date} onChange={handleField} type="date" />
        </div>

        {/* Row 2: Accounts + Amount + Currency + Rates */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <F label="Received [Credit] Account" name="credit_account" value={form.credit_account} onChange={handleField} options={opts.accounts || []} searchable />
          <F label="Paid [Debit] Account" name="debit_account" value={form.debit_account} onChange={handleField} options={opts.accounts || []} searchable />
          <F label="Amount" name="amount" value={form.amount} onChange={handleField} type="number" />
          <F label="Currency" name="currency" value={form.currency} onChange={handleField} options={opts.currencies || ['INR', 'USD', 'AED']} />
          <F label="INR *" name="inr_rate" value={form.inr_rate} onChange={handleField} type="number" />
          <F label="USD *" name="usd_rate" value={form.usd_rate} onChange={handleField} type="number" />
        </div>

        {/* Row 3: Description + Save button */}
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
