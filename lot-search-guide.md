# Lot Search Guide - Diamond Accounting Database

This guide documents how to search for all data related to a specific lot number in the diamond accounting database.

## Database Location
- **Database File**: `/backend/diamond_accounting.db`
- **Type**: SQLite database
- **Access**: Use `sqlite3` command-line tool

## Key Tables Structure

### Primary Tables
- **`parcel_masters`**: Main lot/parcel information
- **`diamonds`**: Individual diamond records (currently empty)

### Transaction Tables
- **`parcel_purchase_items`**: Purchase transaction items
- **`parcel_purchase_return_items`**: Purchase return items
- **`memo_out_items`**: Memo out transaction items  
- **`memo_out_return_items`**: Memo out return items
- **`sale_items`**: Sale transaction items
- **`sale_return_items`**: Sale return items
- **`consignment_items`**: Consignment transaction items
- **`consignment_return_items`**: Consignment return items

### Supporting Tables
- **`parcel_purchases`**: Purchase header records
- **`parcel_merge_logs`**: Lot merge history
- **`activity_logs`**: System activity logs

## Lot Number Format
- **Format**: 4-digit zero-padded (e.g., "0059" not "59")
- **Search Strategy**: Always search for both formats ("59" and "0059")

## Complete Search Process

### Step 1: Basic Database Setup
```bash
cd /path/to/backend
sqlite3 diamond_accounting.db
```

### Step 2: Search Parcel Master Record
```sql
-- Get main parcel information
SELECT * FROM parcel_masters WHERE lot_no IN ('59', '0059');

-- Formatted output
.headers on
.mode column
SELECT * FROM parcel_masters WHERE lot_no IN ('59', '0059');
```

### Step 3: Check Transaction Counts
```sql
-- Quick count of transactions across all tables
SELECT 'parcel_purchase_items' as table_name, COUNT(*) as count 
FROM parcel_purchase_items WHERE lot_number IN ('59', '0059')
UNION ALL
SELECT 'parcel_purchase_return_items' as table_name, COUNT(*) as count 
FROM parcel_purchase_return_items WHERE lot_number IN ('59', '0059')
UNION ALL  
SELECT 'memo_out_items' as table_name, COUNT(*) as count 
FROM memo_out_items WHERE lot_number IN ('59', '0059')
UNION ALL
SELECT 'memo_out_return_items' as table_name, COUNT(*) as count 
FROM memo_out_return_items WHERE lot_number IN ('59', '0059')
UNION ALL
SELECT 'sale_items' as table_name, COUNT(*) as count 
FROM sale_items WHERE lot_number IN ('59', '0059')
UNION ALL
SELECT 'sale_return_items' as table_name, COUNT(*) as count 
FROM sale_return_items WHERE lot_number IN ('59', '0059')
UNION ALL
SELECT 'consignment_items' as table_name, COUNT(*) as count 
FROM consignment_items WHERE lot_number IN ('59', '0059')
UNION ALL
SELECT 'consignment_return_items' as table_name, COUNT(*) as count 
FROM consignment_return_items WHERE lot_number IN ('59', '0059');
```

### Step 4: Get Detailed Transaction Data

#### Purchase Items with Header Details
```sql
SELECT pp.id as purchase_id, pp.date, pp.invoice_number, pp.party as vendor_name,
       ppi.id as item_id, ppi.lot_number, ppi.item_name, ppi.shape, ppi.color, ppi.clarity, 
       ppi.size, ppi.issue_carats, ppi.selected_carat, ppi.pcs, ppi.rate, ppi.amount
FROM parcel_purchase_items ppi
JOIN parcel_purchases pp ON ppi.purchase_id = pp.id
WHERE ppi.lot_number IN ('59', '0059')
ORDER BY pp.date;
```

#### Sale Items (if any)
```sql
SELECT s.id as sale_id, s.date, s.invoice_number, s.party as customer_name,
       si.id as item_id, si.lot_number, si.item_name, si.shape, si.color, si.clarity,
       si.size, si.issue_carats, si.selected_carat, si.pcs, si.rate, si.amount
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE si.lot_number IN ('59', '0059')
ORDER BY s.date;
```

#### Memo Out Items (if any)
```sql
SELECT mo.id as memo_id, mo.date, mo.memo_number, mo.party as party_name,
       moi.id as item_id, moi.lot_number, moi.item_name, moi.shape, moi.color, moi.clarity,
       moi.size, moi.issue_carats, moi.selected_carat, moi.pcs, moi.rate, moi.amount
FROM memo_out_items moi
JOIN memo_outs mo ON moi.memo_id = mo.id
WHERE moi.lot_number IN ('59', '0059')
ORDER BY mo.date;
```

### Step 5: Check Merge History
```sql
-- Check if lot was involved in merges
SELECT * FROM parcel_merge_logs 
WHERE surviving_lot_no IN ('59', '0059') OR merged_lot_no IN ('59', '0059');
```

### Step 6: Check Activity Logs
```sql
-- Check system activity logs
SELECT * FROM activity_logs 
WHERE message LIKE '%0059%' OR message LIKE '%59%' 
   OR payload LIKE '%0059%' OR payload LIKE '%59%' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Step 7: Diamond Records (if populated)
```sql
-- Check individual diamond records
SELECT * FROM diamonds WHERE lot_no IN ('59', '0059');
```

## Key Fields in Parcel Master

### Identification
- `id`: Unique parcel ID
- `company_id`: Company reference
- `lot_no`: Lot number (zero-padded)
- `item_name`: Description of the parcel

### Physical Properties
- `shape`, `color`, `clarity`, `size`, `sieve_mm`: Diamond characteristics
- `stock_type`, `stock_subtype`, `grown_process_type`: Classification

### Weight Tracking
- `opening_weight_carats`: Initial weight
- `purchased_weight`: Total purchased
- `sold_weight`: Total sold
- `on_memo_weight`: Currently on memo
- `consignment_weight`: Currently on consignment
- `purchased_pcs`, `sold_pcs`, etc.: Piece counts

### Pricing (INR)
- `purchase_price`: Purchase rate per carat
- `purchase_cost_inr_amount`: Total purchase cost
- `asking_price_inr_carats`: Asking rate per carat
- `asking_inr_amount`: Total asking amount

### Pricing (USD)
- `usd_to_inr_rate`: Exchange rate used
- `purchase_cost_usd_amount`: Total purchase cost USD
- `asking_usd_amount`: Total asking amount USD

## Transaction Item Fields

### Common Fields
- `lot_number`: Lot reference
- `item_name`: Item description
- `shape`, `color`, `clarity`, `size`: Physical properties
- `issue_carats`: Issued weight
- `selected_carat`: Selected weight
- `pcs`: Piece count
- `rate`: Price per carat
- `amount`: Total amount

### Purchase-Specific
- `reje_pct`: Rejection percentage
- `rejection`: Rejection amount
- `usd_rate`: USD exchange rate
- `less1`, `less2`, `less3`: Discount amounts

### Sale-Specific
- `cogs`: Cost of goods sold
- `less1`, `less2`, `less3`: Discount amounts

## Common Search Patterns

### Get Complete Lot Summary
```bash
# Single command to get all lot data
cd /path/to/backend
sqlite3 diamond_accounting.db "
-- Parcel Master
SELECT 'PARCEL MASTER' as section, * FROM parcel_masters WHERE lot_no IN ('XX', '00XX');

-- Purchase Summary
SELECT 'PURCHASES' as section, COUNT(*) as transaction_count, SUM(selected_carat) as total_carats, SUM(amount) as total_amount
FROM parcel_purchase_items WHERE lot_number IN ('XX', '00XX');

-- Transaction counts
SELECT 'TRANSACTION COUNTS' as section, 
       SUM(CASE WHEN lot_number IN ('XX', '00XX') THEN 1 ELSE 0 END) as purchases
FROM parcel_purchase_items;
"
```

### Quick Status Check
```bash
# Replace XX with actual lot number
sqlite3 diamond_accounting.db "
SELECT pm.lot_no, pm.item_name, pm.purchased_weight, pm.sold_weight, 
       pm.on_memo_weight, pm.consignment_weight,
       (pm.purchased_weight - pm.sold_weight - pm.on_memo_weight - pm.consignment_weight) as available_weight
FROM parcel_masters pm 
WHERE pm.lot_no IN ('XX', '00XX');
"
```

## Notes

1. **Always search both formats**: Use `IN ('59', '0059')` pattern
2. **Transaction items use `lot_number`**: Different from parcel master's `lot_no`
3. **Join with headers**: Get complete transaction context
4. **Check merge history**: Lots may have been merged from/to other lots
5. **Empty diamonds table**: Currently not populated with individual stones
6. **Date formatting**: Dates stored as 'YYYY-MM-DD' format

## Example Output Structure

When documenting results, include:
- Parcel Master details (identification, properties, weights, pricing)
- Purchase history (chronological list with vendor, date, weight, rate)
- Sale history (if any)
- Memo/Consignment status (if any)
- Current inventory status
- Merge history (if applicable)

This provides a complete picture of the lot's lifecycle in the system.