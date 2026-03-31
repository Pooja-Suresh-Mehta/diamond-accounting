export default function ListPageControls({
  search,
  onSearchChange,
  rowLimit,
  onRowLimitChange,
  page,
  totalPages,
  onPageChange,
  pageOptions = [100, 500, 1000, 1500],
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 7);
  return (
    <>
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show</span>
          <select value={rowLimit} onChange={(e) => onRowLimitChange(Number(e.target.value))} className="px-2 py-1.5 text-sm border border-gray-300 rounded-md">
            {pageOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-sm text-gray-600">entries</span>
        </div>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button disabled={page === 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50">Previous</button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPageChange(p)} className={`px-3 py-1.5 text-sm rounded border ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>{p}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50">Next</button>
      </div>
    </>
  );
}
