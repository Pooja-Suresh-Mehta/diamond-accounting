import { NavLink, Outlet } from 'react-router-dom';

const txnTabs = [
  { to: '/parcel/purchase', label: 'Purchase' },
  { to: '/parcel/purchase-return', label: 'Purchase Return' },
  { to: '/parcel/consignment-in', label: 'Consignment In' },
  { to: '/parcel/consignment-in-return', label: 'Consignment In Return' },
  { to: '/parcel/memo-out', label: 'Memo Out' },
  { to: '/parcel/memo-out-return', label: 'Memo Out Return' },
  { to: '/parcel/sale', label: 'Sale' },
  { to: '/parcel/sale-return', label: 'Sale Return' },
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
        <NavLink to="/parcel/purchase" className={({ isActive }) => `px-4 py-2 text-sm border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Parcel Transactions</NavLink>
        <NavLink to="/parcel/reports" className={({ isActive }) => `px-4 py-2 text-sm border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>Parcel Reports</NavLink>
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
