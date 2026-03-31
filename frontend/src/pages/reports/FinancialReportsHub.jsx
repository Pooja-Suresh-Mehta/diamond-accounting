/**
 * Financial Reports Hub (17-28)
 * Standard reports use ReportPage; custom-structured reports use inline components.
 */
import { useState } from 'react';
import { Search } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import ReportPage from './ReportPage';

const CURRENCIES = ['USD', 'INR', 'AED'];
const TYPE_OPTIONS = ['LOCAL', 'IMPORT', 'EXPORT'];
const CATEGORY_OPTIONS = ['Natural Diamond', 'Lab Grown Diamond'];
const SUB_TYPE_OPTIONS = ['Rough', 'Polished'];
const LOAN_TYPE_OPTIONS = ['Given', 'Taken'];
const INVOICE_TYPE_OPTIONS = ['Purchase', 'Sale', 'Memo', 'Consignment'];

const TABS = [
  { id: 'outstanding',           label: '17 Outstanding' },
  { id: 'loan-outstanding',      label: '18 Loan Outstanding' },
  { id: 'brokerage-outstanding', label: '19 Brokerage Outst.' },
  { id: 'commission-outstanding',label: '20 Commission Outst.' },
  { id: 'sale-purchase-summary', label: '21 Sale/Purch. Summary' },
  { id: 'account-ledger',        label: '22 Account Ledger' },
  { id: 'monthly-expense',       label: '23 Monthly Expense' },
  { id: 'cash-flow',             label: '24 Cash Flow' },
  { id: 'profit-loss',           label: '25 P & L' },
  { id: 'trial-balance',         label: '26 Trial Balance' },
  { id: 'balance-sheet',         label: '27 Balance Sheet' },
  { id: 'invoice-ledger',        label: '28 Invoice Ledger' },
];

const DATE_FILTERS = [
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date',   label: 'To Date',   type: 'date' },
];

/* ── 21: Sale/Purchase Summary ────────────────────────── */

function SalePurchaseSummary() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '', currency: '', type: '', sub_type: '', category: '', party: '', broker: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/sale-purchase-summary', { params });
      setData(r.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sale / Purchase Summary</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Currency</label>
          <select value={filters.currency} onChange={e => setFilters(v => ({ ...v, currency: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Type</label>
          <select value={filters.type} onChange={e => setFilters(v => ({ ...v, type: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {TYPE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Sub Type</label>
          <select value={filters.sub_type} onChange={e => setFilters(v => ({ ...v, sub_type: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {SUB_TYPE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Category</label>
          <select value={filters.category} onChange={e => setFilters(v => ({ ...v, category: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Party</label>
          <input value={filters.party} onChange={e => setFilters(v => ({ ...v, party: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="Party name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Broker</label>
          <input value={filters.broker} onChange={e => setFilters(v => ({ ...v, broker: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="Broker name" />
        </div>
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales (USD)', value: data.total_sales_usd },
              { label: 'Total Sales (INR)', value: data.total_sales_inr },
              { label: 'Total Purchases (USD)', value: data.total_purchases_usd },
              { label: 'Total Purchases (INR)', value: data.total_purchases_inr },
              { label: 'Gross Profit (USD)', value: data.gross_profit_usd, highlight: true },
              { label: 'Gross Profit (INR)', value: data.gross_profit_inr, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`bg-white border rounded-lg p-4 ${highlight ? 'border-blue-200' : ''}`}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${highlight ? 'text-blue-600' : ''}`}>{(value || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: `Sales (${data.sales_count})`, rows: data.sales },
              { title: `Purchases (${data.purchases_count})`, rows: data.purchases },
            ].map(({ title, rows }) => (
              <div key={title} className="bg-white border rounded-lg overflow-x-auto">
                <div className="px-4 py-3 border-b font-medium text-sm">{title}</div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['Date', 'Invoice #', 'Party', 'Cts', 'USD', 'INR', 'Status'].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2">{r.invoice_number}</td>
                        <td className="px-3 py-2">{r.party}</td>
                        <td className="px-3 py-2">{r.total_carats}</td>
                        <td className="px-3 py-2">{(r.usd_amt || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{(r.inr_amt || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{r.payment_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 22: Account Ledger ───────────────────────────────── */

function AccountLedger() {
  const [filters, setFilters] = useState({ party: '', from_date: '', to_date: '', currency: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!filters.party) return toast.error('Account/party name is required');
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/account-ledger', { params });
      setData(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Account Ledger</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Account / Party *</label>
          <input value={filters.party} onChange={e => setFilters(v => ({ ...v, party: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" placeholder="Account name" />
        </div>
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Currency</label>
          <select value={filters.currency} onChange={e => setFilters(v => ({ ...v, currency: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Debit', value: data.total_debit },
              { label: 'Total Credit', value: data.total_credit },
              { label: 'Closing Balance', value: data.closing_balance, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`bg-white border rounded-lg p-4 ${highlight ? 'border-blue-200' : ''}`}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${highlight ? 'text-blue-600' : ''}`}>{(value || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Date', 'Type', 'Account', 'Debit', 'Credit', 'Narration'].map(h =>
                  <th key={h} className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {data.entries.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-8">No entries</td></tr>
                ) : data.entries.map((e, i) => (
                  <tr key={e.id || i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{e.date}</td>
                    <td className="px-3 py-2">{e.transaction_type}</td>
                    <td className="px-3 py-2">{e.account_name}</td>
                    <td className="px-3 py-2">{e.debit ? (e.debit).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2">{e.credit ? (e.credit).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{e.narration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 23: Monthly Expense ──────────────────────────────── */

function MonthlyExpense() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/monthly-expense', { params });
      setData(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Monthly Expense Report</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-gray-500">Grand Total (INR)</p>
              <p className="text-xl font-bold">{(data.grand_total_inr || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-gray-500">Grand Total (USD)</p>
              <p className="text-xl font-bold">{(data.grand_total_usd || 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Month</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">INR Total</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">USD Total</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">Account Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {(data.results || []).map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.month}</td>
                    <td className="px-3 py-2">{(r.total_inr || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{(r.total_usd || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {Object.entries(r.account_breakdown || {}).map(([acc, amt]) =>
                        `${acc}: ${Number(amt).toFixed(0)}`
                      ).join(' | ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 24: Cash Flow ────────────────────────────────────── */

function CashFlow() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/cash-flow', { params });
      setData(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const flowCols = ['Date', 'Main Account', 'Party Account', 'Currency', 'Amount', 'INR Amt', 'Narration'];
  const flowKeys = ['date', 'main_account', 'party_account', 'currency', 'amount', 'inr_amt', 'narration'];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Cash Flow Report</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Inflow (INR)', value: data.total_inflow_inr, color: 'text-green-600' },
              { label: 'Total Outflow (INR)', value: data.total_outflow_inr, color: 'text-red-600' },
              { label: 'Net Cash Flow (INR)', value: data.net_cash_flow_inr, color: data.net_cash_flow_inr >= 0 ? 'text-blue-600' : 'text-red-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border rounded-lg p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{(value || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
          {[
            { title: 'Inflows (Receipts)', rows: data.inflows, color: 'text-green-700' },
            { title: 'Outflows (Payments)', rows: data.outflows, color: 'text-red-700' },
          ].map(({ title, rows, color }) => (
            <div key={title} className="bg-white border rounded-lg overflow-x-auto">
              <div className={`px-4 py-3 border-b font-medium text-sm ${color}`}>{title}</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>{flowCols.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={flowCols.length} className="text-center text-gray-400 py-6">No records</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      {flowKeys.map(k => (
                        <td key={k} className="px-3 py-2 whitespace-nowrap">
                          {typeof r[k] === 'number' ? r[k].toFixed(2) : (r[k] || '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 25: Profit & Loss ────────────────────────────────── */

function ProfitLoss() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '', currency: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/profit-loss', { params });
      setData(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Profit & Loss</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Currency</label>
          <select value={filters.currency} onChange={e => setFilters(v => ({ ...v, currency: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>
      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold text-sm bg-green-50 text-green-800">Income</div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Sales (USD)', data.income.sales_usd],
                  ['Sales (INR)', data.income.sales_inr],
                  ['Other Income (INR)', data.income.other_income_inr],
                  ['Total Income (INR)', data.income.total_income_inr],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b">
                    <td className="px-4 py-2 text-gray-600">{label}</td>
                    <td className="px-4 py-2 text-right font-medium">{(value || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold text-sm bg-red-50 text-red-800">Expenses</div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Purchases (USD)', data.expenses.purchases_usd],
                  ['Purchases (INR)', data.expenses.purchases_inr],
                  ['Other Expenses (INR)', data.expenses.other_expense_inr],
                  ['Total Expenses (INR)', data.expenses.total_expense_inr],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b">
                    <td className="px-4 py-2 text-gray-600">{label}</td>
                    <td className="px-4 py-2 text-right font-medium">{(value || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:col-span-2 bg-white border rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Gross Profit (USD)', value: data.gross_profit_usd },
                { label: 'Gross Profit (INR)', value: data.gross_profit_inr },
                { label: 'Net Profit (INR)', value: data.net_profit_inr, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`text-center p-3 rounded-lg ${highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-2xl font-bold ${value >= 0 ? (highlight ? 'text-blue-600' : 'text-green-600') : 'text-red-600'}`}>
                    {(value || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 26: Trial Balance ────────────────────────────────── */

function TrialBalance() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/trial-balance', { params });
      setData(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Trial Balance</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>
      {data && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Account</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">Debit</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">Credit</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(data.results || []).map((r, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{r.account_name}</td>
                  <td className="px-3 py-2 text-right">{(r.total_debit || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{(r.total_credit || 0).toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {(r.balance || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t font-semibold">
              <tr>
                <td className="px-3 py-2">Totals</td>
                <td className="px-3 py-2 text-right">{(data.grand_total_debit || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{(data.grand_total_credit || 0).toFixed(2)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 27: Balance Sheet ────────────────────────────────── */

function BalanceSheet() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '', currency: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const r = await api.get('/financial-reports/balance-sheet', { params });
      setData(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Balance Sheet</h2>
      <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {DATE_FILTERS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input type="date" value={filters[f.key]} onChange={e => setFilters(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Currency</label>
          <select value={filters.currency} onChange={e => setFilters(v => ({ ...v, currency: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">All</option>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={search} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm w-full justify-center">
            <Search className="w-4 h-4" />{loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>
      {data && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: 'Assets', rows: data.assets, color: 'bg-green-50 text-green-800' },
              { title: 'Liabilities', rows: data.liabilities, color: 'bg-red-50 text-red-800' },
            ].map(({ title, rows, color }) => (
              <div key={title} className="bg-white border rounded-lg overflow-hidden">
                <div className={`px-4 py-3 border-b font-semibold text-sm ${color}`}>{title}</div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{r.account_name}</td>
                        <td className="px-3 py-2 text-right">{(r.balance || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Stock Value (USD)', value: data.stock_value_usd },
              { label: 'Total Assets', value: data.total_assets },
              { label: 'Total Liabilities', value: data.total_liabilities },
              { label: 'Net Worth', value: data.net_worth, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`bg-white border rounded-lg p-4 ${highlight ? 'border-blue-200' : ''}`}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${highlight ? 'text-blue-600' : ''}`}>{(value || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab Router ───────────────────────────────────────── */

function ReportForTab({ tab }) {
  switch (tab) {
    case 'outstanding':
      return (
        <ReportPage title="Outstanding Report" endpoint="/financial-reports/outstanding"
          filters={[
            ...DATE_FILTERS,
            { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
            { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
            { key: 'sub_type', label: 'Sub Type', type: 'select', options: SUB_TYPE_OPTIONS },
            { key: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS },
            { key: 'from_due_date', label: 'From Due Date', type: 'date' },
            { key: 'to_due_date', label: 'To Due Date', type: 'date' },
            { key: 'party', label: 'Party', type: 'text' },
            { key: 'comm_agent', label: 'Comm.Agent', type: 'text' },
            { key: 'broker', label: 'Broker', type: 'text' },
            { key: 'invoice_number', label: 'Invoice Number', type: 'text' },
            { key: 'bill_no', label: 'Bill No', type: 'text' },
            { key: 'display_currency', label: 'Display Currency', type: 'select', options: CURRENCIES },
            { key: 'summary', label: 'Summary', type: 'checkbox' },
            { key: 'show_past_invoice', label: 'Show Past Invoice', type: 'checkbox' },
            { key: 'payable_or_receivable', label: 'Payable/Receivable', type: 'select', options: ['Receivable', 'Payable'] },
          ]}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'due_date', label: 'Due Date' },
            { key: 'invoice_number', label: 'Invoice #' }, { key: 'trn_type', label: 'Type' },
            { key: 'party', label: 'Party' }, { key: 'currency', label: 'Currency' },
            { key: 'total_amount', label: 'Amount' }, { key: 'remaining_amount', label: 'Remaining' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'payment_status', label: 'Status' }, { key: 'broker', label: 'Broker' },
          ]}
          totalKeys={['total_amount', 'remaining_amount']}
        />
      );

    case 'loan-outstanding':
      return (
        <ReportPage title="Loan Outstanding" endpoint="/financial-reports/loan-outstanding"
          filters={[
            ...DATE_FILTERS,
            { key: 'party', label: 'Party', type: 'text' },
            { key: 'loan_type', label: 'Loan Type', type: 'select', options: LOAN_TYPE_OPTIONS },
            { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
          ]}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'loan_type', label: 'Type' },
            { key: 'party', label: 'Party' }, { key: 'from_account', label: 'From' }, { key: 'to_account', label: 'To' },
            { key: 'currency', label: 'Currency' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
            { key: 'narration', label: 'Narration' },
          ]}
          totalKeys={['amount']}
        />
      );

    case 'brokerage-outstanding':
      return (
        <ReportPage title="Brokerage Outstanding" endpoint="/financial-reports/brokerage-outstanding"
          filters={[
            ...DATE_FILTERS,
            { key: 'party', label: 'Broker', type: 'text' },
            { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
          ]}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'trn_type', label: 'Type' }, { key: 'broker', label: 'Broker' },
            { key: 'bro_pct', label: 'Bro %' }, { key: 'bro_amount', label: 'Bro Amt' },
            { key: 'currency', label: 'Currency' },
          ]}
          totalKeys={['bro_amount']}
        />
      );

    case 'commission-outstanding':
      return (
        <ReportPage title="Commission Outstanding" endpoint="/financial-reports/commission-outstanding"
          filters={[
            ...DATE_FILTERS,
            { key: 'party', label: 'Comm.Agent', type: 'text' },
            { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
          ]}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'trn_type', label: 'Type' }, { key: 'agent', label: 'Agent' },
            { key: 'com_pct', label: 'Com %' }, { key: 'com_amount', label: 'Com Amt' },
            { key: 'currency', label: 'Currency' },
          ]}
          totalKeys={['com_amount']}
        />
      );

    case 'sale-purchase-summary': return <SalePurchaseSummary />;
    case 'account-ledger':        return <AccountLedger />;
    case 'monthly-expense':       return <MonthlyExpense />;
    case 'cash-flow':             return <CashFlow />;
    case 'profit-loss':           return <ProfitLoss />;
    case 'trial-balance':         return <TrialBalance />;
    case 'balance-sheet':         return <BalanceSheet />;

    case 'invoice-ledger':
      return (
        <ReportPage title="Invoice Ledger" endpoint="/financial-reports/invoice-ledger"
          filters={[
            ...DATE_FILTERS,
            { key: 'party', label: 'Party', type: 'text' },
            { key: 'trn_type', label: 'Invoice Type', type: 'select', options: INVOICE_TYPE_OPTIONS },
          ]}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'trn_type', label: 'Type' }, { key: 'party', label: 'Party' },
            { key: 'total_carats', label: 'Cts' }, { key: 'usd_amt', label: 'USD Amt' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'payment_status', label: 'Status' },
            { key: 'currency', label: 'Currency' },
          ]}
          totalKeys={['usd_amt', 'inr_amt']}
        />
      );

    default:
      return <p className="text-gray-400">Select a report tab</p>;
  }
}

export default function FinancialReportsHub() {
  const [activeTab, setActiveTab] = useState('outstanding');

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
      <ReportForTab tab={activeTab} />
    </div>
  );
}
