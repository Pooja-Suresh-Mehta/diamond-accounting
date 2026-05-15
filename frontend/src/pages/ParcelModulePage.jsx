import { NavLink, Outlet } from 'react-router-dom';

const txnTabs = [
  { to: '/parcel-transaction/purchase', label: 'Purchase' },
  { to: '/parcel-transaction/purchase-return', label: 'Purchase Return' },
  { to: '/parcel-transaction/consignment-in', label: 'Consignment In' },
  { to: '/parcel-transaction/consignment-in-return', label: 'Consignment In Return' },
  { to: '/parcel-transaction/memo-out', label: 'Memo Out' },
  { to: '/parcel-transaction/memo-out-return', label: 'Memo Out Return' },
  { to: '/parcel-transaction/sale', label: 'Sale' },
  { to: '/parcel-transaction/sale-return', label: 'Sale Return' },
];

export function ParcelReportsPage() {
  return <div className="bg-white rounded-xl border border-gray-100 p-6 text-gray-600">Parcel Reports coming soon.</div>;
}

export function ParcelTxnPlaceholder({ title }) {
  return <div className="bg-white rounded-xl border border-gray-100 p-6 text-gray-600">{title} coming soon.</div>;
}

export default function ParcelModulePage() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        <NavLink to="/parcel-transaction/purchase" className={({ isActive }) => `px-4 py-2 text-sm border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Parcel Transactions</NavLink>
        <NavLink to="/parcel-transaction/reports" className={({ isActive }) => `px-4 py-2 text-sm border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Parcel Reports</NavLink>
      </div>
      <div className="flex flex-wrap gap-2">
        {txnTabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `px-3 py-1.5 text-xs rounded border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'}`}>{t.label}</NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
