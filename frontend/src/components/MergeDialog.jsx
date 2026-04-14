import { GitMerge, XCircle } from 'lucide-react';

const IDENTITY_LABELS = {
  lot_no: 'LotNo',
  shape: 'Shape',
  color: 'Color',
  clarity: 'Clarity',
  size: 'Size',
  sieve_mm: 'Sieve/MM',
  stock_group_id: 'Stock Group',
  stock_type: 'Stock Type',
  stock_subtype: 'Stock SubType',
  grown_process_type: 'Grown/Process Type',
};

const NUMERIC_ROWS = [
  { key: 'opening_weight_carats', label: 'Opening Weight (ct)', note: 'added' },
  { key: 'purchase_price', label: 'Purchase Price', note: 'weighted avg' },
  { key: 'purchase_cost_inr_amount', label: 'Cost INR Amount', note: 'added', inr: true },
  { key: 'purchase_cost_inr_carat', label: 'Cost INR/Carat', note: 'recalculated', inr: true },
  { key: 'purchase_cost_usd_amount', label: 'Cost USD Amount', note: 'added', usd: true },
  { key: 'purchase_cost_usd_carat', label: 'Cost USD/Carat', note: 'recalculated', usd: true },
  { key: 'asking_inr_amount', label: 'Asking INR Amount', note: 'added', inr: true },
  { key: 'asking_price_inr_carats', label: 'Asking INR/Carat', note: 'recalculated', inr: true },
  { key: 'asking_usd_amount', label: 'Asking USD Amount', note: 'added', usd: true },
  { key: 'asking_price_usd_carats', label: 'Asking USD/Carat', note: 'recalculated', usd: true },
];

function fmt(val) {
  const n = Number(val || 0);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function NoteTag({ note, inr, usd }) {
  if (inr) return <span className="ml-1 text-xs text-amber-600 font-medium">INR</span>;
  if (usd) return <span className="ml-1 text-xs text-emerald-600 font-medium">USD</span>;
  return null;
}

export default function MergeDialog({ existing, newEntry, mergedPreview, onMerge, onDiscard }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-orange-100 bg-orange-50 flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <GitMerge className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Similar Entry Found</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              An existing parcel matches all classification fields of the entry you're adding.
              You can <span className="font-medium text-orange-700">merge</span> the values or{' '}
              <span className="font-medium text-gray-600">discard</span> your new entry.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Matching identity fields */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Matching Fields</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(IDENTITY_LABELS).map(([key, label]) => {
                const val = existing[key] || newEntry[key];
                if (!val) return null;
                return (
                  <span key={key} className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                    {label}: {val}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Numeric comparison table */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Value Comparison</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-4 py-2.5 font-semibold w-[30%]">Field</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Existing</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-blue-600">New Entry</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-emerald-700 bg-emerald-50">Merged Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {NUMERIC_ROWS.map(({ key, label, note, inr, usd }, i) => {
                    const existingVal = existing[key];
                    const newVal = newEntry[key];
                    const mergedVal = mergedPreview[key];
                    const changed = Number(mergedVal) !== Number(existingVal);
                    return (
                      <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                        <td className="px-4 py-2 text-gray-700 font-medium">
                          {label}
                          <NoteTag note={note} inr={inr} usd={usd} />
                          <span className="ml-1.5 text-xs text-gray-400 font-normal">({note})</span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 tabular-nums">{fmt(existingVal)}</td>
                        <td className="px-4 py-2 text-right text-blue-700 tabular-nums font-medium">{fmt(newVal)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums font-semibold bg-emerald-50 ${changed ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {fmt(mergedVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Existing LotNo <span className="font-medium text-gray-600">{existing.lot_no}</span> will be updated. Your new entry's lot number will not be created.
            </p>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onDiscard}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Discard New Entry
          </button>
          <button
            onClick={onMerge}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            <GitMerge className="w-4 h-4" />
            Merge with Existing
          </button>
        </div>

      </div>
    </div>
  );
}
