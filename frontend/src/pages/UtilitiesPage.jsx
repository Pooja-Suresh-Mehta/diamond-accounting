/**
 * Utilities Hub (29-35)
 * Tabs: Download MRP, Import Grading, Import Solitaire Price,
 *       Get LAB Data, Stock Transfer, Convert Excel, Stock Telly
 */
import { useState, useRef } from 'react';
import { Download, Upload, RefreshCw, ArrowLeftRight, FileSpreadsheet, ClipboardList, Printer, Plus, Search } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import NumericInput from '../components/NumericInput';
import { fmtAmt } from '../utils/format';

const TABS = [
  { id: 'download-mrp',           label: '29 Download MRP' },
  { id: 'import-grading',         label: '30 Import Grading' },
  { id: 'import-solitaire-price', label: '31 Import Sol. Price' },
  { id: 'get-lab-data',           label: '32 Get LAB Data' },
  { id: 'stock-transfer',         label: '33 Stock Transfer' },
  { id: 'convert-excel',          label: '34 Convert Excel' },
  { id: 'stock-telly',            label: '35 Stock Telly' },
];

/* ── 29: Download MRP ─────────────────────────────────── */

function DownloadMRP() {
  const [loading, setLoading] = useState({ mrp: false, update: false, diasense: false });

  const handleAction = async (action) => {
    setLoading(prev => ({ ...prev, [action]: true }));
    try {
      if (action === 'mrp') {
        const r = await api.get('/utilities/download-mrp', { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mrp_pricelist.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('MRP download started');
      } else if (action === 'update') {
        await api.post('/utilities/update-mrp-stock');
        toast.success('MRP updated in stock');
      } else if (action === 'diasense') {
        const r = await api.get('/utilities/diasense-price-download', { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diasense_prices.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Diasense price download started');
      }
    } catch { toast.error('Action failed'); }
    finally { setLoading(prev => ({ ...prev, [action]: false })); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Download MRP</h2>
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <button onClick={() => handleAction('mrp')} disabled={loading.mrp}
            className="px-6 py-3 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            <Download className="w-4 h-4 inline mr-2" />
            {loading.mrp ? 'Downloading...' : 'Download MRP'}
          </button>
          <button onClick={() => handleAction('update')} disabled={loading.update}
            className="px-6 py-3 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            <RefreshCw className="w-4 h-4 inline mr-2" />
            {loading.update ? 'Updating...' : 'UPDATE MRP IN STOCK'}
          </button>
          <button onClick={() => handleAction('diasense')} disabled={loading.diasense}
            className="px-6 py-3 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            <Download className="w-4 h-4 inline mr-2" />
            {loading.diasense ? 'Downloading...' : 'Diasense Price Download'}
          </button>
        </div>
        <p className="text-sm text-red-500 font-medium">SOLD STONE WILL NOT BE AFFECTED</p>
      </div>
    </div>
  );
}

/* ── 30: Import Grading ───────────────────────────────── */

function ImportGrading() {
  const [loading, setLoading] = useState({});
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const imageRef = useRef(null);

  const handleImport = async (type) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const fd = new FormData();
      if (fileRef.current?.files?.[0]) fd.append('file', fileRef.current.files[0]);
      fd.append('type', type);
      fd.append('replace', replace);
      const r = await api.post('/utilities/import-grading', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.data);
      toast.success(`Import complete: ${r.data.imported || r.data.count || 0} records`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
    finally { setLoading(prev => ({ ...prev, [type]: false })); }
  };

  const importButtons = [
    { key: 'gia', label: 'Import GIA Data' },
    { key: 'igi', label: 'Import IGI Data' },
    { key: 'hrd', label: 'Import HRD Data Format' },
    { key: 'grader', label: 'Import Grader Data Format' },
    { key: 'diasense', label: 'Import DiaSense Purchase Grading' },
  ];

  const dataImportButtons = [
    { key: 'image-video', label: 'Import Image/Video' },
  ];

  const parcelImportButtons = [
    { key: 'parcel-stock', label: 'Import Parcel Stock' },
    { key: 'solitaire-stock', label: 'Import Solitaire Stock' },
    { key: 'purchase', label: 'Import Purchase' },
    { key: 'purchase-txn', label: 'Import Purchase Transaction' },
    { key: 'jewellery-stock', label: 'Import Jewellery Diamond Stock' },
  ];

  const updateButtons = [
    { key: 'update-igi', label: 'Update Igi ID' },
    { key: 'delete-sorted', label: 'Delete Sorted' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Import Grading</h2>
      <div className="bg-white border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Import Grading column */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Import Grading</h3>
            {importButtons.map(btn => (
              <button key={btn.key} onClick={() => handleImport(btn.key)} disabled={loading[btn.key]}
                className="w-full px-4 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors text-left">
                {loading[btn.key] ? 'Importing...' : btn.label}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}
                className="rounded border-gray-300" />
              Upload new data
            </label>
          </div>

          {/* Import Data column */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Import Data</h3>
            {dataImportButtons.map(btn => (
              <button key={btn.key} onClick={() => handleImport(btn.key)} disabled={loading[btn.key]}
                className="w-full px-4 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors text-left">
                {loading[btn.key] ? 'Importing...' : btn.label}
              </button>
            ))}
          </div>

          {/* Import Parcel/Solitaire Data column */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Import Parcel/Solitaire Data</h3>
            {parcelImportButtons.map(btn => (
              <button key={btn.key} onClick={() => handleImport(btn.key)} disabled={loading[btn.key]}
                className="w-full px-4 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors text-left">
                {loading[btn.key] ? 'Importing...' : btn.label}
              </button>
            ))}
          </div>

          {/* Update Items column */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Update Items</h3>
            {updateButtons.map(btn => (
              <button key={btn.key} onClick={() => handleImport(btn.key)} disabled={loading[btn.key]}
                className="w-full px-4 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors text-left">
                {loading[btn.key] ? 'Processing...' : btn.label}
              </button>
            ))}
            <div className="pt-2">
              <label className="text-xs font-medium text-gray-600">Choose Image file</label>
              <input ref={imageRef} type="file" accept="image/*"
                className="w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white" />
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 bg-yellow-500 text-white text-xs rounded font-medium hover:bg-yellow-600">MISSING</button>
              <button className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700">Update</button>
              <button className="px-4 py-1.5 bg-green-600 text-white text-xs rounded font-medium hover:bg-green-700">Login</button>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <p className="font-medium">Import complete</p>
            <pre className="text-xs mt-1 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 31: Import Solitaire Price ───────────────────────── */

function ImportSolitairePrice() {
  const [loading, setLoading] = useState(false);
  const [backRate, setBackRate] = useState('By Aking Back');
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const backRateOptions = [
    'By Aking Back', 'By Asking Rate', 'By Seller Back',
    'By Seller Rate', 'By B2B Back', 'By BRB Rate',
  ];

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Please select a file first');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('back_rate', backRate);
      const r = await api.post('/utilities/import-solitaire-price', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.data);
      toast.success(`Import complete: ${r.data.updated || r.data.count || 0} records`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Utility / Import Pricing</h2>
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-6">
          {/* Table header hints */}
          <div className="flex gap-8 text-sm font-medium text-gray-600">
            <span>LotNo</span>
            <span>Rate/Back</span>
          </div>

          {/* File import button */}
          <div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" id="import-pricing-file" />
            <label htmlFor="import-pricing-file"
              className="inline-block px-6 py-3 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 cursor-pointer transition-colors">
              Import File For Update
            </label>
          </div>

          {/* Back/Rate selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500 uppercase">Back/Rate</label>
            <select value={backRate} onChange={e => setBackRate(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md min-w-[180px]">
              {backRateOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Save button */}
          <button onClick={handleImport} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <p className="font-medium">Import complete</p>
            <pre className="text-xs mt-1 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 32: Get LAB Data ─────────────────────────────────── */

function GetLABData() {
  const [loading, setLoading] = useState({});
  const [lotNumbers, setLotNumbers] = useState('');
  const [result, setResult] = useState(null);
  const [printType, setPrintType] = useState('diasense');

  const fetchData = async (lab) => {
    if (!lotNumbers.trim()) return toast.error('Please enter lot numbers');
    setLoading(prev => ({ ...prev, [lab]: true }));
    try {
      const r = await api.post('/utilities/lab-data', {
        lot_numbers: lotNumbers.split('\n').filter(Boolean),
        lab,
      });
      setResult(r.data);
      toast.success(`${lab.toUpperCase()} data fetched`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Fetch failed'); }
    finally { setLoading(prev => ({ ...prev, [lab]: false })); }
  };

  const handleGetFromList = async () => {
    setLoading(prev => ({ ...prev, list: true }));
    try {
      const r = await api.get('/utilities/lab-data/item-list');
      if (r.data?.lot_numbers) {
        setLotNumbers(r.data.lot_numbers.join('\n'));
      }
      toast.success('Items loaded from list');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to load list'); }
    finally { setLoading(prev => ({ ...prev, list: false })); }
  };

  const handleImportCerts = async () => {
    setLoading(prev => ({ ...prev, import: true }));
    try {
      await api.post('/utilities/lab-data/import-certificates', {
        lot_numbers: lotNumbers.split('\n').filter(Boolean),
      });
      toast.success('Certificate numbers imported');
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
    finally { setLoading(prev => ({ ...prev, import: false })); }
  };

  const handlePrint = () => {
    toast.success(`Printing ${printType === 'diasense' ? 'Diasense Purchase' : 'GIA/IGI'} report...`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Utility / Get Lab Data</h2>
      <div className="bg-white border rounded-lg p-6">
        <div className="flex flex-wrap gap-6">
          {/* Left: Lot number input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">ENTER LOT NO</label>
            <p className="text-xs text-gray-400">Add by lot no</p>
            <textarea value={lotNumbers} onChange={e => setLotNumbers(e.target.value)}
              className="w-60 h-32 px-3 py-2 text-sm border border-gray-300 rounded-md resize-none"
              placeholder="Enter lot numbers, one per line" />
            <div className="space-y-2">
              <button onClick={handleGetFromList} disabled={loading.list}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                {loading.list ? 'Loading...' : 'Get Item From List'}
              </button>
              <button onClick={handleImportCerts} disabled={loading.import}
                className="w-full px-4 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50">
                {loading.import ? 'Importing...' : 'Import Certificate Number'}
              </button>
            </div>
          </div>

          {/* Center: Lab buttons */}
          <div className="space-y-3 pt-6">
            {['gia', 'igi', 'hrd'].map(lab => (
              <button key={lab} onClick={() => fetchData(lab)} disabled={loading[lab]}
                className="w-full px-6 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                {loading[lab] ? 'Fetching...' : `Get ${lab.toUpperCase()} Data`}
              </button>
            ))}
          </div>

          {/* Right: Print options */}
          <div className="space-y-3 pt-6">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="printType" value="diasense" checked={printType === 'diasense'}
                  onChange={e => setPrintType(e.target.value)} className="text-blue-600" />
                Diasense Purchase Print
              </label>
              <button onClick={handlePrint}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 flex items-center gap-1">
                <Printer className="w-3 h-3" /> PRINT
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="printType" value="gia-igi" checked={printType === 'gia-igi'}
                onChange={e => setPrintType(e.target.value)} className="text-blue-600" />
              Gia/IGI Print
            </label>
          </div>
        </div>

        {/* Results table */}
        {result?.items?.length > 0 && (
          <div className="mt-6 border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['LotNo', 'Certificate No', 'Carats'].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{item.lot_no}</td>
                    <td className="px-3 py-2">{item.certificate_no}</td>
                    <td className="px-3 py-2">{item.carats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 33: Stock Transfer ───────────────────────────────── */

function StockTransfer() {
  const [loading, setLoading] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState('500');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', from_lot: '', f_lot_no: '', f_item_rate: '', carats: '', to_lot: '', t_lot_no: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const r = await api.get('/utilities/stock-transfer', { params: { limit: pageSize, search } });
      setTransfers(r.data.results || r.data || []);
    } catch { toast.error('Failed to load transfers'); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!form.from_lot || !form.to_lot || !form.carats) return toast.error('From lot, To lot and carats are required');
    setLoading(true);
    try {
      await api.post('/utilities/stock-transfer', form);
      toast.success('Stock transferred successfully');
      setForm({ date: '', from_lot: '', f_lot_no: '', f_item_rate: '', carats: '', to_lot: '', t_lot_no: '' });
      setShowForm(false);
      loadTransfers();
    } catch (e) { toast.error(e.response?.data?.detail || 'Transfer failed'); }
    finally { setLoading(false); }
  };

  const handleExportExcel = () => {
    toast.success('Exporting to Excel...');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Utility / Stock Transfer List</h2>
        <div className="flex gap-2">
          <button onClick={handleExportExcel}
            className="px-3 py-2 border border-green-600 text-green-600 rounded text-sm hover:bg-green-50 flex items-center gap-1">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Stock Transfer
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">New Stock Transfer</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">From Lot (FLot)</label>
              <input type="text" value={form.from_lot} onChange={e => set('from_lot', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="From Lot" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">F_LotNo</label>
              <input type="text" value={form.f_lot_no} onChange={e => set('f_lot_no', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="F_LotNo" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">FItemRate</label>
              <NumericInput name="f_item_rate" value={form.f_item_rate} onChange={(_, val) => set('f_item_rate', val)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Carats</label>
              <NumericInput name="carats" value={form.carats} onChange={(_, val) => set('carats', val)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">To Lot (TLot)</label>
              <input type="text" value={form.to_lot} onChange={e => set('to_lot', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="To Lot" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">T_LotNo</label>
              <input type="text" value={form.t_lot_no} onChange={e => set('t_lot_no', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="T_LotNo" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <ArrowLeftRight className="w-4 h-4 inline mr-1" />{loading ? 'Transferring...' : 'Transfer Stock'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* List controls */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            SHOW
            <select value={pageSize} onChange={e => setPageSize(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="500">500</option>
              <option value="1000">1,000</option>
              <option value="1500">1,500</option>
              <option value="all">All</option>
            </select>
            ENTRIES
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">SEARCH:</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-48" />
            <button onClick={loadTransfers}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Action', 'Date', 'FLot', 'F_LotNo', 'FItemRate', 'Carats', 'TLot', 'T_LotNo'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
              <tr className="bg-gray-50">
                {Array(8).fill(0).map((_, i) => (
                  <td key={i} className="px-3 py-1">
                    <input type="text" className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No data available in table</td></tr>
              ) : transfers.map((r, i) => (
                <tr key={r.id || i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <button className="text-blue-600 text-xs hover:underline">Edit</button>
                  </td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.from_lot}</td>
                  <td className="px-3 py-2">{r.f_lot_no}</td>
                  <td className="px-3 py-2">{r.f_item_rate}</td>
                  <td className="px-3 py-2">{r.carats}</td>
                  <td className="px-3 py-2">{r.to_lot}</td>
                  <td className="px-3 py-2">{r.t_lot_no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>Showing {transfers.length > 0 ? `1 to ${transfers.length}` : '0 to 0'} of {transfers.length} entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded hover:bg-gray-100">Previous</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-100">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 34: Convert Excel ────────────────────────────────── */

function ConvertExcel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleConvert = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Please select a file first');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/utilities/convert-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.data);
      toast.success('Conversion complete');
    } catch (e) { toast.error(e.response?.data?.detail || 'Conversion failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Convert Your Stock File to DiaSense Purchase Format</h2>
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">CHOOSE FILE</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              className="text-sm text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:hover:bg-gray-50" />
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">BROWSE</button>
          <button onClick={handleConvert} disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {loading ? 'Converting...' : 'Upload & Show Both'}
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-blue-600 mb-2">Your Uploaded File Format</h3>
              <div className="border rounded-lg overflow-x-auto">
                {result.original && (
                  <pre className="text-xs p-3 whitespace-pre-wrap">{JSON.stringify(result.original, null, 2)}</pre>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-600 mb-2">Converted To DiaSense Purchase File Format</h3>
              <div className="border rounded-lg overflow-x-auto">
                {result.converted && (
                  <pre className="text-xs p-3 whitespace-pre-wrap">{JSON.stringify(result.converted, null, 2)}</pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 35: Stock Telly ──────────────────────────────────── */

function StockTelly() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ date: '', shape: '', color: '', size: '', clarity: '' });
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const shapeOptions = ['', 'PR', 'PR1', 'RBC', 'EM', 'EMA', 'Square Emerald', 'PRN', 'MQ', 'AS', 'Pear', 'OV', 'BR', 'CB', 'HE'];
  const colorOptions = ['', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'MIX'];
  const sizeOptions = ['', '10.00 CRT UP', '5.00 CRT UP', '4.00 CRT UP', '3.00 CRT UP', '2.00 CRT UP', '1.50 CRT UP', '1.00 CRT UP', '0.90 UP', '0.70 UP', '0.50 UP', '0.30 UP', '0.18 UP'];
  const clarityOptions = ['', 'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'SI3', 'I1', 'I2', 'I3'];

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.date) params.as_of_date = filters.date;
      if (filters.shape) params.shape = filters.shape;
      if (filters.color) params.color = filters.color;
      if (filters.size) params.size = filters.size;
      if (filters.clarity) params.clarity = filters.clarity;
      const r = await api.get('/utilities/stock-telly', { params });
      setData(r.data);
    } catch { toast.error('Failed to load stock tally'); }
    finally { setLoading(false); }
  };

  const handleExportExcel = () => {
    toast.success('Exporting to Excel...');
  };

  const handleSubmit = async () => {
    toast.success('Submitting stock tally...');
  };

  const handleImportTellyData = async () => {
    toast.success('Import stock telly data...');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Utility / Stock Tally</h2>
        <div className="flex gap-2">
          <button onClick={handleExportExcel}
            className="px-4 py-2 border border-green-600 text-green-600 rounded text-sm font-medium hover:bg-green-50">
            Export Excel
          </button>
          <button onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Submit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input type="date" value={filters.date} onChange={e => setF('date', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Shape</label>
            <select value={filters.shape} onChange={e => setF('shape', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md min-w-[120px]">
              {shapeOptions.map(o => <option key={o} value={o}>{o || 'Shape'}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Color</label>
            <select value={filters.color} onChange={e => setF('color', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md min-w-[100px]">
              {colorOptions.map(o => <option key={o} value={o}>{o || 'Color'}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Size</label>
            <select value={filters.size} onChange={e => setF('size', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md min-w-[130px]">
              {sizeOptions.map(o => <option key={o} value={o}>{o || 'Size'}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Clarity</label>
            <select value={filters.clarity} onChange={e => setF('clarity', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md min-w-[100px]">
              {clarityOptions.map(o => <option key={o} value={o}>{o || 'Clarity'}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">
            {loading ? 'Loading...' : 'Report'}
          </button>
          <button onClick={handleImportTellyData}
            className="px-4 py-2.5 border border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50">
            Import Stock Telly Data
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th colSpan={5} className="px-3 py-2 text-center font-medium text-gray-600 border-r">Stock Data</th>
              <th colSpan={5} className="px-3 py-2 text-center font-medium text-gray-600">Tally Data</th>
            </tr>
            <tr>
              {['Code', 'LotNo', 'Pcs', 'Carats', 'AskingPrice', 'Amount', 'Code', 'LotNo', 'Pcs', 'Carats', 'AskingPrice', 'Amount'].map((h, i) => (
                <th key={`${h}-${i}`} className="px-3 py-3 text-left font-medium text-red-500 whitespace-nowrap text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data || (data.results || []).length === 0 ? (
              <tr><td colSpan={12} className="text-center text-gray-400 py-8">No stock records. Click "Report" to load data.</td></tr>
            ) : (data.results || []).map((r, i) => (
              <tr key={r.id || i} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">{r.code}</td>
                <td className="px-3 py-2 font-medium">{r.lot_no}</td>
                <td className="px-3 py-2">{r.pcs}</td>
                <td className="px-3 py-2">{r.carats}</td>
                <td className="px-3 py-2">{r.asking_price}</td>
                <td className="px-3 py-2 border-r">{r.amount}</td>
                <td className="px-3 py-2">{r.tally_code}</td>
                <td className="px-3 py-2">{r.tally_lot_no}</td>
                <td className="px-3 py-2">{r.tally_pcs}</td>
                <td className="px-3 py-2">{r.tally_carats}</td>
                <td className="px-3 py-2">{r.tally_asking_price}</td>
                <td className="px-3 py-2">{r.tally_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Hub ──────────────────────────────────────────────── */

function UtilityForTab({ tab }) {
  switch (tab) {
    case 'download-mrp':           return <DownloadMRP />;
    case 'import-grading':         return <ImportGrading />;
    case 'import-solitaire-price': return <ImportSolitairePrice />;
    case 'get-lab-data':           return <GetLABData />;
    case 'stock-transfer':         return <StockTransfer />;
    case 'convert-excel':          return <ConvertExcel />;
    case 'stock-telly':            return <StockTelly />;
    default:
      return <p className="text-gray-400">Select a utility tab</p>;
  }
}

export default function UtilitiesPage() {
  const [activeTab, setActiveTab] = useState('download-mrp');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${
              activeTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <UtilityForTab tab={activeTab} />
    </div>
  );
}
