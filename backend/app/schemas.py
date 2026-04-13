from pydantic import BaseModel, Field, model_validator
from typing import Optional

from datetime import date, datetime


# ── Auth ───────────────────────────────────────────────

class LoginRequest(BaseModel):
    company_name: str
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    username: str
    full_name: Optional[str]
    role: str
    company_id: str
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── User Management ────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: str = Field(default="user")  # admin, user, viewer

    @model_validator(mode="after")
    def validate_role(self):
        if self.role not in ("admin", "user", "viewer"):
            raise ValueError("role must be admin, user, or viewer")
        return self


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_role(self):
        if self.role is not None and self.role not in ("admin", "user", "viewer"):
            raise ValueError("role must be admin, user, or viewer")
        return self


# ── Diamond Search ─────────────────────────────────────

class DiamondSearchRequest(BaseModel):
    # Tab 1: Basic & Grading
    show: Optional[str] = "All"           # All, Sold, Unsold
    hold_status: Optional[str] = "All"    # All, Hold, Unhold
    stone_type: Optional[str] = "All"     # Single, Parcel, All
    status: Optional[str] = "All"
    stock_till_date: Optional[date] = None

    # Identifier Search
    search_field_type: Optional[str] = None
    search_field_value: Optional[str] = None

    # Diamond Specs (multi-select as lists)
    shapes: Optional[list[str]] = None
    color_groups: Optional[list[str]] = None
    colors: Optional[list[str]] = None
    size_ranges: Optional[list[str]] = None
    clarities: Optional[list[str]] = None
    cuts: Optional[list[str]] = None
    polishes: Optional[list[str]] = None
    symmetries: Optional[list[str]] = None
    labs: Optional[list[str]] = None

    # Advanced visual
    fluorescences: Optional[list[str]] = None
    fl_colors: Optional[list[str]] = None
    milky_values: Optional[list[str]] = None
    shades: Optional[list[str]] = None

    # Numeric ranges
    carats_from: Optional[float] = None
    carats_to: Optional[float] = None
    back_pct_from: Optional[float] = None
    back_pct_to: Optional[float] = None
    price_from: Optional[float] = None
    price_to: Optional[float] = None
    lot_no_from: Optional[str] = None
    lot_no_to: Optional[str] = None

    # Tab 2: Numeric Search
    length_from: Optional[float] = None
    length_to: Optional[float] = None
    width_from: Optional[float] = None
    width_to: Optional[float] = None
    depth_from: Optional[float] = None
    depth_to: Optional[float] = None
    depth_pct_from: Optional[float] = None
    depth_pct_to: Optional[float] = None
    table_pct_from: Optional[float] = None
    table_pct_to: Optional[float] = None
    lw_ratio_from: Optional[float] = None
    lw_ratio_to: Optional[float] = None
    crown_angle_from: Optional[float] = None
    crown_angle_to: Optional[float] = None
    crown_height_from: Optional[float] = None
    crown_height_to: Optional[float] = None
    pavilion_angle_from: Optional[float] = None
    pavilion_angle_to: Optional[float] = None
    pavilion_height_from: Optional[float] = None
    pavilion_height_to: Optional[float] = None

    # Tab 3: Date Search
    date_type: Optional[str] = None  # Purchase, LabIn, LabOut, Status, Entry
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    # Sorting
    sort_by: Optional[str] = None

    # Pagination
    page: int = 1
    page_size: int = 50


class DiamondOut(BaseModel):
    id: str
    lot_no: Optional[str]
    cert_no: Optional[str]
    sr_no: Optional[str]
    kapan_no: Optional[str]
    packet_no: Optional[str]
    item_code: Optional[str]
    status: Optional[str]
    hold_status: Optional[str]
    stone_type: Optional[str]
    is_sold: bool
    shape: Optional[str]
    color_group: Optional[str]
    color: Optional[str]
    clarity: Optional[str]
    cut: Optional[str]
    polish: Optional[str]
    symmetry: Optional[str]
    lab: Optional[str]
    carats: Optional[float]
    size_range: Optional[str]
    fluorescence: Optional[str]
    fl_color: Optional[str]
    milky: Optional[str]
    shade: Optional[str]
    length: Optional[float]
    width: Optional[float]
    depth: Optional[float]
    depth_pct: Optional[float]
    table_pct: Optional[float]
    lw_ratio: Optional[float]
    rap_price: Optional[float]
    back_pct: Optional[float]
    price_per_carat: Optional[float]
    total_price: Optional[float]
    image_url: Optional[str]
    video_url: Optional[str]
    cert_url: Optional[str]
    key_to_symbols: Optional[str]
    purchase_date: Optional[date]
    entry_date: Optional[date]
    location: Optional[str]

    class Config:
        from_attributes = True


class DiamondSearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[DiamondOut]


# ── Dashboard ──────────────────────────────────────────

class DashboardStats(BaseModel):
    total_stones: int
    total_carats: float
    total_value: float
    on_hand: int
    on_memo: int
    sold: int
    offices: int


TokenResponse.model_rebuild()


# ── Dropdown Options ──────────────────────────────────

class DropdownRenameRequest(BaseModel):
    field_name: str
    old_value: str
    new_value: str


# ── Account Master ──────────────────────────────────────

class AccountMasterBase(BaseModel):
    entry_type: str = "Account"
    account_group_name: str
    account_name: Optional[str] = None
    short_name: Optional[str] = None
    under_group_name: str
    account_type: str
    currency: str = "INR"
    inr_base_rate: float = 85
    usd_base_rate: float = 1
    opening_balance: float
    balance_type: str = "Debit"
    interest_pct: Optional[float] = None
    discount_pct: Optional[float] = None
    credit_limit: Optional[float] = None
    due_days: Optional[int] = None
    grace_period: Optional[int] = None
    term: Optional[str] = None
    term_pct: Optional[float] = None
    term_per: Optional[float] = None
    markup: Optional[float] = None
    local_language_name: Optional[str] = None
    local_language_contact_person: Optional[str] = None
    local_language_address: Optional[str] = None
    website_user: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    address3: Optional[str] = None
    zipcode: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    area: Optional[str] = None
    mobile: Optional[str] = None
    office_phone: Optional[str] = None
    home_phone: Optional[str] = None
    fax: Optional[str] = None
    qqid: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    skype: Optional[str] = None
    broker_pct: Optional[float] = None
    broker_per: Optional[float] = None
    through: Optional[str] = None
    contact_person: Optional[str] = None
    agent: Optional[str] = None
    reference_party_name1: Optional[str] = None
    reference_party_name2: Optional[str] = None
    reference_phone1: Optional[str] = None
    reference_phone2: Optional[str] = None
    reference_comments1: Optional[str] = None
    reference_comments2: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_account_detail: Optional[str] = None
    bank_routing: Optional[str] = None
    bank_swift_code: Optional[str] = None
    pan_no: Optional[str] = None
    gst_no: Optional[str] = None
    tin_number: Optional[str] = None
    cin_no: Optional[str] = None
    gr_no: Optional[str] = None
    cst_no: Optional[str] = None
    remarks: Optional[str] = None
    compliance: bool = False
    active: bool = True
    email_inventory: bool = False
    shipping_name: Optional[str] = None
    shipping_address1: Optional[str] = None
    shipping_zipcode: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_country: Optional[str] = None
    shipping_area: Optional[str] = None
    shipping_phone: Optional[str] = None
    shipping_fax: Optional[str] = None

class AccountMasterCreate(AccountMasterBase):
    @model_validator(mode="after")
    def validate_mandatory(self):
        if not self.account_group_name.strip():
            raise ValueError("Account/Group Name is required")
        if not self.under_group_name.strip():
            raise ValueError("Under Group is required")
        if not self.account_type.strip():
            raise ValueError("Account Type is required")
        return self


class AccountMasterUpdate(AccountMasterBase):
    @model_validator(mode="after")
    def validate_mandatory(self):
        if not self.account_group_name.strip():
            raise ValueError("Account/Group Name is required")
        if not self.under_group_name.strip():
            raise ValueError("Under Group is required")
        if not self.account_type.strip():
            raise ValueError("Account Type is required")
        return self


class AccountMasterOut(AccountMasterBase):
    id: str
    company_id: str
    is_system: bool
    allow_zero_opening_balance: bool
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Parcel Master ───────────────────────────────────────

class ParcelMasterBase(BaseModel):
    lot_no: str
    item_name: str
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve_mm: Optional[str] = None
    stock_group_id: Optional[str] = None
    description: Optional[str] = None
    stock_type: str = "Natural Diamond"
    stock_subtype: str = "Polished"
    grown_process_type: str = "Natural"
    opening_weight_carats: float = 0.0
    usd_to_inr_rate: float = 0.0
    purchase_price: float = 0.0
    purchase_price_currency: str = "USD"
    purchase_cost_usd_amount: float = 0.0
    purchase_cost_inr_amount: float = 0.0
    purchase_cost_inr_carat: float = 0.0
    purchase_cost_usd_carat: float = 0.0
    asking_price_usd_carats: float = 0.0
    asking_usd_amount: float = 0.0
    asking_price_inr_carats: float = 0.0
    asking_inr_amount: float = 0.0


class ParcelMasterCreate(ParcelMasterBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.lot_no.strip():
            raise ValueError("Stock ID/LotNo is required")
        if not (self.shape or "").strip():
            raise ValueError("Shape is required")
        if not (self.size or "").strip():
            raise ValueError("Size is required")
        return self


class ParcelMasterUpdate(ParcelMasterBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.lot_no.strip():
            raise ValueError("Stock ID/LotNo is required")
        if not (self.shape or "").strip():
            raise ValueError("Shape is required")
        if not (self.size or "").strip():
            raise ValueError("Size is required")
        return self


class ParcelMasterOut(ParcelMasterBase):
    id: str
    company_id: str
    purchased_weight: float = 0
    purchased_pcs: int = 0
    sold_weight: float = 0
    sold_pcs: int = 0
    on_memo_weight: float = 0
    on_memo_pcs: int = 0
    consignment_weight: float = 0
    consignment_pcs: int = 0
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Parcel Purchase ─────────────────────────────────────

class ParcelPurchaseItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve: Optional[str] = None
    issue_carats: float = 0
    reje_pct: float = 0
    rejection: float = 0
    selected_carat: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class ParcelPurchaseItemCreate(ParcelPurchaseItemBase):
    pass


class ParcelPurchaseItemOut(ParcelPurchaseItemBase):
    id: str

    class Config:
        from_attributes = True


class ParcelPurchaseBase(BaseModel):
    invoice_number: str
    bill_no: Optional[str] = None
    date: date
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    comm_agent: Optional[str] = None
    com_pct: float = 0
    com_amount: float = 0
    save_grading: bool = False
    purchase_last_year: bool = False
    broker: Optional[str] = None
    bro_pct: float = 0
    bro_amount: float = 0
    description: Optional[str] = None
    consignment_no: Optional[str] = None
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[ParcelPurchaseItemCreate] = []


class ParcelPurchaseCreate(ParcelPurchaseBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class ParcelPurchaseUpdate(ParcelPurchaseBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class ParcelPurchaseOut(ParcelPurchaseBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[ParcelPurchaseItemOut] = []

    class Config:
        from_attributes = True


class ParcelPurchaseReturnItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve: Optional[str] = None
    issue_carats: float = 0
    reje_pct: float = 0
    rejection: float = 0
    selected_carat: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class ParcelPurchaseReturnItemCreate(ParcelPurchaseReturnItemBase):
    pass


class ParcelPurchaseReturnItemOut(ParcelPurchaseReturnItemBase):
    id: str

    class Config:
        from_attributes = True


class ParcelPurchaseReturnBase(BaseModel):
    memo_number: str
    inv_bill_no: Optional[str] = None
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    comm_agent: Optional[str] = None
    com_pct: float = 0
    com_amount: float = 0
    save_grading: bool = False
    purchase_last_year: bool = False
    outstanding: bool = False
    broker: Optional[str] = None
    bro_pct: float = 0
    bro_amount: float = 0
    description: Optional[str] = None
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[ParcelPurchaseReturnItemCreate] = []


class ParcelPurchaseReturnCreate(ParcelPurchaseReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.memo_number.strip():
            raise ValueError("Memo Number is required")
        return self


class ParcelPurchaseReturnUpdate(ParcelPurchaseReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.memo_number.strip():
            raise ValueError("Memo Number is required")
        return self


class ParcelPurchaseReturnOut(ParcelPurchaseReturnBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[ParcelPurchaseReturnItemOut] = []

    class Config:
        from_attributes = True


class MemoOutItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    weight: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class MemoOutItemCreate(MemoOutItemBase):
    pass


class MemoOutItemOut(MemoOutItemBase):
    id: str

    class Config:
        from_attributes = True


class MemoOutBase(BaseModel):
    invoice_number: str
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    save_grading: bool = False
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[MemoOutItemCreate] = []


class MemoOutCreate(MemoOutBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class MemoOutUpdate(MemoOutBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class MemoOutOut(MemoOutBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[MemoOutItemOut] = []

    class Config:
        from_attributes = True


# ── Memo Out Return ─────────────────────────────────────

class MemoOutReturnItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    weight: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class MemoOutReturnItemCreate(MemoOutReturnItemBase):
    pass


class MemoOutReturnItemOut(MemoOutReturnItemBase):
    id: str

    class Config:
        from_attributes = True


class MemoOutReturnBase(BaseModel):
    invoice_number: str
    source_memo_number: Optional[str] = None
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    save_grading: bool = False
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[MemoOutReturnItemCreate] = []


class MemoOutReturnCreate(MemoOutReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class MemoOutReturnUpdate(MemoOutReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class MemoOutReturnOut(MemoOutReturnBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[MemoOutReturnItemOut] = []

    class Config:
        from_attributes = True


# ── Sale ────────────────────────────────────────────────

class SaleItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve: Optional[str] = None
    issue_carats: float = 0
    reje_pct: float = 0
    rejection: float = 0
    selected_carat: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    cogs: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class SaleItemCreate(SaleItemBase):
    pass


class SaleItemOut(SaleItemBase):
    id: str

    class Config:
        from_attributes = True


class SaleBase(BaseModel):
    invoice_number: str
    bill_no: Optional[str] = None
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    comm_agent: Optional[str] = None
    com_pct: float = 0
    com_amount: float = 0
    save_grading: bool = False
    purchase_last_year: bool = False
    outstanding: bool = False
    broker: Optional[str] = None
    bro_pct: float = 0
    bro_amount: float = 0
    description: Optional[str] = None
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[SaleItemCreate] = []


class SaleCreate(SaleBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class SaleUpdate(SaleBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class SaleOut(SaleBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[SaleItemOut] = []

    class Config:
        from_attributes = True


# ── Sale Return ─────────────────────────────────────────

class SaleReturnItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve: Optional[str] = None
    issue_carats: float = 0
    reje_pct: float = 0
    rejection: float = 0
    selected_carat: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class SaleReturnItemCreate(SaleReturnItemBase):
    pass


class SaleReturnItemOut(SaleReturnItemBase):
    id: str

    class Config:
        from_attributes = True


class SaleReturnBase(BaseModel):
    invoice_number: str
    bill_no: Optional[str] = None
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    comm_agent: Optional[str] = None
    com_pct: float = 0
    com_amount: float = 0
    save_grading: bool = False
    purchase_last_year: bool = False
    outstanding: bool = False
    broker: Optional[str] = None
    bro_pct: float = 0
    bro_amount: float = 0
    description: Optional[str] = None
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[SaleReturnItemCreate] = []


class SaleReturnCreate(SaleReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class SaleReturnUpdate(SaleReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class SaleReturnOut(SaleReturnBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[SaleReturnItemOut] = []

    class Config:
        from_attributes = True


# ── Consignment ──────────────────────────────────────────

class ConsignmentItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve: Optional[str] = None
    issue_carats: float = 0
    reje_pct: float = 0
    rejection: float = 0
    selected_carat: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class ConsignmentItemCreate(ConsignmentItemBase):
    pass


class ConsignmentItemOut(ConsignmentItemBase):
    id: str

    class Config:
        from_attributes = True


class ConsignmentBase(BaseModel):
    invoice_number: str
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    save_grading: bool = False
    broker: Optional[str] = None
    bro_pct: float = 0
    bro_amount: float = 0
    description: Optional[str] = None
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    aed_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[ConsignmentItemCreate] = []


class ConsignmentCreate(ConsignmentBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class ConsignmentUpdate(ConsignmentBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class ConsignmentOut(ConsignmentBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    aed_amt: float = 0
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[ConsignmentItemOut] = []

    class Config:
        from_attributes = True


# ── Consignment Return ───────────────────────────────────

class ConsignmentReturnItemBase(BaseModel):
    lot_number: Optional[str] = None
    item_name: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = None
    clarity: Optional[str] = None
    size: Optional[str] = None
    sieve: Optional[str] = None
    issue_carats: float = 0
    reje_pct: float = 0
    rejection: float = 0
    selected_carat: float = 0
    pcs: int = 0
    rate: float = 0
    usd_rate: float = 0
    less1: float = 0
    less2: float = 0
    less3: float = 0
    amount: float = 0


class ConsignmentReturnItemCreate(ConsignmentReturnItemBase):
    pass


class ConsignmentReturnItemOut(ConsignmentReturnItemBase):
    id: str

    class Config:
        from_attributes = True


class ConsignmentReturnBase(BaseModel):
    invoice_number: str
    source_consignment_number: Optional[str] = None
    date: date
    print_date: Optional[date] = None
    purchase_type: str = "LOCAL"
    sub_type: Optional[str] = None
    category: str = "Natural Diamond"
    party: Optional[str] = None
    due_days: int = 0
    due_date: Optional[date] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    save_grading: bool = False
    broker: Optional[str] = None
    bro_pct: float = 0
    bro_amount: float = 0
    description: Optional[str] = None
    plus_minus_amount: float = 0
    net_amount: float = 0
    m_currency_net_amount: float = 0
    cgst_pct: float = 0
    cgst_amount: float = 0
    sgst_pct: float = 0
    sgst_amount: float = 0
    igst_pct: float = 0
    igst_amount: float = 0
    vat_pct: float = 0
    vat_amount: float = 0
    inr_final_amount: float = 0
    usd_final_amount: float = 0
    aed_final_amount: float = 0
    transaction_final_amount: float = 0
    payment_status: str = "Pending"
    items: list[ConsignmentReturnItemCreate] = []


class ConsignmentReturnCreate(ConsignmentReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class ConsignmentReturnUpdate(ConsignmentReturnBase):
    @model_validator(mode="after")
    def validate_required(self):
        if not self.invoice_number.strip():
            raise ValueError("Invoice Number is required")
        return self


class ConsignmentReturnOut(ConsignmentReturnBase):
    id: str
    company_id: str
    total_carats: float
    total_amount: float
    inr_amt: float
    usd_amt: float
    aed_amt: float = 0
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[ConsignmentReturnItemOut] = []

    class Config:
        from_attributes = True


# ── Loan ─────────────────────────────────────────────────

class LoanBase(BaseModel):
    loan_type: str  # Given | Taken
    inv_no: Optional[str] = None
    date: date
    renew_date: Optional[date] = None
    outstanding: bool = False
    party: Optional[str] = None
    due_date: Optional[date] = None
    due_days: int = 0
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    broker: Optional[str] = None
    broker_pct: float = 0
    amount: float = 0
    interest_pct: float = 0
    interest: float = 0
    divide_days: int = 365
    rec_from_party: Optional[str] = None
    description: Optional[str] = None
    from_account: Optional[str] = None
    to_account: Optional[str] = None
    inr_amt: float = 0
    usd_amt: float = 0
    aed_amt: float = 0
    narration: Optional[str] = None


class LoanCreate(LoanBase):
    @model_validator(mode="after")
    def validate_and_compute(self):
        if not self.loan_type.strip():
            raise ValueError("Loan type is required")
        if not self.party or not self.party.strip():
            raise ValueError("Party is required")
        if not self.amount or self.amount <= 0:
            raise ValueError("Amount must be greater than 0")
        # compute due_days from dates
        if self.due_date and self.date:
            self.due_days = max(0, (self.due_date - self.date).days)
        return self


class LoanUpdate(LoanBase):
    @model_validator(mode="after")
    def validate_and_compute(self):
        if not self.party or not self.party.strip():
            raise ValueError("Party is required")
        if not self.amount or self.amount <= 0:
            raise ValueError("Amount must be greater than 0")
        if self.due_date and self.date:
            self.due_days = max(0, (self.due_date - self.date).days)
        return self


class LoanOut(LoanBase):
    id: str
    company_id: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Payment / Receipt ────────────────────────────────────

class PaymentBase(BaseModel):
    vtype: str  # Payment | Receipt
    pay_type: str = "Regular"  # Regular | ExDiff
    date: date
    main_account: Optional[str] = None
    party_account: Optional[str] = None
    received_dr: float = 0
    paid_cr: float = 0
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    auto_adjust: bool = False
    description: Optional[str] = None
    amount: float = 0
    inr_amt: float = 0
    usd_amt: float = 0
    aed_amt: float = 0
    exchange_diff: float = 0
    has_exchange_diff: bool = False
    narration: Optional[str] = None
    ref_invoice: Optional[str] = None


class PaymentCreate(PaymentBase):
    @model_validator(mode="after")
    def validate_and_compute(self):
        if self.received_dr > 0 and self.paid_cr > 0:
            raise ValueError("Cannot set both Received and Paid — enter only one")
        if not self.received_dr and not self.paid_cr:
            raise ValueError("Enter either Received [Dr.] or Paid [Cr.] amount")
        if not self.main_account or not self.main_account.strip():
            raise ValueError("Main Account is required")
        if not self.party_account or not self.party_account.strip():
            raise ValueError("Transaction Account is required")
        # auto-derive vtype from direction
        if self.received_dr > 0:
            self.vtype = "Receipt"
            self.amount = self.received_dr
        else:
            self.vtype = "Payment"
            self.amount = self.paid_cr
        # compute INR/USD amounts
        inr = self.inr_rate or 85
        usd = self.usd_rate or 1
        amt = self.amount
        if self.currency == "INR":
            self.inr_amt = amt
            self.usd_amt = round(amt / inr, 2)
        elif self.currency == "USD":
            self.usd_amt = amt
            self.inr_amt = round(amt * inr, 2)
        else:  # AED
            self.inr_amt = round(amt * inr, 2)
            self.usd_amt = round(amt / inr * usd, 2)
        return self


class PaymentUpdate(PaymentBase):
    @model_validator(mode="after")
    def validate_and_compute(self):
        if self.received_dr > 0 and self.paid_cr > 0:
            raise ValueError("Cannot set both Received and Paid — enter only one")
        if not self.received_dr and not self.paid_cr:
            raise ValueError("Enter either Received [Dr.] or Paid [Cr.] amount")
        if not self.main_account or not self.main_account.strip():
            raise ValueError("Main Account is required")
        if not self.party_account or not self.party_account.strip():
            raise ValueError("Transaction Account is required")
        if self.received_dr > 0:
            self.vtype = "Receipt"
            self.amount = self.received_dr
        else:
            self.vtype = "Payment"
            self.amount = self.paid_cr
        inr = self.inr_rate or 85
        usd = self.usd_rate or 1
        amt = self.amount
        if self.currency == "INR":
            self.inr_amt = amt
            self.usd_amt = round(amt / inr, 2)
        elif self.currency == "USD":
            self.usd_amt = amt
            self.inr_amt = round(amt * inr, 2)
        else:
            self.inr_amt = round(amt * inr, 2)
            self.usd_amt = round(amt / inr * usd, 2)
        return self


class PaymentOut(PaymentBase):
    id: str
    company_id: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Journal Entry ────────────────────────────────────────

class JournalEntryBase(BaseModel):
    vtype: str = "Journal"
    date: date
    credit_account: Optional[str] = None
    debit_account: Optional[str] = None
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    amount: float = 0
    inr_amt: float = 0
    usd_amt: float = 0
    aed_amt: float = 0
    description: Optional[str] = None
    narration: Optional[str] = None


class JournalEntryCreate(JournalEntryBase):
    pass


class JournalEntryUpdate(JournalEntryBase):
    pass


class JournalEntryOut(JournalEntryBase):
    id: str
    company_id: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Income / Expense ─────────────────────────────────────

class IncomeExpenseBase(BaseModel):
    ie_type: str = "Expense"  # Income | Expense (derived)
    date: date
    main_account: Optional[str] = None
    trn_account: Optional[str] = None
    received_dr: float = 0
    paid_cr: float = 0
    currency: str = "USD"
    inr_rate: float = 85
    usd_rate: float = 1
    amount: float = 0
    inr_amt: float = 0
    usd_amt: float = 0
    description: Optional[str] = None


class IncomeExpenseCreate(IncomeExpenseBase):
    @model_validator(mode="after")
    def compute_derived(self):
        if self.received_dr > 0:
            self.ie_type = "Income"
            self.amount = self.received_dr
        elif self.paid_cr > 0:
            self.ie_type = "Expense"
            self.amount = self.paid_cr
        inr = self.inr_rate or 85
        usd = self.usd_rate or 1
        amt = self.amount
        if self.currency == "INR":
            self.inr_amt = amt
            self.usd_amt = round(amt / inr, 2)
        elif self.currency == "USD":
            self.usd_amt = amt
            self.inr_amt = round(amt * inr, 2)
        else:
            self.inr_amt = round(amt * inr, 2)
            self.usd_amt = round(amt / inr * usd, 2)
        return self


class IncomeExpenseUpdate(IncomeExpenseBase):
    @model_validator(mode="after")
    def compute_derived(self):
        if self.received_dr > 0:
            self.ie_type = "Income"
            self.amount = self.received_dr
        elif self.paid_cr > 0:
            self.ie_type = "Expense"
            self.amount = self.paid_cr
        inr = self.inr_rate or 85
        usd = self.usd_rate or 1
        amt = self.amount
        if self.currency == "INR":
            self.inr_amt = amt
            self.usd_amt = round(amt / inr, 2)
        elif self.currency == "USD":
            self.usd_amt = amt
            self.inr_amt = round(amt * inr, 2)
        else:
            self.inr_amt = round(amt * inr, 2)
            self.usd_amt = round(amt / inr * usd, 2)
        return self


class IncomeExpenseOut(IncomeExpenseBase):
    id: str
    company_id: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
