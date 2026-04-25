import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, X, Check, AlertTriangle, GitMerge } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const FIELD_LABELS = {
  shape: 'Shape',
  color: 'Color',
  clarity: 'Clarity',
  size: 'Size',
  sieve: 'Sieve',
  stock_group: 'Stock Group',
};
const FIELDS = Object.keys(FIELD_LABELS);

function PairingPanel({ title, subtitle, pairings, editingKey, editValue, onEditStart, onEditCancel, onEditSave, onValueChange, valueOptions, valueLabel }) {
  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <GitMerge className="w-4 h-4 text-blue-600" />
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <span className="text-xs text-gray-400 ml-1">({subtitle})</span>
      </div>
      <div className="divide-y divide-gray-50">
        {Object.entries(pairings).length === 0 && (
          <div className="px-5 py-6 text-center text-gray-400 text-sm">No pairings configured</div>
        )}
        {Object.entries(pairings).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 group">
            <span className="w-36 text-sm font-medium text-gray-800">{key}</span>
            <span className="text-gray-400 text-xs">→</span>
            {editingKey === key ? (
              <>
                <select
                  autoFocus
                  value={editValue}
                  onChange={(e) => onValueChange(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select {valueLabel}...</option>
                  {valueOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button
                  onClick={() => { if (!editValue) { onEditCancel(); return; } onEditSave(key, editValue); }}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={onEditCancel} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-700">{val || <span className="text-gray-400 italic">not set</span>}</span>
                <button
                  onClick={() => onEditStart(key, val || '')}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit pairing"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManageDropdownsPage() {
  const [activeField, setActiveField] = useState('shape');
  const [allOptions, setAllOptions] = useState({});
  const [loading, setLoading] = useState(true);

  // Inline edit state
  const [editingValue, setEditingValue] = useState(null);
  const [editText, setEditText] = useState('');

  // Add state
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [addShapeStockGroup, setAddShapeStockGroup] = useState('');

  // Usage dialog
  const [usageInfo, setUsageInfo] = useState(null);

  // Shape→Stock Group pairing
  const [shapeMap, setShapeMap] = useState({});
  // Size→Sieve pairing
  const [sizeSieveMap, setSizeSieveMap] = useState({});
  const [editingPairing, setEditingPairing] = useState(null); // key being edited
  const [pairingEditValue, setPairingEditValue] = useState('');

  const fetchAll = async () => {
    try {
      const res = await api.get('/dropdown-options/all');
      setAllOptions(res.data);
    } catch {
      toast.error('Failed to load dropdown options');
    } finally {
      setLoading(false);
    }
  };

  const fetchShapeMap = async () => {
    try {
      const res = await api.get('/dropdown-options/shape-map');
      setShapeMap(res.data || {});
    } catch {}
  };

  const fetchSizeSieveMap = async () => {
    try {
      const res = await api.get('/dropdown-options/size-sieve-map');
      setSizeSieveMap(res.data || {});
    } catch {}
  };

  useEffect(() => { fetchAll(); fetchShapeMap(); fetchSizeSieveMap(); }, []);

  const values = allOptions[activeField] || [];

  const handleRename = async () => {
    const newVal = editText.trim();
    if (!newVal || newVal === editingValue) {
      setEditingValue(null);
      return;
    }
    try {
      const res = await api.put('/dropdown-options/rename', {
        field_name: activeField,
        old_value: editingValue,
        new_value: newVal,
      });
      const updated = res.data.updated_tables || {};
      const total = Object.values(updated).reduce((s, v) => s + v, 0);
      toast.success(total > 0
        ? `Renamed "${editingValue}" to "${newVal}" across ${total} record(s)`
        : `Renamed "${editingValue}" to "${newVal}"`
      );
      setEditingValue(null);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Rename failed');
    }
  };

  const handleDelete = async (value) => {
    // First check usage
    try {
      const res = await api.get(`/dropdown-options/usage/${activeField}`, { params: { value } });
      if (res.data.total > 0) {
        setUsageInfo({ value, usage: res.data.usage, total: res.data.total });
        return;
      }
    } catch {
      toast.error('Failed to check usage');
      return;
    }

    if (!confirm(`Delete "${value}" from ${FIELD_LABELS[activeField]}?`)) return;

    try {
      await api.delete(`/dropdown-options/${activeField}/${encodeURIComponent(value)}`);
      toast.success(`Deleted "${value}"`);
      fetchAll();
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (detail?.usage) {
        setUsageInfo({ value, usage: detail.usage, total: Object.values(detail.usage).reduce((s, v) => s + v, 0) });
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Delete failed');
      }
    }
  };

  const handleAdd = async () => {
    const val = addText.trim();
    if (!val) return;
    try {
      await api.post(`/dropdown-options/${activeField}`, { value: val });
      // If adding a shape, also save the stock group mapping
      if (activeField === 'shape' && addShapeStockGroup.trim()) {
        await api.post('/dropdown-options/shape-map', {
          shape: val,
          stock_group: addShapeStockGroup.trim(),
        });
      }
      toast.success(`Added "${val}"`);
      setAddText('');
      setAddShapeStockGroup('');
      setAdding(false);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Dropdown Options</h1>

      <div className="flex gap-6">
        {/* Left: field tabs */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {FIELDS.map((f) => (
            <button
              key={f}
              onClick={() => { setActiveField(f); setEditingValue(null); setAdding(false); setAddShapeStockGroup(''); }}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeField === f
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {FIELD_LABELS[f]}
              <span className="ml-2 text-xs opacity-70">({(allOptions[f] || []).length})</span>
            </button>
          ))}
        </div>

        {/* Right: values list */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">{FIELD_LABELS[activeField]} Values</h2>
            <button
              onClick={() => { setAdding(true); setAddText(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {values.map((val, i) => (
              <div key={`${val}-${i}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 group">
                {editingValue === val ? (
                  <>
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingValue(null); }}
                      className="flex-1 px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleRename} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingValue(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-800">{val}</span>
                    <button
                      onClick={() => { setEditingValue(val); setEditText(val); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(val)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {values.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No values configured</div>
            )}

            {/* Add row */}
            {adding && (
              <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 flex-wrap">
                <input
                  autoFocus
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setAddShapeStockGroup(''); } }}
                  placeholder={`New ${FIELD_LABELS[activeField]} value...`}
                  className="flex-1 min-w-[140px] px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {activeField === 'shape' && (
                  <select
                    value={addShapeStockGroup}
                    onChange={(e) => setAddShapeStockGroup(e.target.value)}
                    className="px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    title="Stock Group for this shape"
                  >
                    <option value="">Stock Group...</option>
                    {(allOptions['stock_group'] || []).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
                <button onClick={handleAdd} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setAdding(false); setAddShapeStockGroup(''); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shape → Stock Group pairing panel */}
      {activeField === 'shape' && (
        <PairingPanel
          title="Shape → Stock Group Pairings"
          subtitle="edit how each shape auto-fills the stock group"
          pairings={shapeMap}
          editingKey={editingPairing}
          editValue={pairingEditValue}
          onEditStart={(key, val) => { setEditingPairing(key); setPairingEditValue(val); }}
          onEditCancel={() => setEditingPairing(null)}
          onEditSave={async (key, newVal) => {
            try {
              await api.post('/dropdown-options/shape-map', { shape: key, stock_group: newVal });
              toast.success(`"${key}" → "${newVal}" saved`);
              setShapeMap((p) => ({ ...p, [key]: newVal }));
            } catch { toast.error('Failed to save pairing'); }
            setEditingPairing(null);
          }}
          onValueChange={setPairingEditValue}
          valueOptions={allOptions['stock_group'] || []}
          valueLabel="Stock Group"
        />
      )}

      {/* Size → Sieve pairing panel */}
      {(activeField === 'size' || activeField === 'sieve') && (
        <PairingPanel
          title="Size → Sieve Pairings"
          subtitle="edit how each size auto-fills the sieve/mm"
          pairings={sizeSieveMap}
          editingKey={editingPairing}
          editValue={pairingEditValue}
          onEditStart={(key, val) => { setEditingPairing(key); setPairingEditValue(val); }}
          onEditCancel={() => setEditingPairing(null)}
          onEditSave={async (key, newVal) => {
            try {
              await api.post('/dropdown-options/size-sieve-map', { size: key, sieve: newVal });
              toast.success(`"${key}" → "${newVal}" saved`);
              setSizeSieveMap((p) => ({ ...p, [key]: newVal }));
            } catch { toast.error('Failed to save pairing'); }
            setEditingPairing(null);
          }}
          onValueChange={setPairingEditValue}
          valueOptions={allOptions['sieve'] || []}
          valueLabel="Sieve/MM"
        />
      )}

      {/* Usage dialog */}
      {usageInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">Cannot Delete</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">"{usageInfo.value}"</span> is used in{' '}
              <span className="font-medium">{usageInfo.total}</span> record(s) across the following tables.
              Use <span className="font-medium">Rename</span> instead to correct spelling.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-5 space-y-1.5">
              {Object.entries(usageInfo.usage).map(([table, count]) => (
                <div key={table} className="flex justify-between text-sm">
                  <span className="text-gray-600">{table.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-gray-800">{count} row(s)</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setUsageInfo(null)}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
