import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ParcelStockReport from './ParcelStockReport';
import ReportPage from './ReportPage';

const CURRENCIES = ['USD', 'INR', 'AED'];

const TABS = [
  { id: 'stock', label: '01 Stock' },
  { id: 'purchases', label: '02 Purchase' },
  { id: 'memo-out', label: '03 Memo Out' },
  { id: 'sales', label: '04 Sale' },
  { id: 'consignments', label: '05 Consignment' },
  { id: 'stock-history', label: '06 Stock History' },
  { id: 'purchase-returns', label: '07 Purchase Return' },
  { id: 'sale-returns', label: '08 Sale Return' },
  { id: 'memo-out-returns', label: '09 Memo Return' },
  { id: 'consignment-returns', label: '10 Con. Return' },
];

const STONE_FILTERS = [
  { key: 'shape', label: 'Shape', type: 'api-select', optionsKey: 'shapes' },
  { key: 'size', label: 'Size', type: 'api-select', optionsKey: 'sizes' },
  { key: 'color', label: 'Color', type: 'api-select', optionsKey: 'colors' },
  { key: 'clarity', label: 'Clarity', type: 'api-select', optionsKey: 'clarities' },
  { key: 'sieve', label: 'Sieve', type: 'api-select', optionsKey: 'sieves' },
];

const LOT_FILTER = { key: 'lot_no', label: 'Enter Lot No', type: 'api-select', optionsKey: 'lot_nos' };

const PURCHASE_SALE_FILTERS = [
  { key: 'from_date', label: 'Date', type: 'date' },
  { key: 'to_date', label: 'To Date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
  { key: 'inv_no', label: 'Invoice Number', type: 'text' },
  { key: 'party', label: 'Party', type: 'api-select', optionsKey: 'parties' },
  { key: 'broker', label: 'Broker', type: 'api-select', optionsKey: 'brokers' },
  ...STONE_FILTERS,
  LOT_FILTER,
];

const RETURN_FILTERS = [
  { key: 'from_date', label: 'Date', type: 'date' },
  { key: 'to_date', label: 'To Date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
  { key: 'inv_no', label: 'Invoice Number', type: 'text' },
  { key: 'party', label: 'Party', type: 'api-select', optionsKey: 'parties' },
  { key: 'broker', label: 'Broker', type: 'api-select', optionsKey: 'brokers' },
  ...STONE_FILTERS,
];

const STOCK_HISTORY_FILTERS = [
  { key: 'from_date', label: 'Date', type: 'date' },
  { key: 'to_date', label: 'To Date', type: 'date' },
  { key: 'party', label: 'Party', type: 'api-select', optionsKey: 'parties' },
  { key: 'lot_no', label: 'Lot No', type: 'api-select', optionsKey: 'lot_nos' },
];

const MEMO_CONSIGNMENT_RETURN_FILTERS = [
  { key: 'from_date', label: 'Date', type: 'date' },
  { key: 'to_date', label: 'To Date', type: 'date' },
  { key: 'party', label: 'Party', type: 'api-select', optionsKey: 'parties' },
  { key: 'lot_no', label: 'Lot No', type: 'api-select', optionsKey: 'lot_nos' },
];

function ReportForTab({ tab }) {
  switch (tab) {
    case 'stock':
      return <ParcelStockReport />;

    case 'purchases':
      return (
        <ReportPage title="Parcel Purchase Report" endpoint="/parcel-reports/purchases"
          filters={PURCHASE_SALE_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'party', label: 'Party' }, { key: 'lot_number', label: 'Lot #' },
            { key: 'shape', label: 'Shape' }, { key: 'color', label: 'Color' }, { key: 'clarity', label: 'Clarity' },
            { key: 'issue_carats', label: 'Issue Cts' }, { key: 'selected_carat', label: 'Sel. Cts' },
            { key: 'pcs', label: 'Pcs' }, { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
            { key: 'payment_status', label: 'Status' },
          ]}
          totalKeys={['selected_carat', 'amount']}
        />
      );

    case 'memo-out':
      return (
        <ReportPage title="Parcel Memo Out Report" endpoint="/parcel-reports/memo-out"
          filters={PURCHASE_SALE_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'party', label: 'Party' }, { key: 'lot_number', label: 'Lot #' },
            { key: 'item_name', label: 'Item' }, { key: 'weight', label: 'Weight' },
            { key: 'pcs', label: 'Pcs' }, { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
            { key: 'payment_status', label: 'Status' },
          ]}
          totalKeys={['weight', 'amount']}
        />
      );

    case 'sales':
      return (
        <ReportPage title="Parcel Sale Report" endpoint="/parcel-reports/sales"
          filters={PURCHASE_SALE_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'party', label: 'Party' }, { key: 'lot_number', label: 'Lot #' },
            { key: 'shape', label: 'Shape' }, { key: 'color', label: 'Color' }, { key: 'clarity', label: 'Clarity' },
            { key: 'selected_carat', label: 'Cts' }, { key: 'pcs', label: 'Pcs' },
            { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' }, { key: 'cogs', label: 'COGS' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
            { key: 'payment_status', label: 'Status' },
          ]}
          totalKeys={['selected_carat', 'amount']}
        />
      );

    case 'consignments':
      return (
        <ReportPage title="Parcel Consignment Report" endpoint="/parcel-reports/consignments"
          filters={PURCHASE_SALE_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'party', label: 'Party' }, { key: 'lot_number', label: 'Lot #' },
            { key: 'shape', label: 'Shape' }, { key: 'color', label: 'Color' }, { key: 'clarity', label: 'Clarity' },
            { key: 'selected_carat', label: 'Cts' }, { key: 'pcs', label: 'Pcs' },
            { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
          ]}
          totalKeys={['selected_carat', 'amount']}
        />
      );

    case 'stock-history':
      return (
        <ReportPage title="Parcel Stock History" endpoint="/parcel-reports/stock-history"
          filters={STOCK_HISTORY_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'transaction_type', label: 'Type' },
            { key: 'account_name', label: 'Account' }, { key: 'debit', label: 'Debit' },
            { key: 'credit', label: 'Credit' }, { key: 'narration', label: 'Narration' },
            { key: 'is_reversed', label: 'Reversed', format: v => v ? 'Yes' : '' },
          ]}
        />
      );

    case 'purchase-returns':
      return (
        <ReportPage title="Purchase Return Report" endpoint="/parcel-reports/purchase-returns"
          filters={RETURN_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'memo_number', label: 'Memo #' },
            { key: 'party', label: 'Party' }, { key: 'lot_number', label: 'Lot #' },
            { key: 'item_name', label: 'Item' }, { key: 'selected_carat', label: 'Cts' },
            { key: 'pcs', label: 'Pcs' }, { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
          ]}
          totalKeys={['selected_carat', 'amount']}
        />
      );

    case 'sale-returns':
      return (
        <ReportPage title="Sale Return Report" endpoint="/parcel-reports/sale-returns"
          filters={RETURN_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'party', label: 'Party' }, { key: 'lot_number', label: 'Lot #' },
            { key: 'item_name', label: 'Item' }, { key: 'selected_carat', label: 'Cts' },
            { key: 'pcs', label: 'Pcs' }, { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
          ]}
          totalKeys={['selected_carat', 'amount']}
        />
      );

    case 'memo-out-returns':
      return (
        <ReportPage title="Memo Out Return Report" endpoint="/parcel-reports/memo-out-returns"
          filters={MEMO_CONSIGNMENT_RETURN_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'source_memo_number', label: 'Source Memo' }, { key: 'party', label: 'Party' },
            { key: 'lot_number', label: 'Lot #' }, { key: 'item_name', label: 'Item' },
            { key: 'weight', label: 'Weight' }, { key: 'pcs', label: 'Pcs' },
            { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
          ]}
          totalKeys={['weight', 'amount']}
        />
      );

    case 'consignment-returns':
      return (
        <ReportPage title="Consignment Return Report" endpoint="/parcel-reports/consignment-returns"
          filters={MEMO_CONSIGNMENT_RETURN_FILTERS}
          columns={[
            { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
            { key: 'source_consignment_number', label: 'Source Consignment' }, { key: 'party', label: 'Party' },
            { key: 'lot_number', label: 'Lot #' }, { key: 'item_name', label: 'Item' },
            { key: 'selected_carat', label: 'Cts' }, { key: 'pcs', label: 'Pcs' },
            { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' },
            { key: 'inr_amt', label: 'INR Amt' }, { key: 'usd_amt', label: 'USD Amt' },
          ]}
          totalKeys={['selected_carat', 'amount']}
        />
      );

    default:
      return <p className="text-gray-400">Select a report tab</p>;
  }
}

export default function ParcelReportsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'stock');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS.some(tab => tab.id === t)) setActiveTab(t);
  }, [searchParams]);

  const switchTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)}
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
