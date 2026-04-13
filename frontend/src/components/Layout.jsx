import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, Search, LogOut, Diamond, Menu, X, BookOpenText, FolderTree, ChevronDown, ChevronRight, Moon, Sun, Boxes, Banknote, BarChart2, Wrench, Users, HardDrive, ListChecks, Power } from 'lucide-react';
import { useEffect, useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/stock-search', icon: Search, label: 'Stock Search' },
];

const PARCEL_REPORT_TABS = [
  { tab: 'stock', label: 'Stock Report' },
  { tab: 'purchases', label: 'Purchase Report' },
  { tab: 'memo-out', label: 'Memo Out Report' },
  { tab: 'sales', label: 'Sale Report' },
  { tab: 'consignments', label: 'Consignment Report' },
  { tab: 'stock-history', label: 'Stock History Report' },
  { tab: 'purchase-returns', label: 'Purchase Return Report' },
  { tab: 'sale-returns', label: 'Sale Return Report' },
  { tab: 'memo-out-returns', label: 'Memo Return Report' },
  { tab: 'consignment-returns', label: 'Consignment Return Report' },
];

function ParcelReportLinks({ onNav }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isReportPage = location.pathname === '/reports/parcel';
  const currentTab = isReportPage ? (new URLSearchParams(location.search).get('tab') || 'stock') : null;

  return (
    <div className="ml-4 space-y-1">
      {PARCEL_REPORT_TABS.map((item) => {
        const active = currentTab === item.tab;
        return (
          <button
            key={item.tab}
            onClick={() => { navigate(`/reports/parcel?tab=${item.tab}`); onNav(); }}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(true);
  const [parcelOpen, setParcelOpen] = useState(true);
  const [parcelTxnOpen, setParcelTxnOpen] = useState(true);
  const [parcelRptOpen, setParcelRptOpen] = useState(false);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleShutdown = async () => {
    if (!window.confirm('Are you sure? This will close the entire application.')) {
      return;
    }

    try {
      await fetch('/api/shutdown', { method: 'POST' });
    } catch {
      // fetch will throw when the server closes the connection — that's expected
    }
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f9fafb;color:#374151;">
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">Application closed</h1>
        <p style="color:#6b7280;">You can close this browser tab.</p>
      </div>`;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-200 flex flex-col
        lg:translate-x-0 lg:static lg:inset-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700 flex-shrink-0">
          <Diamond className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold">Diamond Accounting</h1>
            <p className="text-xs text-gray-400">{user?.company_name}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto mt-4 px-3 space-y-1 pb-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMastersOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <FolderTree className="w-5 h-5" />
            <span className="flex-1 text-left">Masters</span>
            {mastersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {mastersOpen && (
            <div className="ml-4 space-y-1">
              <NavLink
                to="/account-master"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
              >
                <BookOpenText className="w-4 h-4" />
                Account Master
              </NavLink>
              <NavLink
                to="/parcel-master"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
              >
                <BookOpenText className="w-4 h-4" />
                Parcel Masters
              </NavLink>
            </div>
          )}
          <button
            type="button"
            onClick={() => setParcelOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <Boxes className="w-5 h-5" />
            <span className="flex-1 text-left">Parcel</span>
            {parcelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {parcelOpen && (
            <div className="ml-4 space-y-1">
              <button
                type="button"
                onClick={() => setParcelTxnOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <BookOpenText className="w-4 h-4" />
                <span className="flex-1 text-left">Parcel Transactions</span>
                {parcelTxnOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {parcelTxnOpen && (
                <div className="ml-4 space-y-1">
                  {[
                    { to: '/parcel/purchase', label: 'Purchase' },
                    { to: '/parcel/purchase-return', label: 'Purchase Return' },
                    { to: '/parcel/consignment-in', label: 'Consignment In' },
                    { to: '/parcel/consignment-in-return', label: 'Consignment In Return' },
                    { to: '/parcel/memo-out', label: 'Memo Out' },
                    { to: '/parcel/memo-out-return', label: 'Memo Out Return' },
                    { to: '/parcel/sale', label: 'Sale' },
                    { to: '/parcel/sale-return', label: 'Sale Return' },
                  ].map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setParcelRptOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <BarChart2 className="w-4 h-4" />
                <span className="flex-1 text-left">Parcel Reports</span>
                {parcelRptOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {parcelRptOpen && (
                <ParcelReportLinks onNav={() => setSidebarOpen(false)} />
              )}
            </div>
          )}

          {/* Financial Transactions */}
          <button
            type="button"
            onClick={() => setFinancialOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <Banknote className="w-5 h-5" />
            <span className="flex-1 text-left">Financial</span>
            {financialOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {financialOpen && (
            <div className="ml-4 space-y-1">
              {[
                { to: '/financial/loan-given',       label: 'Loan Given' },
                { to: '/financial/loan-taken',       label: 'Loan Taken' },
                { to: '/financial/payment-receipts', label: 'Payment / Receipt' },
                { to: '/financial/payment-exdiff',   label: 'Payment With Ex.Diff' },
                { to: '/financial/journal-entries',  label: 'JV & Expenses' },
                { to: '/financial/income-expense',   label: 'Income / Expense' },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Reports */}
          <button
            type="button"
            onClick={() => setReportsOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <BarChart2 className="w-5 h-5" />
            <span className="flex-1 text-left">Reports</span>
            {reportsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {reportsOpen && (
            <div className="ml-4 space-y-1">
              <NavLink
                to="/reports/financial"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
              >
                Financial Reports
              </NavLink>
            </div>
          )}

          {/* Utilities */}
          <NavLink
            to="/utilities"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <Wrench className="w-5 h-5" />
            Utilities
          </NavLink>

          {/* Manage Dropdowns */}
          <NavLink
            to="/dropdown-options"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <ListChecks className="w-5 h-5" />
            Manage Dropdowns
          </NavLink>

          {/* Backup & Restore */}
          <NavLink
            to="/backup"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            <HardDrive className="w-5 h-5" />
            Backup & Restore
          </NavLink>

          {/* Admin: User Management */}
          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
            >
              <Users className="w-5 h-5" />
              Users
            </NavLink>
          )}
        </nav>

        <div className="flex-shrink-0 p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:px-6">
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={handleShutdown}
              className="p-2 rounded-lg border border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700"
              title="Shut down the application"
            >
              <Power className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm text-gray-500">Welcome, {user?.full_name || user?.username}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
