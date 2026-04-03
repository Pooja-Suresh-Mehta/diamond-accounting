import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { HardDrive, Upload, Download, Database, RefreshCw, FileSpreadsheet } from 'lucide-react';

export default function BackupRestorePage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fetchInfo = async () => {
    try {
      const res = await api.get('/backup/info');
      setTables(res.data.tables);
    } catch {
      toast.error('Failed to load backup info');
    }
  };

  useEffect(() => { fetchInfo(); }, []);

  const totalRows = tables.reduce((s, t) => s + t.rows, 0);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      a.download = match ? match[1] : 'poojan_gems_backup.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Backup downloaded as Excel!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportDB = async () => {
    setLoading(true);
    try {
      const res = await api.get('/backup/db-copy', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      a.download = match ? match[1] : 'poojan_gems.sqlite';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Database file downloaded!');
    } catch {
      toast.error('DB download failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Please select an .xlsx file');
      return;
    }
    if (!window.confirm(
      'WARNING: This will REPLACE all existing data with the backup data.\n\nAre you sure you want to restore from this file?'
    )) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/backup/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      toast.success(res.data.message);
      fetchInfo();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <HardDrive className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Backup & Restore</h1>
      </div>

      {/* Database Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Database Summary</h2>
          <button onClick={fetchInfo} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{tables.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tables</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalRows.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Rows</p>
          </div>
        </div>
        <div className="max-h-48 overflow-auto border dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Table</th>
                <th className="text-right px-3 py-2 text-gray-600 dark:text-gray-300">Rows</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.table} className="border-t dark:border-gray-700">
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{t.table}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{t.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Export Backup</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-3 p-4 border-2 border-green-200 dark:border-green-800 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-8 h-8 text-green-600" />
            <div className="text-left">
              <p className="font-semibold text-gray-800 dark:text-white">
                {exporting ? 'Exporting...' : 'Download as Excel'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                .xlsx file — one sheet per table. Can be opened & edited in Excel.
              </p>
            </div>
          </button>
          <button
            onClick={handleExportDB}
            disabled={loading}
            className="flex items-center gap-3 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
          >
            <Database className="w-8 h-8 text-blue-600" />
            <div className="text-left">
              <p className="font-semibold text-gray-800 dark:text-white">
                {loading ? 'Downloading...' : 'Download SQLite DB'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Raw database file — fastest restore, exact copy.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Restore from Backup</h2>
        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-xl p-6 text-center">
          <Upload className="w-10 h-10 text-orange-500 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 mb-1 font-medium">
            Upload an Excel backup (.xlsx) to restore
          </p>
          <p className="text-xs text-red-500 mb-4">
            This will REPLACE all current data. Make sure to export a backup first!
          </p>
          <label className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium cursor-pointer transition-colors ${importing ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
            <Download className="w-4 h-4" />
            {importing ? 'Restoring...' : 'Choose .xlsx File'}
            <input
              type="file"
              accept=".xlsx"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>

        {importResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <p className="font-semibold text-green-800 dark:text-green-300">{importResult.message}</p>
            {importResult.imported_tables?.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Restored: {importResult.imported_tables.join(', ')}
              </p>
            )}
            {importResult.skipped_sheets?.length > 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                Skipped: {importResult.skipped_sheets.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
