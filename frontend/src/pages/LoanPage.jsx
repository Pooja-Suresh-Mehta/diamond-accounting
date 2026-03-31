import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Save } from 'lucide-react';
import api from '../api';
import F from '../components/FormField';
import ListPageControls from '../components/ListPageControls';
import PartyField from '../components/PartyField';
import { getCurrentDateISO } from '../utils/dateDefaults';
import { getCurrencyDefaults } from '../utils/parcelTransactionCalc';

const INIT = {
  loan_type: 'Given',
  inv_no: '',
  date: getCurrentDateISO(),
  renew_date: getCurrentDateISO(),
  outstanding: false,
  party: '',
  due_date: getCurrentDateISO(),
  due_days: 0,
  currency: 'USD',
  inr_rate: 85,
  usd_rate: 1,
  broker: '',
  broker_pct: 0,
  amount: 0,
  interest_pct: 0,
  interest: 0,
  divide_days: 365,
  rec_from_party: '',
  description: '',
};

const numericFields = new Set(['inr_rate', 'usd_rate', 'amount', 'broker_pct', 'interest_pct', 'interest', 'divide_days', 'due_days']);

export default function LoanPage({ loanType: propLoanType }) {
  const { id } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const isAdd = loc.pathname.endsWith('/add');
  const isEdit = Boolean(id);
  const isForm = isAdd || isEdit;
  const defaultType = propLoanType || 'Given';
  const [view, setView] = useState(isForm ? 'form' : 'list');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(100);
  const [page, setPage] = useState(1);
  const [opts, setOpts] = useState({ loan_types: [], currencies: [], parties: [], brokers: [] });
  const [form, setForm] = useState({ ...INIT, loan_type: defaultType });
  const [filterType, setFilterType] = useState(defaultType);

  useEffect(() => {
    api.get('/loans/options').then(r => {
      setOpts(r.data);
      if (!isEdit && r.data.next_inv_no) {
        setForm(f => ({ ...f, inv_no: f.inv_no || r.data.next_inv_no }));
      }
    }).catch(() => {});
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/loans', { params: { loan_type: filterType, search, page: 1, page_size: 50 } });
      setRows(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (view === 'list') fetchList(); }, [view, search, filterType]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/loans/${id}`).then(r => { setForm(r.data); setView('form'); }).catch(() => toast.error('Failed to load'));
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
      if (name === 'outstanding') {
        next.outstanding = value === true || value === 'true';
      }
      if (name === 'date' || name === 'due_date') {
        const d = name === 'date' ? value : next.date;
        const dd = name === 'due_date' ? value : next.due_date;
        if (d && dd) {
          next.due_days = Math.max(0, Math.round((new Date(dd) - new Date(d)) / 86400000));
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.party) return toast.error('Select Party');
    if (!form.rec_from_party) return toast.error(form.loan_type === 'Taken' ? 'Select Pay. To Party' : 'Select Rec. From Party');
    if (!form.amount) return toast.error('Enter Amount');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/loans/${id}`, form);
        toast.success('Updated');
      } else {
        await api.post('/loans', form);
        toast.success('Saved');
      }
      navigate(`/financial/loan-${form.loan_type.toLowerCase()}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (rowId) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/loans/${rowId}`);
      toast.success('Deleted');
      fetchList();
    } catch { toast.error('Delete failed'); }
  };

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  const exportExcel = () => {
    const headers = ['INV No', 'Date', 'Party', 'Currency', 'Amount', 'Interest %', 'Interest', 'Broker', 'Rec. From Party'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([r.inv_no, r.date, `"${r.party || ''}"`, r.currency, (r.amount || 0).toFixed(2), r.interest_pct || 0, r.interest || 0, `"${r.broker || ''}"`, `"${r.rec_from_party || ''}"`].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan_${filterType.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (view === 'list') {
    const title = `Loans / Loan ${filterType} List`;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-200 rounded-lg flex items-center gap-1.5"><Download className="w-4 h-4" /> Export Excel</button>
            <button onClick={() => { setForm({ ...INIT, loan_type: filterType, inv_no: opts.next_inv_no || '' }); setView('form'); navigate(`/financial/loan-${filterType.toLowerCase()}/add`); }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Loan {filterType}</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <ListPageControls search={search} onSearchChange={setSearch} rowLimit={rowLimit} onRowLimitChange={(v) => { setRowLimit(v); setPage(1); }} page={page} totalPages={totalPages} onPageChange={setPage} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['INV No', 'Date', 'Party', 'Currency', 'Amount', 'Interest %', 'Broker', 'Rec. From Party', 'Actions'].map(h => (
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
                    <td className="px-4 py-3">{r.inv_no}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3 font-medium">{r.party}</td>
                    <td className="px-4 py-3">{r.currency}</td>
                    <td className="px-4 py-3">{(r.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{r.interest_pct || 0}</td>
                    <td className="px-4 py-3">{r.broker}</td>
                    <td className="px-4 py-3">{r.rec_from_party}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => navigate(`/financial/loan-${r.loan_type.toLowerCase()}/edit/${r.id}`)} className="text-blue-600 hover:underline text-xs">Edit</button>
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
        <button onClick={() => { setView('list'); navigate(`/financial/loan-${form.loan_type.toLowerCase()}`); }} className="text-sm text-blue-600 hover:underline">← Back</button>
        <h2 className="text-lg font-semibold">{isEdit ? 'Edit' : 'Add'} Loan {form.loan_type}</h2>
        <button onClick={handleSave} disabled={saving} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Submit'}
        </button>
      </div>

      <div className="bg-white rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <F label="INV NO" name="inv_no" value={form.inv_no} onChange={handleField} readOnly />
        <F label="Date" name="date" value={form.date} onChange={handleField} type="date" />
        <F label="Renew Date" name="renew_date" value={form.renew_date} onChange={handleField} type="date" />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.outstanding || false} onChange={e => handleField('outstanding', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300" />
            Outstanding
          </label>
        </div>

        <PartyField value={form.party} onChange={handleField} options={opts.parties || []} />
        <F label="Due Date" name="due_date" value={form.due_date} onChange={handleField} type="date" />
        <F label="Due Days" name="due_days" value={form.due_days} onChange={handleField} type="number" readOnly />

        <F label="Currency" name="currency" value={form.currency} onChange={handleField} options={opts.currencies || ['INR', 'USD', 'AED']} />
        <div className="grid grid-cols-2 gap-2">
          <F label="INR *" name="inr_rate" value={form.inr_rate} onChange={handleField} type="number" />
          <F label="USD *" name="usd_rate" value={form.usd_rate} onChange={handleField} type="number" />
        </div>

        <F label="Broker" name="broker" value={form.broker} onChange={handleField} options={opts.brokers || []} searchable />
        <F label="Broker %" name="broker_pct" value={form.broker_pct} onChange={handleField} type="number" />

        <F label="Amount" name="amount" value={form.amount} onChange={handleField} type="number" />
        <F label="Interest %" name="interest_pct" value={form.interest_pct} onChange={handleField} type="number" />
        <F label="Interest" name="interest" value={form.interest} onChange={handleField} type="number" />
        <F label="Divide Days" name="divide_days" value={form.divide_days} onChange={handleField} type="number" />

        <PartyField name="rec_from_party" label="Rec. From Party" value={form.rec_from_party} onChange={handleField} options={opts.parties || []} />

        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea rows={3} value={form.description || ''} onChange={e => handleField('description', e.target.value)}
            placeholder="Description"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </div>
  );
}
