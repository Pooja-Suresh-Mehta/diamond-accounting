"""Seed script: creates tables, demo company, user, and sample diamonds."""
import asyncio
import random
from datetime import date, timedelta
from app.database import engine, async_session, Base
from app.models.models import Company, Office, User, Diamond, AccountMaster
from app.auth import hash_password

SHAPES = ["BR", "PR", "EM", "MQ", "OV", "Pear", "RA", "Cushion Modified", "AS", "HE"]
COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]
CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1"]
CUTS = ["EX", "VG", "G", "F"]
POLISHES = ["EX", "VG", "G", "F"]
SYMMETRIES = ["EX", "VG", "G", "F"]
LABS = ["GIA", "IGI", "HRD", "AGS", "GCAL"]
FLOU = ["N", "F", "M", "S", "VS"]
FL_COLORS = ["B", "W", "Y"]
MILKY = ["None", "M1", "M2"]
SHADES = ["None", "White", "Yellow", "Brown", "Faint Brown"]
STATUSES = ["OnHand", "OnMemo", "Sold", "InTransit", "MemoIn", "PartyHold", "IntMemo"]
HOLD_STATUSES = ["Hold", "Unhold"]
STONE_TYPES = ["Single", "Parcel"]
OFFICES = ["Mumbai HQ", "Surat Office", "New York Office", "Antwerp Office"]
ACCOUNT_SEEDS = [
    ("Brokerage", "Trading Expenses", "Expense Trading", "INR", "C", 0.00),
    ("IGST", "Trading Expenses", "Expense Trading", "INR", "C", 0.00),
    ("SGST", "Trading Expenses", "Expense Trading", "INR", "C", 0.00),
    ("CGST", "Trading Expenses", "Expense Trading", "INR", "C", 0.00),
    ("VAT", "Trading Expenses", "Expense Trading", "INR", "C", 0.00),
    ("Commission", "Propritors Capital", "Liabilities", "INR", "D", 0.00),
    ("SURAT", "CASH", "Supplier", "INR", "C", 0.00),
    ("Opening Stock", "Trading Expenses", "Expense Trading", "INR", "D", 0.00),
    ("Ex. Difference", "Office Expense", "Expense", "INR", "D", 0.00),
    ("Sale", "Sundry Creditors", "Income Trading", "INR", "C", 0.00),
    ("Purchase", "Sales And Comission", "Expense Trading", "INR", "D", 0.00),
    ("Misc Expenses", "Interest Earning", "Expense", "INR", "D", 0.00),
    ("Partner Capital", "Cash Balance", "Liabilities", "INR", "C", 0.00),
    ("Indusind Bank", "Local Customer", "Bank", "INR", "D", 0.00),
    ("CASH", "Outside Customer", "Cash", "INR", "D", 0.00),
    ("Unsequred Taken Loan", "Bank Balance", "Loan Taken", "INR", "D", 0.00),
    ("Sequred Taken Loan", "Bank Balance", "Loan Taken", "INR", "D", 0.00),
    ("Outside Supplier", "Propritors Capital", "Overseas Supplier", "INR", "D", 0.00),
    ("Local Supplier", "Propritors Capital", "Supplier", "INR", "D", 0.00),
    ("Outside Customer", "Sundry Debtors", "Overseas Customer", "INR", "D", 0.00),
    ("Local Customer", "Sundry Debtors", "Customer", "INR", "D", 0.00),
    ("Cash Balance", "Cash And Bank Balance", "Cash", "INR", "D", 0.00),
    ("Bank Balance", "Cash And Bank Balance", "Bank", "INR", "D", 0.00),
    ("Propritors Capital", "Reserves And Surplus", "Liabilities", "INR", "D", 0.00),
    ("Loan Taken", "Provision And Loan", "Loan Taken", "INR", "D", 0.00),
    ("Sundry Creditors", "Current Liabilities", "Liabilities", "INR", "D", 0.00),
    ("Brokers", "Sundry Debtors", "Broker", "INR", "D", 0.00),
    ("Sales And Comission", "Trading Income", "Income Trading", "INR", "D", 0.00),
    ("Interest Earning", "Non Trading Income", "Income", "INR", "D", 0.00),
    ("Purchase Overheads", "Trading Expenses", "Expense Trading", "INR", "D", 0.00),
    ("Office Expense", "Non Trading Expenses", "Expense", "INR", "D", 0.00),
    ("Marketing Expense", "Non Trading Expenses", "Expense", "INR", "D", 0.00),
    ("Financial Expense", "Non Trading Expenses", "Expense", "INR", "D", 0.00),
    ("Bad Debt And Depriciation", "Non Trading Expenses", "Expense", "INR", "D", 0.00),
    ("OFFICE STAFF", "Fixed Assets", "Customer", "INR", "D", 0.00),
    ("Loan Given", "Loan And Advances", "Loan Given", "INR", "D", 0.00),
    ("Sundry Debtors", "Current Assets", "Assets", "INR", "D", 0.00),
    ("Cash And Bank Balance", "Current Assets", "Assets", "INR", "D", 0.00),
    ("Reserves And Surplus", "Liabilities", "Liabilities", "INR", "D", 0.00),
    ("Provision And Loan", "Liabilities", "Liabilities", "INR", "D", 0.00),
    ("Current Liabilities", "Liabilities", "Liabilities", "INR", "D", 0.00),
    ("Trading Income", "Income", "Income Trading", "INR", "D", 0.00),
    ("Non Trading Income", "Income", "Income", "INR", "D", 0.00),
    ("Stock", "Expense", "Expense", "INR", "D", 0.00),
    ("Trading Expenses", "Expense", "Expense Trading", "INR", "D", 0.00),
    ("Non Trading Expenses", "Expense", "Expense", "INR", "D", 0.00),
    ("Loan And Advances", "Assets", "Assets", "INR", "D", 0.00),
    ("Current Assets", "Assets", "Assets", "INR", "D", 0.00),
    ("Fixed Assets", "Assets", "Assets", "INR", "D", 0.00),
    ("Expense", "[NONE]", "Expense", "INR", "D", 0.00),
    ("Income", "[NONE]", "Income", "INR", "D", 0.00),
    ("Liabilities", "[NONE]", "Liabilities", "INR", "D", 0.00),
    ("Assets", "Assets", "Assets", "INR", "D", 0.00),
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Company
        company = Company(name="Poojan Gems", address="Mumbai, India", phone="+91-22-12345678", email="info@poojangems.com")
        db.add(company)
        await db.flush()

        # Offices
        offices = []
        for oname in OFFICES:
            o = Office(company_id=company.id, name=oname, location=oname)
            db.add(o)
            offices.append(o)
        await db.flush()

        # Admin user
        admin = User(
            company_id=company.id,
            username="admin",
            hashed_password=hash_password("admin123"),
            full_name="Admin User",
            role="admin",
        )
        db.add(admin)

        # Demo user
        demo = User(
            company_id=company.id,
            username="demo",
            hashed_password=hash_password("demo123"),
            full_name="Demo User",
            role="user",
        )
        db.add(demo)

        # Account master seed data (editable system chart of accounts)
        for name, under_group, account_type, curr, drcr, opening in ACCOUNT_SEEDS:
            db.add(AccountMaster(
                company_id=company.id,
                entry_type="Group" if name in {
                    "Expense", "Income", "Liabilities", "Assets", "Current Assets", "Fixed Assets",
                    "Loan And Advances", "Trading Expenses", "Non Trading Expenses", "Trading Income",
                    "Non Trading Income", "Current Liabilities", "Provision And Loan", "Reserves And Surplus",
                    "Cash And Bank Balance", "Sundry Debtors"
                } else "Account",
                account_group_name=name,
                account_name=name,
                under_group_name=under_group,
                account_type=account_type,
                currency=curr,
                opening_balance=opening,
                balance_type="Credit" if drcr == "C" else "Debit",
                country="INDIA",
                is_system=True,
                allow_zero_opening_balance=True,
            ))

        # Sample diamonds (200)
        for i in range(1, 201):
            carats = round(random.uniform(0.18, 12.0), 2)
            rap = round(random.uniform(2000, 30000), 2)
            back = round(random.uniform(-60, -5), 2)
            ppc = round(rap * (1 + back / 100), 2)
            total = round(ppc * carats, 2)

            d = Diamond(
                company_id=company.id,
                office_id=random.choice(offices).id,
                lot_no=f"LOT-{i:05d}",
                cert_no=f"CERT-{random.randint(100000, 999999)}",
                sr_no=f"SR-{i:05d}",
                kapan_no=f"KP-{random.randint(1, 50):03d}",
                packet_no=f"PKT-{i:05d}",
                item_code=f"ITM-{i:05d}",
                item_serial_no=f"ISN-{i:05d}",
                status=random.choice(STATUSES),
                hold_status=random.choice(HOLD_STATUSES),
                stone_type=random.choice(STONE_TYPES),
                is_sold=random.random() < 0.15,
                shape=random.choice(SHAPES),
                color_group=random.choice(["D", "DEF", "GH", "IJ", "KLMN"]),
                color=random.choice(COLORS),
                clarity=random.choice(CLARITIES),
                cut=random.choice(CUTS),
                polish=random.choice(POLISHES),
                symmetry=random.choice(SYMMETRIES),
                lab=random.choice(LABS),
                carats=carats,
                fluorescence=random.choice(FLOU),
                fl_color=random.choice(FL_COLORS),
                milky=random.choice(MILKY),
                shade=random.choice(SHADES),
                length=round(random.uniform(3.0, 15.0), 2),
                width=round(random.uniform(3.0, 15.0), 2),
                depth=round(random.uniform(2.0, 10.0), 2),
                depth_pct=round(random.uniform(55, 70), 1),
                table_pct=round(random.uniform(52, 65), 1),
                lw_ratio=round(random.uniform(1.0, 2.0), 2),
                crown_angle=round(random.uniform(33, 36), 1),
                crown_height=round(random.uniform(13, 17), 1),
                pavilion_angle=round(random.uniform(40, 42), 1),
                pavilion_height=round(random.uniform(42, 44), 1),
                rap_price=rap,
                back_pct=back,
                price_per_carat=ppc,
                total_price=total,
                group_name=f"Group-{random.randint(1, 5)}",
                item_group=f"IG-{random.randint(1, 10)}",
                location=random.choice(["Mumbai", "Surat", "New York", "Antwerp"]),
                purchase_date=date.today() - timedelta(days=random.randint(1, 365)),
                entry_date=date.today() - timedelta(days=random.randint(0, 30)),
                lab_in_date=date.today() - timedelta(days=random.randint(30, 90)),
                lab_out_date=date.today() - timedelta(days=random.randint(1, 30)),
                status_date=date.today() - timedelta(days=random.randint(0, 10)),
            )
            db.add(d)

        await db.commit()
        print(f"✅ Seeded: 1 company, {len(OFFICES)} offices, 2 users, 200 diamonds, {len(ACCOUNT_SEEDS)} accounts")
        print(f"   Login: company='Poojan Gems', user='admin', pass='admin123'")


if __name__ == "__main__":
    asyncio.run(seed())
