import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
    ForeignKey, Text, Enum as SAEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


def new_uuid():
    return str(uuid.uuid4())


# ── Enums ──────────────────────────────────────────────

class StoneStatus(str, enum.Enum):
    ON_HAND = "OnHand"
    ON_MEMO = "OnMemo"
    SOLD = "Sold"
    IN_TRANSIT = "InTransit"
    MEMO_IN = "MemoIn"
    PARTY_HOLD = "PartyHold"
    INT_MEMO = "IntMemo"


class HoldStatus(str, enum.Enum):
    HOLD = "Hold"
    UNHOLD = "Unhold"


class StoneType(str, enum.Enum):
    SINGLE = "Single"
    PARCEL = "Parcel"


# ── Company ────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(200), unique=True, nullable=False)
    address = Column(Text)
    phone = Column(String(20))
    email = Column(String(100))
    gst_no = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="company")
    offices = relationship("Office", back_populates="company")
    diamonds = relationship("Diamond", back_populates="company")


# ── Office ─────────────────────────────────────────────

class Office(Base):
    __tablename__ = "offices"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    location = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="offices")
    diamonds = relationship("Diamond", back_populates="office")

    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_office_company_name"),
    )


# ── User ───────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    username = Column(String(50), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(String(20), default="user")  # admin, user, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="users")

    __table_args__ = (
        UniqueConstraint("company_id", "username", name="uq_user_company_username"),
    )


# ── Diamond (Main Inventory) ──────────────────────────

class Diamond(Base):
    __tablename__ = "diamonds"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    office_id = Column(String(36), ForeignKey("offices.id"))

    # Identifiers
    lot_no = Column(String(50), index=True)
    cert_no = Column(String(50), index=True)
    sr_no = Column(String(50))
    kapan_no = Column(String(50))
    packet_no = Column(String(50))
    item_code = Column(String(50))
    item_serial_no = Column(String(50))

    # Status
    status = Column(String(20), default="OnHand", index=True)
    hold_status = Column(String(10), default="Unhold")
    stone_type = Column(String(10), default="Single")
    is_sold = Column(Boolean, default=False, index=True)

    # Diamond specs
    shape = Column(String(30), index=True)
    color_group = Column(String(10))
    color = Column(String(10), index=True)
    clarity = Column(String(10), index=True)
    cut = Column(String(10))       # Prop/Cut grade
    polish = Column(String(10))
    symmetry = Column(String(10))
    lab = Column(String(10), index=True)

    # Size / Weight
    carats = Column(Float, index=True)
    size_range = Column(String(20))

    # Fluorescence
    fluorescence = Column(String(5))
    fl_color = Column(String(5))

    # Visual attributes
    milky = Column(String(10))
    shade = Column(String(20))
    luster = Column(String(20))
    natts = Column(String(20))
    is_rough = Column(Boolean, default=False)
    hearts_arrows = Column(Boolean, default=False)

    # Measurements
    length = Column(Float)
    width = Column(Float)
    depth = Column(Float)

    # Proportions
    depth_pct = Column(Float)
    table_pct = Column(Float)
    lw_ratio = Column(Float)
    crown_angle = Column(Float)
    crown_height = Column(Float)
    pavilion_angle = Column(Float)
    pavilion_height = Column(Float)

    # Pricing
    rap_price = Column(Float)       # Rapaport price per carat
    back_pct = Column(Float)        # Discount %
    price_per_carat = Column(Float)
    total_price = Column(Float)

    # Grouping
    group_name = Column(String(50))
    pair_id = Column(String(50))
    box_name = Column(String(50))
    item_group = Column(String(50))
    location = Column(String(100))

    # Media
    image_url = Column(String(500))
    video_url = Column(String(500))
    cert_url = Column(String(500))
    key_to_symbols = Column(Text)

    # Dates
    purchase_date = Column(Date)
    lab_in_date = Column(Date)
    lab_out_date = Column(Date)
    status_date = Column(Date)
    entry_date = Column(Date, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="diamonds")
    office = relationship("Office", back_populates="diamonds")

    __table_args__ = (
        Index("ix_diamond_search", "company_id", "shape", "color", "clarity", "carats"),
        Index("ix_diamond_lot", "company_id", "lot_no"),
    )


# ── Account Master ──────────────────────────────────────

class AccountMaster(Base):
    __tablename__ = "account_masters"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    # Account Details
    entry_type = Column(String(20), nullable=False, default="Account")  # Account | Group
    account_group_name = Column(String(200), nullable=False)
    account_name = Column(String(200))
    short_name = Column(String(100))
    under_group_name = Column(String(200), nullable=False)
    account_type = Column(String(100), nullable=False)
    currency = Column(String(10), default="INR")
    inr_base_rate = Column(Float, default=85)
    usd_base_rate = Column(Float, default=1)
    opening_balance = Column(Float, nullable=False)
    balance_type = Column(String(10), default="Debit")  # Debit | Credit
    interest_pct = Column(Float)
    discount_pct = Column(Float)
    credit_limit = Column(Float)
    due_days = Column(Integer)
    grace_period = Column(Integer)
    term = Column(String(100))
    term_pct = Column(Float)
    term_per = Column(Float)
    markup = Column(Float)
    local_language_name = Column(String(200))
    local_language_contact_person = Column(String(200))
    local_language_address = Column(Text)
    website_user = Column(String(200))

    # KYC Details
    address1 = Column(String(300))
    address2 = Column(String(300))
    address3 = Column(String(300))
    zipcode = Column(String(20))
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    area = Column(String(100))
    mobile = Column(String(30))
    office_phone = Column(String(30))
    home_phone = Column(String(30))
    fax = Column(String(100))
    qqid = Column(String(100))
    email = Column(String(200))
    website = Column(String(300))
    skype = Column(String(100))
    broker_pct = Column(Float)
    broker_per = Column(Float)
    through = Column(String(200))
    contact_person = Column(String(200))
    agent = Column(String(200))
    reference_party_name1 = Column(String(200))
    reference_party_name2 = Column(String(200))
    reference_phone1 = Column(String(30))
    reference_phone2 = Column(String(30))
    reference_comments1 = Column(Text)
    reference_comments2 = Column(Text)

    # Financial Details
    bank_account_no = Column(String(100))
    bank_account_detail = Column(Text)
    bank_routing = Column(String(100))
    bank_swift_code = Column(String(100))
    pan_no = Column(String(100))
    gst_no = Column(String(100))
    tin_number = Column(String(100))
    cin_no = Column(String(100))
    gr_no = Column(String(100))
    cst_no = Column(String(100))
    remarks = Column(Text)
    compliance = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    email_inventory = Column(Boolean, default=False)

    # Shipping Details
    shipping_name = Column(String(200))
    shipping_address1 = Column(Text)
    shipping_zipcode = Column(String(20))
    shipping_city = Column(String(100))
    shipping_state = Column(String(100))
    shipping_country = Column(String(100))
    shipping_area = Column(String(100))
    shipping_phone = Column(String(30))
    shipping_fax = Column(String(100))

    # Meta
    is_system = Column(Boolean, default=False)
    allow_zero_opening_balance = Column(Boolean, default=False)
    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company")

    __table_args__ = (
        UniqueConstraint("company_id", "account_group_name", name="uq_account_master_company_name"),
        Index("ix_account_master_company_name", "company_id", "account_group_name"),
    )


class DropdownOption(Base):
    __tablename__ = "dropdown_options"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    field_name = Column(String(50), nullable=False)   # e.g. "shape", "color", "clarity", "size", "sieve"
    value = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "field_name", "value", name="uq_dropdown_option"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    module = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)
    entity_id = Column(String(36))
    status = Column(String(20), nullable=False)  # success | failure
    message = Column(Text)
    payload = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ParcelMaster(Base):
    __tablename__ = "parcel_masters"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    lot_no = Column(String(100), nullable=False)
    item_name = Column(String(200), nullable=False)
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve_mm = Column(String(100))
    stock_group_id = Column(String(100))
    description = Column(Text)
    stock_type = Column(String(100), default="Natural Diamond")
    stock_subtype = Column(String(100), default="Polished")
    grown_process_type = Column(String(100), default="Natural")

    opening_weight_carats = Column(Float, default=0)
    opening_pcs = Column(Integer, default=0)
    usd_to_inr_rate = Column(Float, default=0)

    # Running balance fields (updated by transactions)
    purchased_weight = Column(Float, default=0)
    purchased_pcs = Column(Integer, default=0)
    sold_weight = Column(Float, default=0)
    sold_pcs = Column(Integer, default=0)
    on_memo_weight = Column(Float, default=0)
    on_memo_pcs = Column(Integer, default=0)
    consignment_weight = Column(Float, default=0)
    consignment_pcs = Column(Integer, default=0)

    purchase_cost_price_usd_carats = Column(Float, default=0)
    purchase_cost_usd_amount = Column(Float, default=0)
    purchase_cost_price_inr_carats = Column(Float, default=0)
    purchase_cost_inr_amount = Column(Float, default=0)
    asking_price_usd_carats = Column(Float, default=0)
    asking_usd_amount = Column(Float, default=0)
    asking_price_inr_carats = Column(Float, default=0)
    asking_inr_amount = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("company_id", "lot_no", name="uq_parcel_master_company_lot"),
        Index("ix_parcel_master_company_lot", "company_id", "lot_no"),
    )


class ParcelPurchase(Base):
    __tablename__ = "parcel_purchases"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    bill_no = Column(String(100))
    date = Column(Date, nullable=False)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    comm_agent = Column(String(200))
    com_pct = Column(Float, default=0)
    com_amount = Column(Float, default=0)
    save_grading = Column(Boolean, default=False)
    purchase_last_year = Column(Boolean, default=False)
    broker = Column(String(200))
    bro_pct = Column(Float, default=0)
    bro_amount = Column(Float, default=0)
    description = Column(Text)
    consignment_no = Column(String(100))

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("ParcelPurchaseItem", back_populates="purchase", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_purchase_company_invoice"),
        Index("ix_purchase_company_date", "company_id", "date"),
    )


class ParcelPurchaseItem(Base):
    __tablename__ = "parcel_purchase_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    purchase_id = Column(String(36), ForeignKey("parcel_purchases.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve = Column(String(100))
    issue_carats = Column(Float, default=0)
    reje_pct = Column(Float, default=0)
    rejection = Column(Float, default=0)
    selected_carat = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    purchase = relationship("ParcelPurchase", back_populates="items")


class ParcelPurchaseReturn(Base):
    __tablename__ = "parcel_purchase_returns"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    memo_number = Column(String(100), nullable=False, index=True)
    inv_bill_no = Column(String(100))
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    comm_agent = Column(String(200))
    com_pct = Column(Float, default=0)
    com_amount = Column(Float, default=0)
    save_grading = Column(Boolean, default=False)
    purchase_last_year = Column(Boolean, default=False)
    outstanding = Column(Boolean, default=False)
    broker = Column(String(200))
    bro_pct = Column(Float, default=0)
    bro_amount = Column(Float, default=0)
    description = Column(Text)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("ParcelPurchaseReturnItem", back_populates="purchase_return", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "memo_number", name="uq_purchase_return_company_memo"),
        Index("ix_purchase_return_company_date", "company_id", "date"),
    )


class ParcelPurchaseReturnItem(Base):
    __tablename__ = "parcel_purchase_return_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    purchase_return_id = Column(String(36), ForeignKey("parcel_purchase_returns.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve = Column(String(100))
    issue_carats = Column(Float, default=0)
    reje_pct = Column(Float, default=0)
    rejection = Column(Float, default=0)
    selected_carat = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    purchase_return = relationship("ParcelPurchaseReturn", back_populates="items")


class MemoOut(Base):
    __tablename__ = "memo_outs"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    save_grading = Column(Boolean, default=False)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("MemoOutItem", back_populates="memo_out", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_memo_out_company_invoice"),
        Index("ix_memo_out_company_date", "company_id", "date"),
    )


class MemoOutItem(Base):
    __tablename__ = "memo_out_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    memo_out_id = Column(String(36), ForeignKey("memo_outs.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    weight = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    memo_out = relationship("MemoOut", back_populates="items")


# ── Memo Out Return ───────────────────────────────────────

class MemoOutReturn(Base):
    __tablename__ = "memo_out_returns"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    source_memo_number = Column(String(100), index=True)
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    save_grading = Column(Boolean, default=False)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("MemoOutReturnItem", back_populates="memo_out_return", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_memo_out_return_company_invoice"),
        Index("ix_memo_out_return_company_date", "company_id", "date"),
    )


class MemoOutReturnItem(Base):
    __tablename__ = "memo_out_return_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    memo_out_return_id = Column(String(36), ForeignKey("memo_out_returns.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    weight = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    memo_out_return = relationship("MemoOutReturn", back_populates="items")


# ── Sale ─────────────────────────────────────────────────

class Sale(Base):
    __tablename__ = "sales"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    bill_no = Column(String(100))
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    comm_agent = Column(String(200))
    com_pct = Column(Float, default=0)
    com_amount = Column(Float, default=0)
    save_grading = Column(Boolean, default=False)
    purchase_last_year = Column(Boolean, default=False)
    outstanding = Column(Boolean, default=False)
    broker = Column(String(200))
    bro_pct = Column(Float, default=0)
    bro_amount = Column(Float, default=0)
    description = Column(Text)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_sale_company_invoice"),
        Index("ix_sale_company_date", "company_id", "date"),
    )


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    sale_id = Column(String(36), ForeignKey("sales.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve = Column(String(100))
    issue_carats = Column(Float, default=0)
    reje_pct = Column(Float, default=0)
    rejection = Column(Float, default=0)
    selected_carat = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    cogs = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    sale = relationship("Sale", back_populates="items")


# ── Sale Return ───────────────────────────────────────────

class SaleReturn(Base):
    __tablename__ = "sale_returns"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    bill_no = Column(String(100))
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    comm_agent = Column(String(200))
    com_pct = Column(Float, default=0)
    com_amount = Column(Float, default=0)
    save_grading = Column(Boolean, default=False)
    purchase_last_year = Column(Boolean, default=False)
    outstanding = Column(Boolean, default=False)
    broker = Column(String(200))
    bro_pct = Column(Float, default=0)
    bro_amount = Column(Float, default=0)
    description = Column(Text)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("SaleReturnItem", back_populates="sale_return", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_sale_return_company_invoice"),
        Index("ix_sale_return_company_date", "company_id", "date"),
    )


class SaleReturnItem(Base):
    __tablename__ = "sale_return_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    sale_return_id = Column(String(36), ForeignKey("sale_returns.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve = Column(String(100))
    issue_carats = Column(Float, default=0)
    reje_pct = Column(Float, default=0)
    rejection = Column(Float, default=0)
    selected_carat = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    sale_return = relationship("SaleReturn", back_populates="items")


# ── Consignment (In) ─────────────────────────────────────

class Consignment(Base):
    __tablename__ = "consignments"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    save_grading = Column(Boolean, default=False)
    broker = Column(String(200))
    bro_pct = Column(Float, default=0)
    bro_amount = Column(Float, default=0)
    description = Column(Text)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    aed_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)
    aed_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("ConsignmentItem", back_populates="consignment", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_consignment_company_invoice"),
        Index("ix_consignment_company_date", "company_id", "date"),
    )


class ConsignmentItem(Base):
    __tablename__ = "consignment_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    consignment_id = Column(String(36), ForeignKey("consignments.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve = Column(String(100))
    issue_carats = Column(Float, default=0)
    reje_pct = Column(Float, default=0)
    rejection = Column(Float, default=0)
    selected_carat = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    consignment = relationship("Consignment", back_populates="items")


class ConsignmentReturn(Base):
    __tablename__ = "consignment_returns"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    source_consignment_number = Column(String(100), index=True)
    date = Column(Date, nullable=False)
    print_date = Column(Date)
    purchase_type = Column(String(50), default="LOCAL")
    sub_type = Column(String(100))
    category = Column(String(100), default="Natural Diamond")
    party = Column(String(200))
    due_days = Column(Integer, default=0)
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    save_grading = Column(Boolean, default=False)
    broker = Column(String(200))
    bro_pct = Column(Float, default=0)
    bro_amount = Column(Float, default=0)
    description = Column(Text)

    plus_minus_amount = Column(Float, default=0)
    net_amount = Column(Float, default=0)
    m_currency_net_amount = Column(Float, default=0)
    cgst_pct = Column(Float, default=0)
    cgst_amount = Column(Float, default=0)
    sgst_pct = Column(Float, default=0)
    sgst_amount = Column(Float, default=0)
    igst_pct = Column(Float, default=0)
    igst_amount = Column(Float, default=0)
    vat_pct = Column(Float, default=0)
    vat_amount = Column(Float, default=0)
    inr_final_amount = Column(Float, default=0)
    usd_final_amount = Column(Float, default=0)
    aed_final_amount = Column(Float, default=0)
    transaction_final_amount = Column(Float, default=0)
    payment_status = Column(String(50), default="Pending")

    total_carats = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)
    aed_amt = Column(Float, default=0)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("ConsignmentReturnItem", back_populates="consignment_return", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_consignment_return_company_invoice"),
        Index("ix_consignment_return_company_date", "company_id", "date"),
    )


class ConsignmentReturnItem(Base):
    __tablename__ = "consignment_return_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    consignment_return_id = Column(String(36), ForeignKey("consignment_returns.id"), nullable=False, index=True)
    lot_number = Column(String(100))
    item_name = Column(String(200))
    shape = Column(String(100))
    color = Column(String(100))
    clarity = Column(String(100))
    size = Column(String(100))
    sieve = Column(String(100))
    issue_carats = Column(Float, default=0)
    reje_pct = Column(Float, default=0)
    rejection = Column(Float, default=0)
    selected_carat = Column(Float, default=0)
    pcs = Column(Integer, default=0)
    rate = Column(Float, default=0)
    usd_rate = Column(Float, default=0)
    less1 = Column(Float, default=0)
    less2 = Column(Float, default=0)
    less3 = Column(Float, default=0)
    amount = Column(Float, default=0)

    consignment_return = relationship("ConsignmentReturn", back_populates="items")


# ── Financial Transactions ────────────────────────────────

class Loan(Base):
    __tablename__ = "loans"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    loan_type = Column(String(20), nullable=False)  # Given | Taken
    inv_no = Column(String(50))
    date = Column(Date, nullable=False, index=True)
    renew_date = Column(Date)
    outstanding = Column(Boolean, default=False)
    party = Column(String(200))
    due_date = Column(Date)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    broker = Column(String(200))
    broker_pct = Column(Float, default=0)
    amount = Column(Float, default=0)
    interest_pct = Column(Float, default=0)
    interest = Column(Float, default=0)
    divide_days = Column(Integer, default=365)
    rec_from_party = Column(String(200))
    due_days = Column(Integer, default=0)   # DueDays in reference — days between date and due_date
    description = Column(Text)              # Disc field in reference
    # kept for backward compat / ledger
    from_account = Column(String(200))
    to_account = Column(String(200))
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)
    aed_amt = Column(Float, default=0)
    narration = Column(Text)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_loan_company_date", "company_id", "date"),
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    vtype = Column(String(20), nullable=False)  # Payment | Receipt
    pay_type = Column(String(20), default="Regular")  # Regular | ExDiff
    date = Column(Date, nullable=False, index=True)
    main_account = Column(String(200))   # Cash / Bank account
    party_account = Column(String(200))  # Transaction Account
    received_dr = Column(Float, default=0)   # Received [Dr.]
    paid_cr = Column(Float, default=0)       # Paid [Cr.]
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    auto_adjust = Column(Boolean, default=False)
    description = Column(Text)
    # kept for backward compat
    amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)
    aed_amt = Column(Float, default=0)
    exchange_diff = Column(Float, default=0)
    has_exchange_diff = Column(Boolean, default=False)
    narration = Column(Text)
    ref_invoice = Column(String(100))

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_payment_company_date", "company_id", "date"),
    )


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    vtype = Column(String(50), default="Journal")
    date = Column(Date, nullable=False, index=True)
    credit_account = Column(String(200))
    debit_account = Column(String(200))
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)
    aed_amt = Column(Float, default=0)
    description = Column(Text)
    narration = Column(Text)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_journal_entry_company_date", "company_id", "date"),
    )


class IncomeExpense(Base):
    __tablename__ = "income_expenses"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    ie_type = Column(String(20), default="Expense")  # Income | Expense (derived from received_dr/paid_cr)
    date = Column(Date, nullable=False, index=True)
    main_account = Column(String(200))   # CrAccount / mainacc
    trn_account = Column(String(200))    # Party / trnacc
    received_dr = Column(Float, default=0)
    paid_cr = Column(Float, default=0)
    currency = Column(String(10), default="USD")
    inr_rate = Column(Float, default=85)
    usd_rate = Column(Float, default=1)
    amount = Column(Float, default=0)
    inr_amt = Column(Float, default=0)
    usd_amt = Column(Float, default=0)
    description = Column(Text)
    # legacy columns kept for migration compat
    account = Column(String(200))
    narration = Column(Text)

    created_by_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_income_expense_company_date", "company_id", "date"),
    )


# ── Ledger Entry (Double-Entry Accounting) ────────────────

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String(36), primary_key=True, default=new_uuid)
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, index=True)

    transaction_type = Column(String(50), nullable=False, index=True)  # purchase, sale, memo_out, purchase_return, sale_return, memo_out_return
    transaction_id = Column(String(36), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    account_name = Column(String(200), nullable=False)
    debit = Column(Float, default=0)
    credit = Column(Float, default=0)
    narration = Column(Text)

    is_reversed = Column(Boolean, default=False)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ledger_company_date", "company_id", "date"),
        Index("ix_ledger_transaction", "company_id", "transaction_type", "transaction_id"),
    )
