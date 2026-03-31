# Reference vs Local App — Full Comparison Report

Generated automatically by Playwright scraping.

- **Reference app**: https://mvc.softsense.in (SoftOnCloud)
- **Local app**: http://localhost:5174 (Poojan Gems)
- Reference pages discovered: 57
- Local pages discovered: 10

---
## 1. Sidebar / Navigation Structure

### Reference App Sidebar:
  - 13
  - Settings
  - Parameters
  - Role
  - User
  - Sync
  - Parcel Dashboard

**Masters** (section)
  - Parcel Master
  - Account Group Master
  - Purchase
  - Purchase Return
  - Consignment In
  - Consignment In Return
  - Memo Out
  - Memo Out Return
  - Sale
  - Sale Return
  - Parcel Stock Report
  - Parcel Purchase Report
  - Parcel Memo Out Report
  - Parcel Sale Report
  - Parcel Consignment Report
  - Parcel Stock History Report
  - Parcel Purchase Return Report
  - Parcel Sale Return Report
  - Parcel Memo Out Return Report
  - Parcel Consignment Return Report
  - Loan Given
  - Loan Taken
  - Payment & Receipts
  - Payment & Receipts With Ex. Diff
  - Journal Entries
  - Income Expense
  - Outstanding Report
  - Loan Outstanding Report
  - Brokerage Outstanding Report
  - Commission Outstanding Report
  - Sale Purchase Summary Report
  - Account Ledger
  - Monthly Expense Report
  - Cash Flow Report
  - Profit & Loss Report
  - Trial Balance Sheet
  - Balance Sheet
  - Invoice Ledger Report
  - Download MRP
  - Import Grading
  - Import Solitaire Price
  - Get LAB Data
  - Stock Transfer
  - Convert Excel Utility
  - Stock Telly
  - Parcel Stock Analysis
  - Parcel Sale Analysis
  - Parcel Purchase Analysis
  - SoftOnCloud

### Local App Sidebar:
  - Dashboard -> `/`
  - Stock Search -> `/stock-search`
  - Loan Given -> `/financial/loan-given`
  - Loan Taken -> `/financial/loan-taken`
  - Payment / Receipt -> `/financial/payment-receipts`
  - Journal Entries -> `/financial/journal-entries`
  - Income / Expense -> `/financial/income-expense`
  - Parcel Reports -> `/reports/parcel`
  - Financial Reports -> `/reports/financial`
  - Utilities -> `/utilities`

---
## 2. Page-by-Page Comparison

For each page, comparing: field count, field labels, dropdowns, tabs.


### Dashboard
| | Reference | Local |
|---|---|---|
| Page | Parcel Dashboard | Dashboard |
| Fields | 0 | 0 |

Ref dropdowns (1): FilterDate

### Parcel Master
| | Reference | Local |
|---|---|---|
| Page | Parcel Master | Parcel Masters |
| Fields | 12 | 0 |

**Missing in local** (2):
  - `Search Menu...`
  - `item-list-datatable_length`

Ref dropdowns (1): item-list-datatable_length

### Account Master
| | Reference | Local |
|---|---|---|
| Page | Account Group Master | Account Master |
| Fields | 17 | 0 |

**Missing in local** (2):
  - `Search Menu...`
  - `account-list-datatable_length`

Ref dropdowns (1): account-list-datatable_length

### Parcel Purchase
| | Reference | Local |
|---|---|---|
| Page | Purchase | Purchase (Add Form) |
| Fields | 29 | 49 |

**Missing in local** (2):
  - `Search Menu...`
  - `purchaseparcel-list_length`

Extra in local (35):
  - `$Rate`
  - `Amount`
  - `Bill No`
  - `Bro %`
  - `Bro Amount`
  - `Broker`
  - `Category`
  - `Clarity`
  - `Color`
  - `Com %`
  - `Com Amount`
  - `Comm.Agent`
  - `Consignment No`
  - `Currency`
  - `Date`
  - `Description`
  - `Due Date`
  - `Due Days`
  - `INR *`
  - `Invoice Number`
  - `Issue Carats *`
  - `Item Name`
  - `Lot Number`
  - `Party`
  - `Pcs`
  - `Rate *`
  - `Reje%`
  - `Rejection`
  - `Selected Carat`
  - `Shape`
  - `Sieve`
  - `Size`
  - `Sub Type`
  - `Type`
  - `USD /`

Ref dropdowns (8): Broker, Clarity, Color, Currency, Party, Shape, Sieve, Size
Local dropdowns (8): sel_0, sel_1, sel_2, sel_3, sel_4, sel_5, sel_6, sel_7

### Purchase Return
| | Reference | Local |
|---|---|---|
| Page | Purchase Return | Purchase Return (Add Form) |
| Fields | 18 | 50 |

**Missing in local** (4):
  - `Invoice Number`
  - `Search Menu...`
  - `Search by lot no`
  - `To Date`

Extra in local (26):
  - `$Rate`
  - `Amount`
  - `Bro %`
  - `Bro Amount`
  - `Category`
  - `Com %`
  - `Com Amount`
  - `Comm.Agent`
  - `Description`
  - `Due Date`
  - `Due Days`
  - `INR *`
  - `Inv/Bill No`
  - `Issue Carats *`
  - `Item Name`
  - `Lot Number`
  - `Memo Number`
  - `Pcs`
  - `Print Date`
  - `Rate *`
  - `Reje%`
  - `Rejection`
  - `Selected Carat`
  - `Sub Type`
  - `Type`
  - `USD /`

Ref dropdowns (1): purparreturn-list_length
Local dropdowns (8): sel_0, sel_1, sel_2, sel_3, sel_4, sel_5, sel_6, sel_7

### Consignment In
| | Reference | Local |
|---|---|---|
| Page | Consignment In | Consignment In (Add Form) |
| Fields | 7 | 2 |

**Missing in local** (7):
  - `Bill No`
  - `Consignment No`
  - `Date`
  - `Enter Lot No`
  - `Party`
  - `Search Menu...`
  - `Type`

Extra in local (1):
  - `Search...`

Ref dropdowns (1): consignmentparcel-list_length
Local dropdowns (1): sel_0

### Consignment In Return
| | Reference | Local |
|---|---|---|
| Page | Consignment In Return | Consignment In Return (Add Form) |
| Fields | 7 | 2 |

**Missing in local** (7):
  - `Bill No`
  - `Consignment No`
  - `Date`
  - `Enter Lot No`
  - `Party`
  - `Search Menu...`
  - `Type`

Extra in local (1):
  - `Search...`

Ref dropdowns (2): Party, Show
Local dropdowns (1): sel_0

### Memo Out
| | Reference | Local |
|---|---|---|
| Page | Memo Out | Memo Out (Add Form) |
| Fields | 9 | 33 |

**Missing in local** (5):
  - `Broker`
  - `Memo Number`
  - `Search Menu...`
  - `Search by lot no`
  - `To Date`

Extra in local (16):
  - `$Rate`
  - `0.00`
  - `Amount`
  - `Category`
  - `Due Date`
  - `Due Days`
  - `INR *`
  - `Invoice Number`
  - `Item Name`
  - `Lot Number`
  - `Pcs`
  - `Print Date`
  - `Rate *`
  - `Sub Type`
  - `USD /`
  - `Weight`

Ref dropdowns (1): memopar-list_length
Local dropdowns (8): sel_0, sel_1, sel_2, sel_3, sel_4, sel_5, sel_6, sel_7

### Memo Out Return
| | Reference | Local |
|---|---|---|
| Page | Memo Out Return | Memo Out Return (Add Form) |
| Fields | 9 | 21 |

**Missing in local** (4):
  - `Broker`
  - `Search Menu...`
  - `Search by lot no`
  - `To Date`

Extra in local (9):
  - `0.00`
  - `Category`
  - `Due Date`
  - `Due Days`
  - `INR *`
  - `Invoice Number`
  - `Print Date`
  - `Sub Type`
  - `USD /`

Ref dropdowns (2): Party, Show
Local dropdowns (4): sel_0, sel_1, sel_2, sel_3

### Sale
| | Reference | Local |
|---|---|---|
| Page | Sale | Sale (Add Form) |
| Fields | 18 | 51 |

**Missing in local** (3):
  - `Search Menu...`
  - `Search by lot no`
  - `To Date`

Extra in local (27):
  - `$Rate`
  - `0.00`
  - `Amount`
  - `Bill No`
  - `Bro %`
  - `Bro Amount`
  - `COGS`
  - `Category`
  - `Com %`
  - `Com Amount`
  - `Comm.Agent`
  - `Description`
  - `Due Date`
  - `Due Days`
  - `INR *`
  - `Issue Carats *`
  - `Item Name`
  - `Lot Number`
  - `Pcs`
  - `Print Date`
  - `Rate *`
  - `Reje%`
  - `Rejection`
  - `Selected Carat`
  - `Sub Type`
  - `Type`
  - `USD /`

Ref dropdowns (8): Broker, Clarity, Color, Currency, Party, Shape, Sieve, Size
Local dropdowns (8): sel_0, sel_1, sel_2, sel_3, sel_4, sel_5, sel_6, sel_7

### Sale Return
| | Reference | Local |
|---|---|---|
| Page | Sale Return | Sale Return (Add Form) |
| Fields | 18 | 50 |

**Missing in local** (3):
  - `Search Menu...`
  - `Search by lot no`
  - `To Date`

Extra in local (26):
  - `$Rate`
  - `0.00`
  - `Amount`
  - `Bill No`
  - `Bro %`
  - `Bro Amount`
  - `Category`
  - `Com %`
  - `Com Amount`
  - `Comm.Agent`
  - `Description`
  - `Due Date`
  - `Due Days`
  - `INR *`
  - `Issue Carats *`
  - `Item Name`
  - `Lot Number`
  - `Pcs`
  - `Print Date`
  - `Rate *`
  - `Reje%`
  - `Rejection`
  - `Selected Carat`
  - `Sub Type`
  - `Type`
  - `USD /`

Ref dropdowns (8): Broker, Clarity, Color, Currency, Party, Shape, Sieve, Size
Local dropdowns (8): sel_0, sel_1, sel_2, sel_3, sel_4, sel_5, sel_6, sel_7

### Loan Given
| | Reference | Local |
|---|---|---|
| Page | Loan Given | Loan Given (Add Form) |
| Fields | 8 | 2 |

**Missing in local** (2):
  - `Search Menu...`
  - `lg-list-datatable_length`

Extra in local (1):
  - `Search...`

Ref dropdowns (1): lg-list-datatable_length
Local dropdowns (1): sel_0

### Loan Taken
| | Reference | Local |
|---|---|---|
| Page | Loan Taken | Loan Taken (Add Form) |
| Fields | 8 | 2 |

**Missing in local** (2):
  - `Search Menu...`
  - `lt-list-datatable_length`

Extra in local (1):
  - `Search...`

Ref dropdowns (1): lt-list-datatable_length
Local dropdowns (1): sel_0

### Payment & Receipts
| | Reference | Local |
|---|---|---|
| Page | Payment & Receipts | Payment Receipts (Add Form) |
| Fields | 23 | 2 |

**Missing in local** (2):
  - `Search Menu...`
  - `paymentrec-list_length`

Extra in local (1):
  - `Search...`

Ref dropdowns (1): paymentrec-list_length
Local dropdowns (1): sel_0

### Journal Entries
| | Reference | Local |
|---|---|---|
| Page | Journal Entries | Journal Entries (Add Form) |
| Fields | 13 | 2 |

**Missing in local** (2):
  - `Search Menu...`
  - `jv-list_length`

Extra in local (1):
  - `Search...`

Ref dropdowns (1): jv-list_length
Local dropdowns (1): sel_0

### Income/Expense
| | Reference | Local |
|---|---|---|
| Page | Income Expense | Income Expense (Add Form) |
| Fields | 13 | 2 |

**Missing in local** (2):
  - `Search Menu...`
  - `paymentrec-list_length`

Extra in local (1):
  - `Search...`

Ref dropdowns (1): paymentrec-list_length
Local dropdowns (1): sel_0

### Parcel Stock Report
| | Reference | Local |
|---|---|---|
| Page | Parcel Stock Report | Parcel Reports |
| Fields | 19 | 5 |

**Missing in local** (17):
  - `Lab Date From`
  - `LabDateChkBox`
  - `New Arrival From`
  - `New Arrival To`
  - `NewArrivalChkBox`
  - `Purchase Date From`
  - `Purchase Date To`
  - `PurchaseChkBox`
  - `ReviseCheckBox`
  - `Revision Date From`
  - `Revision Date To`
  - `Search Menu...`
  - `Unhold Date From`
  - `Unhold Date To`
  - `Web Revised From`
  - `Web Revised To`
  - `WebRevisedChkBox`

Extra in local (5):
  - `Clarity`
  - `Color`
  - `Lot / Item`
  - `Shape`
  - `Size`

### Parcel Purchase Report
| | Reference | Local |
|---|---|---|
| Page | Parcel Purchase Report | Parcel Reports |
| Fields | 18 | 5 |

**Missing in local** (9):
  - `Broker`
  - `Currency`
  - `Date`
  - `Invoice Number`
  - `Party`
  - `Search Menu...`
  - `Search by lot no`
  - `Sieve`
  - `To Date`

Extra in local (1):
  - `Lot / Item`

Ref dropdowns (8): Broker, Clarity, Color, Currency, Party, Shape, Sieve, Size

### Outstanding Report
| | Reference | Local |
|---|---|---|
| Page | Outstanding Report | Financial Reports |
| Fields | 16 | 5 |

**Missing in local** (11):
  - `Bill No`
  - `Broker`
  - `Category`
  - `Comm.Agent`
  - `Date`
  - `Display Currency`
  - `From Due Date`
  - `Invoice Number`
  - `Search Menu...`
  - `Sub Type`
  - `To Due Date`

Extra in local (1):
  - `From Date`

Ref dropdowns (2): Commission, Party
Local dropdowns (2): sel_0, sel_1

### Account Ledger
| | Reference | Local |
|---|---|---|
| Page | Account Ledger | Financial Reports |
| Fields | 4 | 5 |

**Missing in local** (1):
  - `Search Menu...`

Extra in local (2):
  - `Currency`
  - `Type`

Ref dropdowns (1): Party
Local dropdowns (2): sel_0, sel_1

---
## 3. Pages in Reference but Missing in Local

- **Parcel Master** (`/parcel/list-ParcelItemMaster`)
- **Account Group Master** (`/account/list-accountgroup`)
- **Purchase** (`/purchaseparcel/purchaseparcel`)
- **Purchase Return** (`/PurchaseParcelReturn/purchaseparcelreturnlist`)
- **Consignment In** (`/ConsignmentParcel/ConsignmentParcel`)
- **Consignment In Return** (`/Consignment/add-Consignment-returnpartial`)
- **Memo Out** (`/memoparcel/memoparcel-list`)
- **Memo Out Return** (`/memo/add-memo-returnpartial`)
- **Sale** (`/saleParcel/add-saleParcellist`)
- **Sale Return** (`/SaleReturnPartial/salereturnParcellist`)
- **Parcel Memo Out Report** (`/report/Pmemo-report`)
- **Parcel Sale Report** (`/report/parcelsale-report`)
- **Parcel Consignment Report** (`/report/ParcelConsignment-report`)
- **Parcel Stock History Report** (`/report/parcelstock-register-report`)
- **Parcel Purchase Return Report** (`/report/purchaseparcel-Return-report`)
- **Parcel Sale Return Report** (`/report/parcelsale-Return-report`)
- **Parcel Memo Out Return Report** (`/report/Pmemo-Return-report`)
- **Parcel Consignment Return Report** (`/report/ParcelConsignment-Return-report`)
- **Payment & Receipts With Ex. Diff** (`/Payment/PayWithExDiffList`)
- **Loan Outstanding Report** (`/report/loan-outstanding-report`)
- **Brokerage Outstanding Report** (`/report/bro-outstanding-report`)
- **Commission Outstanding Report** (`/report/adat-outstanding-report`)
- **Sale Purchase Summary Report** (`/report/sale-pur-summary`)
- **Monthly Expense Report** (`/report/month-expense-report`)
- **Cash Flow Report** (`/report/cash-flow-report`)
- **Profit & Loss Report** (`/Account/TradingAccount`)
- **Trial Balance Sheet** (`/Account/TrialBalSheet`)
- **Balance Sheet** (`/Account/BalanceSheet`)
- **Invoice Ledger Report** (`/report/invoice-ledger-report`)
- **Download MRP** (`/data/downloadMRP`)
- **Import Grading** (`/data/importgrading`)
- **Import Solitaire Price** (`/data/import-pricing`)
- **Get LAB Data** (`/data/getlabdata`)
- **Stock Transfer** (`/Stock/Stock-transfer-list`)
- **Convert Excel Utility** (`/dashbord/uploadexcel`)
- **Stock Telly** (`/data/stocktellydata`)

---
## 4. Key Visual / UX Differences to Check

(Compare screenshots in `scraped_ref2/` vs `scraped_local/`)

- [ ] Purchase form: all fields match reference layout?
- [ ] Parcel Stock Report: 3 tabs (Basic/Grading, Numeric, Date Search)?
- [ ] Report pages: filter forms match reference?
- [ ] Financial transaction forms: all fields present?
- [ ] Payment & Receipts WITH Ex. Diff is a separate page in ref
- [ ] Sidebar hierarchy matches reference structure
- [ ] Table columns in list views match reference