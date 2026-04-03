import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Save, Pencil, Trash2 } from 'lucide-react';
import api from '../api';
import ListPageControls from '../components/ListPageControls';
import CreatableField from '../components/CreatableField';

const INIT = {
  lot_no: '',
  item_name: '',
  shape: '',
  color: '',
  clarity: '',
  size: '',
  sieve_mm: '',
  stock_group_id: '',
  description: '',
  stock_type: 'Natural Diamond',
  stock_subtype: 'Polished',
  grown_process_type: 'Natural',
  opening_weight_carats: 0.0,
  opening_pcs: 0,
  usd_to_inr_rate: 0.0,
  purchase_cost_price_usd_carats: 0.0,
  purchase_cost_usd_amount: 0.0,
  purchase_cost_price_inr_carats: 0.0,
  purchase_cost_inr_amount: 0.0,
  asking_price_usd_carats: 0.0,
  asking_usd_amount: 0.0,
  asking_price_inr_carats: 0.0,
  asking_inr_amount: 0.0,
};

const numericFields = new Set([
  'opening_weight_carats', 'opening_pcs', 'usd_to_inr_rate',
  'purchase_cost_price_usd_carats', 'purchase_cost_usd_amount',
  'purchase_cost_price_inr_carats', 'purchase_cost_inr_amount',
  'asking_price_usd_carats', 'asking_usd_amount',
  'asking_price_inr_carats', 'asking_inr_amount',
]);

function Field({ name, label, value, onChange, options = [], rows = 1, readOnly = false }) {
  const cls = `w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none ${readOnly ? 'bg-gray-100 text-gray-700' : ''}`;
  if (options.length) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        <select value={value || ''} onChange={(e) => onChange(name, e.target.value)} className={cls}>
          <option value="">Select {label}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (rows > 1) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        <textarea value={value ?? ''} rows={rows} onChange={(e) => onChange(name, e.target.value)} readOnly={readOnly} className={cls} />
      </div>
    );
  }
  const type = numericFields.has(name) ? 'number' : 'text';
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)} readOnly={readOnly} className={cls} />
    </div>
  );
}

export default function ParcelMasterPage() {
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
    shapes: [], colors: [], clarities: [], sizes: [], sieves: [], group_ids: [],
    stock_types: ['Natural Diamond', 'Gem Stone'], stock_subtypes: ['Polished', 'Makeable'], grown_process_types: ['Natural'],
  });

  const loadRows = async () => {
    const res = await api.get('/parcel-master', { params: { search } });
    setRows(Array.isArray(res.data) ? res.data : []);
    setPage(1);
  };
  const loadOpts = async () => {
    const res = await api.get('/parcel-master/options');
    setOpts(res.data);
  };

  const handleNewOption = (fieldKey, newVal) => {
    const keyMap = { shape: 'shapes', color: 'colors', clarity: 'clarities', size: 'sizes', sieve: 'sieves', stock_group: 'group_ids' };
    const optsKey = keyMap[fieldKey];
    if (optsKey) setOpts((prev) => ({ ...prev, [optsKey]: [...(prev[optsKey] || []), newVal] }));
  };
  const loadEdit = async () => {
    if (!id) return;
    const res = await api.get(`/parcel-master/${id}`);
    setForm({ ...INIT, ...res.data });
  };

  useEffect(() => { loadOpts().catch(() => toast.error('Failed to load parcel options')); }, []);
  useEffect(() => {
    if (!isFormMode) loadRows().catch(() => toast.error('Failed to load parcel list'));
  }, [search, isFormMode]);
  useEffect(() => {
    if (isEditMode) loadEdit().catch(() => toast.error('Failed to load parcel item'));
    if (isAddMode) setForm(INIT);
  }, [isEditMode, isAddMode, id]);

  useEffect(() => {
    if (!isFormMode) return;
    const s = [form.shape, form.color, form.size, form.clarity].filter(Boolean).join(' ').trim();
    setForm((p) => ({ ...p, item_name: s }));
  }, [form.shape, form.color, form.size, form.clarity, isFormMode]);

  useEffect(() => {
    if (!isFormMode) return;
    const rate = Number(form.usd_to_inr_rate || 0);
    const weight = Number(form.opening_weight_carats || 0);
    const purUsd = Number(form.purchase_cost_price_usd_carats || 0);
    const askUsd = Number(form.asking_price_usd_carats || 0);
    const purchaseInrCarat = rate * purUsd;
    const askingInrCarat = rate * askUsd;
    setForm((p) => ({
      ...p,
      purchase_cost_price_inr_carats: Number(purchaseInrCarat.toFixed(2)),
      purchase_cost_inr_amount: Number((purchaseInrCarat * weight).toFixed(2)),
      asking_price_inr_carats: Number(askingInrCarat.toFixed(2)),
      asking_inr_amount: Number((askingInrCarat * weight).toFixed(2)),
    }));
  }, [form.usd_to_inr_rate, form.purchase_cost_price_usd_carats, form.asking_price_usd_carats, form.opening_weight_carats, isFormMode]);

  const setValue = (name, value) => {
    if (numericFields.has(name)) {
      setForm((p) => ({ ...p, [name]: value === '' ? '' : Number(value) }));
      return;
    }
    setForm((p) => ({ ...p, [name]: value }));
  };

  const save = async () => {
    if (!form.lot_no.trim()) return toast.error('Stock ID/LotNo is required');
    if (!form.shape) return toast.error('Shape is required');
    if (!form.size) return toast.error('Size is required');
    setSaving(true);
    try {
      const payload = { ...form };
      for (const f of numericFields) payload[f] = payload[f] === '' ? 0 : Number(payload[f]);
      if (isEditMode) await api.put(`/parcel-master/${id}`, payload);
      else await api.post('/parcel-master', payload);
      toast.success(isEditMode ? 'Updated' : 'Created');
      navigate('/parcel-master', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (rowId) => {
    if (!confirm('Delete parcel item?')) return;
    try {
      await api.delete(`/parcel-master/${rowId}`);
      toast.success('Deleted');
      await loadRows();
    } catch {
      toast.error('Delete failed');
    }
  };

  const tableRows = useMemo(() => rows.slice((page - 1) * rowLimit, (page - 1) * rowLimit + rowLimit), [rows, page, rowLimit]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowLimit));

  if (!isFormMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Parcel Master</h1>
          <button onClick={() => navigate('/parcel-master/add')} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Parcel Item
          </button>
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
                  <th className="text-left px-3 py-2">Edit</th>
                  <th className="text-left px-3 py-2">Delete</th>
                  <th className="text-left px-3 py-2">LotNo</th>
                  <th className="text-left px-3 py-2">ItemName</th>
                  <th className="text-left px-3 py-2">Shape</th>
                  <th className="text-left px-3 py-2">Color</th>
                  <th className="text-left px-3 py-2">Size</th>
                  <th className="text-left px-3 py-2">Cla</th>
                  <th className="text-left px-3 py-2">Sieve</th>
                  <th className="text-right px-3 py-2">Weight</th>
                  <th className="text-right px-3 py-2">MRP</th>
                  <th className="text-left px-3 py-2">Created At</th>
                  <th className="text-left px-3 py-2">Created By</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2"><button onClick={() => navigate(`/parcel-master/edit/${r.id}`)} className="text-blue-600"><Pencil className="w-4 h-4" /></button></td>
                    <td className="px-3 py-2"><button onClick={() => removeRow(r.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    <td className="px-3 py-2">{r.lot_no}</td>
                    <td className="px-3 py-2">{r.item_name}</td>
                    <td className="px-3 py-2">{r.shape}</td>
                    <td className="px-3 py-2">{r.color}</td>
                    <td className="px-3 py-2">{r.size}</td>
                    <td className="px-3 py-2">{r.clarity}</td>
                    <td className="px-3 py-2">{r.sieve_mm}</td>
                    <td className="px-3 py-2 text-right">{Number(r.opening_weight_carats || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.asking_inr_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                    <td className="px-3 py-2">{r.created_by_name || ''}</td>
                  </tr>
                ))}
                {tableRows.length === 0 && <tr><td colSpan={13} className="text-center px-3 py-5 text-gray-500">No records found</td></tr>}
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
        <h1 className="text-2xl font-bold text-gray-800">Parcel Master / {isEditMode ? 'Edit Parcel Item' : 'Add Parcel Item Master'}</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/parcel-master')} className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">Back to List</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
        <div>
          <h2 className="text-4xl font-semibold text-gray-700">Parcel Item Details</h2>
          <p className="text-gray-500 mt-1">Enter your Item Details</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Field name="lot_no" label="Stock ID/LotNo" value={form.lot_no} onChange={setValue} />
          <CreatableField name="shape" label="Shape" value={form.shape} onChange={setValue} options={opts.shapes} fieldKey="shape" onNewOption={handleNewOption} />
          <CreatableField name="color" label="Color" value={form.color} onChange={setValue} options={opts.colors} fieldKey="color" onNewOption={handleNewOption} />
          <CreatableField name="clarity" label="Clarity" value={form.clarity} onChange={setValue} options={opts.clarities} fieldKey="clarity" onNewOption={handleNewOption} />
          <CreatableField name="size" label="Size" value={form.size} onChange={setValue} options={opts.sizes} fieldKey="size" onNewOption={handleNewOption} />
          <CreatableField name="sieve_mm" label="Sieve / MM" value={form.sieve_mm} onChange={setValue} options={opts.sieves} fieldKey="sieve" onNewOption={handleNewOption} />
          <Field name="item_name" label="Stock Name" value={form.item_name} onChange={setValue} />
          <CreatableField name="stock_group_id" label="Stock GroupID" value={form.stock_group_id} onChange={setValue} options={opts.group_ids} fieldKey="stock_group" onNewOption={handleNewOption} />
          <div className="xl:col-span-2"><Field name="description" label="Description" value={form.description} onChange={setValue} rows={2} /></div>
        </div>

        <div className="border-t pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field name="stock_type" label="Stock Type" value={form.stock_type} onChange={setValue} options={opts.stock_types} />
          <Field name="stock_subtype" label="Stock SubType" value={form.stock_subtype} onChange={setValue} options={opts.stock_subtypes} />
          <Field name="grown_process_type" label="Grown/Process Type" value={form.grown_process_type} onChange={setValue} options={opts.grown_process_types} />
        </div>

        <div className="border-t pt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <Field name="opening_weight_carats" label="Opening Weight/Carats" value={form.opening_weight_carats} onChange={setValue} />
          <Field name="opening_pcs" label="Opening Pcs" value={form.opening_pcs} onChange={setValue} />
          <Field name="usd_to_inr_rate" label="USD to INR Rate" value={form.usd_to_inr_rate} onChange={setValue} />
          <Field name="purchase_cost_price_usd_carats" label="Purchase/Cost Price USD/Carats" value={form.purchase_cost_price_usd_carats} onChange={setValue} />
          <Field name="purchase_cost_usd_amount" label="Purchase/Cost USD Amount" value={form.purchase_cost_usd_amount} onChange={setValue} />
          <Field name="purchase_cost_price_inr_carats" label="Purchase/Cost Price INR/Carats" value={form.purchase_cost_price_inr_carats} onChange={setValue} />
          <Field name="purchase_cost_inr_amount" label="Purchase/Cost INR Amount" value={form.purchase_cost_inr_amount} onChange={setValue} />
          <Field name="asking_price_usd_carats" label="Asking Price USD/Carats" value={form.asking_price_usd_carats} onChange={setValue} />
          <Field name="asking_usd_amount" label="Asking USD Amount" value={form.asking_usd_amount} onChange={setValue} />
          <Field name="asking_price_inr_carats" label="Asking Price INR/Carats" value={form.asking_price_inr_carats} onChange={setValue} readOnly />
          <Field name="asking_inr_amount" label="Asking INR Amount" value={form.asking_inr_amount} onChange={setValue} readOnly />
        </div>
      </div>
    </div>
  );
}
