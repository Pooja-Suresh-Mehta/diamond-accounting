import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StockSearchPage from './pages/StockSearchPage';
import AccountMasterPage from './pages/AccountMasterPage';
import ParcelMasterPage from './pages/ParcelMasterPage';
import PurchasePage from './pages/PurchasePage';
import PurchaseReturnPage from './pages/PurchaseReturnPage';
import MemoOutPage from './pages/MemoOutPage';
import MemoOutReturnPage from './pages/MemoOutReturnPage';
import SalePage from './pages/SalePage';
import SaleReturnPage from './pages/SaleReturnPage';
import ConsignmentPage from './pages/ConsignmentPage';
import ConsignmentReturnPage from './pages/ConsignmentReturnPage';
import LoanPage from './pages/LoanPage';
import PaymentReceiptsPage from './pages/PaymentReceiptsPage';
import PaymentExDiffPage from './pages/PaymentExDiffPage';
import JournalEntriesPage from './pages/JournalEntriesPage';
import IncomeExpensePage from './pages/IncomeExpensePage';
import ParcelReportsHub from './pages/reports/ParcelReportsHub';
import FinancialReportsHub from './pages/reports/FinancialReportsHub';
import UtilitiesPage from './pages/UtilitiesPage';
import ParcelModulePage from './pages/ParcelModulePage';
import UsersPage from './pages/UsersPage';
import Layout from './components/Layout';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '', stack: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown runtime error' };
  }

  componentDidCatch(error, info) {
    // Keep minimal console trace for debugging runtime crashes.
    console.error('App crashed:', error);
    this.setState({ stack: info?.componentStack || '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md w-full text-center">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-2">{this.state.message}</p>
            {this.state.stack ? (
              <pre className="text-xs text-left bg-red-50 border border-red-100 rounded p-2 max-h-40 overflow-auto mb-3">{this.state.stack}</pre>
            ) : (
              <p className="text-sm text-gray-600 mb-4">Please refresh once. If it persists, go back to Dashboard and try again.</p>
            )}
            <button onClick={() => window.location.assign('/')} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md">Go to Dashboard</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="stock-search" element={<StockSearchPage />} />
        <Route path="account-master" element={<AccountMasterPage />} />
        <Route path="account-master/add" element={<AccountMasterPage />} />
        <Route path="account-master/edit/:id" element={<AccountMasterPage />} />
        <Route path="parcel-master" element={<ParcelMasterPage />} />
        <Route path="parcel-master/add" element={<ParcelMasterPage />} />
        <Route path="parcel-master/edit/:id" element={<ParcelMasterPage />} />
        <Route path="parcel" element={<ParcelModulePage />}>
          <Route path="purchase" element={<PurchasePage />} />
          <Route path="purchase/add" element={<PurchasePage />} />
          <Route path="purchase/edit/:id" element={<PurchasePage />} />
          <Route path="purchase-return" element={<PurchaseReturnPage />} />
          <Route path="purchase-return/add" element={<PurchaseReturnPage />} />
          <Route path="purchase-return/edit/:id" element={<PurchaseReturnPage />} />
          <Route path="consignment-in" element={<ConsignmentPage />} />
          <Route path="consignment-in/add" element={<ConsignmentPage />} />
          <Route path="consignment-in/edit/:id" element={<ConsignmentPage />} />
          <Route path="consignment-in-return" element={<ConsignmentReturnPage />} />
          <Route path="consignment-in-return/add" element={<ConsignmentReturnPage />} />
          <Route path="consignment-in-return/edit/:id" element={<ConsignmentReturnPage />} />
          <Route path="memo-out" element={<MemoOutPage />} />
          <Route path="memo-out/add" element={<MemoOutPage />} />
          <Route path="memo-out/edit/:id" element={<MemoOutPage />} />
          <Route path="memo-out-return" element={<MemoOutReturnPage />} />
          <Route path="memo-out-return/add" element={<MemoOutReturnPage />} />
          <Route path="memo-out-return/edit/:id" element={<MemoOutReturnPage />} />
          <Route path="sale" element={<SalePage />} />
          <Route path="sale/add" element={<SalePage />} />
          <Route path="sale/edit/:id" element={<SalePage />} />
          <Route path="sale-return" element={<SaleReturnPage />} />
          <Route path="sale-return/add" element={<SaleReturnPage />} />
          <Route path="sale-return/edit/:id" element={<SaleReturnPage />} />
        </Route>

        {/* Financial Transactions */}
        <Route path="financial/loan-given" element={<LoanPage loanType="Given" />} />
        <Route path="financial/loan-given/add" element={<LoanPage loanType="Given" />} />
        <Route path="financial/loan-given/edit/:id" element={<LoanPage loanType="Given" />} />
        <Route path="financial/loan-taken" element={<LoanPage loanType="Taken" />} />
        <Route path="financial/loan-taken/add" element={<LoanPage loanType="Taken" />} />
        <Route path="financial/loan-taken/edit/:id" element={<LoanPage loanType="Taken" />} />
        <Route path="financial/payment-receipts" element={<PaymentReceiptsPage />} />
        <Route path="financial/payment-receipts/add" element={<PaymentReceiptsPage />} />
        <Route path="financial/payment-receipts/edit/:id" element={<PaymentReceiptsPage />} />
        <Route path="financial/payment-exdiff" element={<PaymentExDiffPage />} />
        <Route path="financial/payment-exdiff/add" element={<PaymentExDiffPage />} />
        <Route path="financial/payment-exdiff/edit/:id" element={<PaymentExDiffPage />} />
        <Route path="financial/journal-entries" element={<JournalEntriesPage />} />
        <Route path="financial/journal-entries/add" element={<JournalEntriesPage />} />
        <Route path="financial/journal-entries/edit/:id" element={<JournalEntriesPage />} />
        <Route path="financial/income-expense" element={<IncomeExpensePage />} />
        <Route path="financial/income-expense/add" element={<IncomeExpensePage />} />
        <Route path="financial/income-expense/edit/:id" element={<IncomeExpensePage />} />

        {/* Reports */}
        <Route path="reports/parcel" element={<ParcelReportsHub />} />
        <Route path="reports/financial" element={<FinancialReportsHub />} />

        {/* Utilities */}
        <Route path="utilities" element={<UtilitiesPage />} />

        {/* Admin: User Management */}
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" />
        </BrowserRouter>
      </AppErrorBoundary>
    </AuthProvider>
  );
}
