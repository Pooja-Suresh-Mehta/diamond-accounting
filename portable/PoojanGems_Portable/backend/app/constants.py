"""Shared dropdown defaults and table-column mappings for cascade operations."""

DEFAULT_SHAPES = sorted([
    "Baguette", "Cushion", "Emerald", "Heart", "Marquise", "Oval",
    "Pear", "Princess", "Radiant", "Round", "Taper", "Triangle",
])
DEFAULT_COLORS = [
    "G+", "G-", "White", "OW", "NW", "LB", "OWLC", "NWLC", "LC", "OWLB", "NWLB",
    "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "MIX",
]
DEFAULT_CLARITIES = [
    "SJEW", "DLX", "DLXAA", "CWP", "REJ", "COLL",
    "FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1", "I2", "I3",
]
DEFAULT_SIZES = [
    "0.18 DOWN", "0.18 UP", "0.23 UP", "0.30 UP", "0.40 UP", "0.50 UP",
    "0.70 UP", "0.80 UP", "0.90 UP", "1.00 UP", "1.50 UP", "2.00 UP",
    "2.50 UP", "3.00 UP", "5.00 UP",
]
DEFAULT_SIEVES = [
    "-000", "+000", "000-2", "2-6", "6-9", "9-11", "11 UP",
    "-2.0", "+2.0", "+2.5", "+3.0", "+3.5", "+4.0", "+4.5", "+5.0", "+6.0",
    "-7", "+7", "1/10", "1/6", "1/5", "1/4", "1/3", "3/8",
]
DEFAULT_STOCK_GROUPS = ["TPBG", "PMQ", "OFC", "ROUND"]

FIELD_DEFAULTS = {
    "shape": DEFAULT_SHAPES,
    "color": DEFAULT_COLORS,
    "clarity": DEFAULT_CLARITIES,
    "size": DEFAULT_SIZES,
    "sieve": DEFAULT_SIEVES,
    "stock_group": DEFAULT_STOCK_GROUPS,
}

# Maps field_name -> list of (table_name, column_name) for cascade updates
FIELD_TABLE_COLUMNS = {
    "shape": [
        ("parcel_masters", "shape"),
        ("parcel_purchase_items", "shape"),
        ("parcel_purchase_return_items", "shape"),
        ("sale_items", "shape"),
        ("sale_return_items", "shape"),
        ("consignment_items", "shape"),
        ("consignment_return_items", "shape"),
        ("diamonds", "shape"),
    ],
    "color": [
        ("parcel_masters", "color"),
        ("parcel_purchase_items", "color"),
        ("parcel_purchase_return_items", "color"),
        ("sale_items", "color"),
        ("sale_return_items", "color"),
        ("consignment_items", "color"),
        ("consignment_return_items", "color"),
        ("diamonds", "color"),
    ],
    "clarity": [
        ("parcel_masters", "clarity"),
        ("parcel_purchase_items", "clarity"),
        ("parcel_purchase_return_items", "clarity"),
        ("sale_items", "clarity"),
        ("sale_return_items", "clarity"),
        ("consignment_items", "clarity"),
        ("consignment_return_items", "clarity"),
        ("diamonds", "clarity"),
    ],
    "size": [
        ("parcel_masters", "size"),
        ("parcel_purchase_items", "size"),
        ("parcel_purchase_return_items", "size"),
        ("sale_items", "size"),
        ("sale_return_items", "size"),
        ("consignment_items", "size"),
        ("consignment_return_items", "size"),
        ("diamonds", "size_range"),
    ],
    "sieve": [
        ("parcel_masters", "sieve_mm"),
        ("parcel_purchase_items", "sieve"),
        ("parcel_purchase_return_items", "sieve"),
        ("sale_items", "sieve"),
        ("sale_return_items", "sieve"),
        ("consignment_items", "sieve"),
        ("consignment_return_items", "sieve"),
    ],
    "stock_group": [
        ("parcel_masters", "stock_group_id"),
    ],
}

# Fields whose values contribute to item_name (shape color size clarity joined by spaces)
ITEM_NAME_FIELDS = {"shape", "color", "clarity", "size"}

# Tables that store item_name built from shape/color/size/clarity.
# Each entry: (table_name, col_name_for_that_field_in_this_table)
# col_name is looked up via FIELD_TABLE_COLUMNS at runtime.
# Tables that have a direct company_id column vs those that need a parent JOIN are
# handled automatically via ITEMS_PARENT_TABLE below.
ITEM_NAME_TABLES = [
    "parcel_masters",
    "parcel_purchase_items",
    "parcel_purchase_return_items",
    "sale_items",
    "sale_return_items",
    "consignment_items",
    "consignment_return_items",
]

# Items tables need a JOIN to their parent to filter by company_id
# Maps: items_table -> (parent_table, fk_col_in_items, pk_col_in_parent)
ITEMS_PARENT_TABLE = {
    "parcel_purchase_items": ("parcel_purchases", "purchase_id", "id"),
    "parcel_purchase_return_items": ("parcel_purchase_returns", "purchase_return_id", "id"),
    "sale_items": ("sales", "sale_id", "id"),
    "sale_return_items": ("sale_returns", "sale_return_id", "id"),
    "consignment_items": ("consignments", "consignment_id", "id"),
    "consignment_return_items": ("consignment_returns", "consignment_return_id", "id"),
}
