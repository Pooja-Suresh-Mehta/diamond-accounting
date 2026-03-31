"""
Scrape our local Poojan Gems app and compare against the reference app scraped data.
"""
import asyncio, json, os, re
from playwright.async_api import async_playwright

LOCAL_URL = "http://localhost:5173"
OUT = "/Users/pooja.mehta/Projects/poojan_gems/scraped_local"
REF = "/Users/pooja.mehta/Projects/poojan_gems/scraped_ref2"
DIFF_OUT = "/Users/pooja.mehta/Projects/poojan_gems/comparison_report.md"
os.makedirs(OUT, exist_ok=True)

def safe_name(s):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', s).strip('_')[:60]

async def screenshot(page, name):
    path_base = f"{OUT}/{name}"
    await page.screenshot(path=f"{path_base}.png", full_page=True)
    html = await page.content()
    with open(f"{path_base}.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"    saved: {name}")

async def get_form_fields(page):
    fields = []
    inputs = page.locator("input:visible, textarea:visible, select:visible")
    count = await inputs.count()
    for i in range(count):
        inp = inputs.nth(i)
        try:
            info = await inp.evaluate("""el => {
                const tag = el.tagName;
                const type = el.getAttribute('type') || '';
                const name = el.getAttribute('name') || '';
                const id = el.getAttribute('id') || '';
                const ph = el.getAttribute('placeholder') || '';
                let label = '';
                if (el.id) {
                    const lbl = document.querySelector('label[for="'+el.id+'"]');
                    if (lbl) label = lbl.textContent.trim();
                }
                if (!label) {
                    const parent = el.closest('.form-group, .form-field, label, div');
                    if (parent) {
                        const lbl = parent.querySelector('label');
                        if (lbl) label = lbl.textContent.trim();
                    }
                }
                return { tag, type, name, id, placeholder: ph, label };
            }""")
            fields.append(info)
        except:
            pass
    return fields

async def get_select_options(page):
    selects = page.locator("select:visible")
    count = await selects.count()
    data = {}
    for i in range(count):
        sel = selects.nth(i)
        try:
            name = await sel.get_attribute("name") or await sel.get_attribute("id") or f"sel_{i}"
            opts = await sel.locator("option").all_inner_texts()
            data[name] = opts
        except:
            pass
    return data

async def get_table_columns(page):
    tables = page.locator("table:visible")
    count = await tables.count()
    all_cols = []
    for i in range(count):
        tbl = tables.nth(i)
        try:
            headers = await tbl.locator("th").all_inner_texts()
            if headers:
                all_cols.append(headers)
        except:
            pass
    return all_cols

async def get_page_text_labels(page):
    """Get all visible label/span text to understand page structure."""
    labels = await page.evaluate("""() => {
        const els = document.querySelectorAll('label, h1, h2, h3, h4, h5, h6, .tab, [role="tab"], button');
        return [...els].filter(e => e.offsetParent !== null).map(e => ({
            tag: e.tagName,
            text: e.textContent.trim().substring(0, 80),
            class: e.className.substring(0, 60)
        })).filter(e => e.text.length > 0 && e.text.length < 80);
    }""")
    return labels

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # ---- LOGIN ----
        print("Logging in to local app...")
        await page.goto(LOCAL_URL, wait_until="networkidle", timeout=15000)
        await asyncio.sleep(2)
        await screenshot(page, "00_login")

        # Fill company name, username, password
        try:
            # Company name field
            company_input = page.locator("input[placeholder*='company' i]").first
            await company_input.fill("Poojan Gems")

            # Username
            username_input = page.locator("input[placeholder*='user' i]").first
            await username_input.fill("admin")

            # Password
            password_input = page.locator("input[type='password']").first
            await password_input.fill("admin123")

            await screenshot(page, "00_login_filled")

            # Click sign in
            await page.locator("button[type='submit'], button:has-text('Sign')").first.click()
            await page.wait_for_load_state("networkidle", timeout=10000)
            await asyncio.sleep(3)
        except Exception as e:
            print(f"  Login error: {e}")

        await screenshot(page, "00_dashboard")
        current_url = page.url
        print(f"  Current URL after login: {current_url}")

        # Check if we're still on login
        if "login" in current_url.lower():
            print("  ERROR: Still on login page! Check credentials.")
            await browser.close()
            return

        # ---- DISCOVER ALL SIDEBAR LINKS ----
        print("\nDiscovering sidebar navigation...")

        # Click all expandable buttons in sidebar to reveal links
        sidebar_buttons = page.locator("aside button")
        btn_count = await sidebar_buttons.count()
        print(f"  Found {btn_count} sidebar buttons, clicking to expand...")
        for i in range(btn_count):
            try:
                btn = sidebar_buttons.nth(i)
                text_content = (await btn.inner_text()).strip()
                # Only click section expanders, not the logout/theme buttons
                if text_content and any(kw in text_content for kw in ["Masters", "Parcel", "Financial", "Reports", "Transaction", "Utilities"]):
                    await btn.click()
                    await asyncio.sleep(0.3)
                    print(f"    Clicked: {text_content}")
            except:
                pass
        await asyncio.sleep(1)
        await screenshot(page, "00_sidebar_all_expanded")

        # Now gather all links — React NavLink renders as <a> tags
        all_anchors = page.locator("aside a, nav a")
        a_count = await all_anchors.count()
        print(f"  Found {a_count} sidebar anchors (total)")

        # Fallback: get all <a> tags on the page
        if a_count == 0:
            all_anchors = page.locator("a")
            a_count = await all_anchors.count()
            print(f"  Fallback: found {a_count} total anchors on page")

        nav_links = []
        seen = set()
        for i in range(a_count):
            a = all_anchors.nth(i)
            try:
                href = await a.get_attribute("href") or ""
                text = (await a.inner_text()).strip()
                if text and href and href != "#" and "logout" not in href.lower() and href not in seen:
                    seen.add(href)
                    nav_links.append({"href": href, "text": text})
            except:
                pass

        print(f"\nFound {len(nav_links)} navigation links:")
        for i, l in enumerate(nav_links):
            print(f"  {i+1}. [{l['text']}] -> {l['href']}")

        with open(f"{OUT}/navigation.json", "w") as f:
            json.dump(nav_links, f, indent=2)

        # ---- Define all pages to visit (including sub-routes like /add) ----
        # Combine nav links with known sub-routes
        pages_to_visit = []
        for link in nav_links:
            pages_to_visit.append(link)

        # Add /add routes for transaction pages
        add_routes = [
            {"href": "/parcel/purchase/add", "text": "Purchase (Add Form)"},
            {"href": "/parcel/purchase-return/add", "text": "Purchase Return (Add Form)"},
            {"href": "/parcel/consignment-in/add", "text": "Consignment In (Add Form)"},
            {"href": "/parcel/consignment-in-return/add", "text": "Consignment In Return (Add Form)"},
            {"href": "/parcel/memo-out/add", "text": "Memo Out (Add Form)"},
            {"href": "/parcel/memo-out-return/add", "text": "Memo Out Return (Add Form)"},
            {"href": "/parcel/sale/add", "text": "Sale (Add Form)"},
            {"href": "/parcel/sale-return/add", "text": "Sale Return (Add Form)"},
            {"href": "/financial/loan-given/add", "text": "Loan Given (Add Form)"},
            {"href": "/financial/loan-taken/add", "text": "Loan Taken (Add Form)"},
            {"href": "/financial/payment-receipts/add", "text": "Payment Receipts (Add Form)"},
            {"href": "/financial/journal-entries/add", "text": "Journal Entries (Add Form)"},
            {"href": "/financial/income-expense/add", "text": "Income Expense (Add Form)"},
        ]
        pages_to_visit.extend(add_routes)

        # ---- VISIT EACH PAGE ----
        local_pages = {}
        print(f"\nVisiting {len(pages_to_visit)} pages...\n")

        for idx, link in enumerate(pages_to_visit):
            page_label = safe_name(link["text"])
            page_name = f"{idx+1:02d}_{page_label}"
            href = link["href"]

            url = LOCAL_URL + href if href.startswith("/") else href

            print(f"[{idx+1}/{len(pages_to_visit)}] {link['text']} -> {url}")

            try:
                await page.goto(url, wait_until="networkidle", timeout=15000)
                await asyncio.sleep(2)
                await screenshot(page, page_name)

                page_data = {
                    "name": link["text"],
                    "href": href,
                    "fields": await get_form_fields(page),
                    "selects": await get_select_options(page),
                    "table_columns": await get_table_columns(page),
                    "labels": await get_page_text_labels(page),
                }

                # Check for tabs
                tab_sels = ["[role='tab']", "ul.nav-tabs li a", ".nav-tabs .nav-link",
                           "button[data-toggle='tab']", "a[data-toggle='tab']"]
                for sel in tab_sels:
                    tabs = page.locator(sel)
                    count = await tabs.count()
                    if count > 1:
                        print(f"  Found {count} tabs")
                        tab_info = []
                        for ti in range(count):
                            tab = tabs.nth(ti)
                            try:
                                tt = safe_name((await tab.inner_text()).strip())[:25] or f"tab{ti}"
                                await tab.click()
                                await asyncio.sleep(1.5)
                                await screenshot(page, f"{page_name}_tab_{tt}")
                                tab_fields = await get_form_fields(page)
                                tab_info.append({"tab": tt, "fields": tab_fields})
                            except Exception as e:
                                print(f"    Tab {ti} error: {e}")
                        page_data["tabs"] = tab_info
                        break

                with open(f"{OUT}/{page_name}_data.json", "w") as f:
                    json.dump(page_data, f, indent=2)

                local_pages[link["text"]] = page_data

            except Exception as e:
                print(f"  ERROR: {e}")
                local_pages[link["text"]] = {"name": link["text"], "href": href, "error": str(e)}

        # ---- COMPARE WITH REFERENCE ----
        print("\n" + "="*60)
        print("GENERATING COMPARISON REPORT")
        print("="*60 + "\n")

        # Load reference data
        ref_nav = []
        if os.path.exists(f"{REF}/navigation.json"):
            with open(f"{REF}/navigation.json") as f:
                ref_nav = json.load(f)

        ref_pages = {}
        for item in ref_nav:
            text = item["text"]
            ref_pages[text] = {"href": item["href"]}
            for fname in os.listdir(REF):
                if fname.endswith("_fields.json") and safe_name(text) in fname:
                    with open(f"{REF}/{fname}") as f:
                        ref_pages[text]["fields"] = json.load(f)
                if fname.endswith("_selects.json") and safe_name(text) in fname:
                    with open(f"{REF}/{fname}") as f:
                        ref_pages[text]["selects"] = json.load(f)

        report = []
        report.append("# Reference vs Local App — Full Comparison Report\n")
        report.append(f"Generated automatically by Playwright scraping.\n")
        report.append(f"- **Reference app**: https://mvc.softsense.in (SoftOnCloud)")
        report.append(f"- **Local app**: http://localhost:5174 (Poojan Gems)")
        report.append(f"- Reference pages discovered: {len(ref_nav)}")
        report.append(f"- Local pages discovered: {len(nav_links)}\n")

        # ---- SIDEBAR COMPARISON ----
        report.append("---\n## 1. Sidebar / Navigation Structure\n")
        report.append("### Reference App Sidebar:")
        for item in ref_nav:
            if item["href"] == "NULL":
                report.append(f"\n**{item['text']}** (section)")
            else:
                report.append(f"  - {item['text']}")

        report.append("\n### Local App Sidebar:")
        for item in nav_links:
            report.append(f"  - {item['text']} -> `{item['href']}`")

        # ---- PAGE MAPPING ----
        # Map ref pages to local pages
        page_map = [
            # (ref_name, local_list_name, local_form_name, description)
            ("Parcel Dashboard", "Dashboard", None, "Dashboard"),
            ("Parcel Master", "Parcel Masters", None, "Parcel Master"),
            ("Account Group Master", "Account Master", None, "Account Master"),
            ("Purchase", "Purchase", "Purchase (Add Form)", "Parcel Purchase"),
            ("Purchase Return", "Purchase Return", "Purchase Return (Add Form)", "Purchase Return"),
            ("Consignment In", "Consignment In", "Consignment In (Add Form)", "Consignment In"),
            ("Consignment In Return", "Consignment In Return", "Consignment In Return (Add Form)", "Consignment In Return"),
            ("Memo Out", "Memo Out", "Memo Out (Add Form)", "Memo Out"),
            ("Memo Out Return", "Memo Out Return", "Memo Out Return (Add Form)", "Memo Out Return"),
            ("Sale", "Sale", "Sale (Add Form)", "Sale"),
            ("Sale Return", "Sale Return", "Sale Return (Add Form)", "Sale Return"),
            ("Loan Given", "Loan Given", "Loan Given (Add Form)", "Loan Given"),
            ("Loan Taken", "Loan Taken", "Loan Taken (Add Form)", "Loan Taken"),
            ("Payment & Receipts", "Payment / Receipt", "Payment Receipts (Add Form)", "Payment & Receipts"),
            ("Journal Entries", "Journal Entries", "Journal Entries (Add Form)", "Journal Entries"),
            ("Income Expense", "Income / Expense", "Income Expense (Add Form)", "Income/Expense"),
            ("Parcel Stock Report", "Parcel Reports", None, "Parcel Stock Report"),
            ("Parcel Purchase Report", "Parcel Reports", None, "Parcel Purchase Report"),
            ("Outstanding Report", "Financial Reports", None, "Outstanding Report"),
            ("Account Ledger", "Financial Reports", None, "Account Ledger"),
        ]

        report.append("\n---\n## 2. Page-by-Page Comparison\n")
        report.append("For each page, comparing: field count, field labels, dropdowns, tabs.\n")

        for ref_name, local_list, local_form, desc in page_map:
            ref_data = ref_pages.get(ref_name, {})
            # Use form page if available (has the actual fields), otherwise list page
            local_data = local_pages.get(local_form or local_list, local_pages.get(local_list, {}))

            ref_fields = ref_data.get("fields", [])
            local_fields = local_data.get("fields", [])

            def field_labels(fields):
                labels = set()
                for f in fields:
                    lbl = f.get("label") or f.get("placeholder") or f.get("name") or ""
                    lbl = lbl.strip()
                    if lbl and lbl not in ("", "Search", "search"):
                        labels.add(lbl)
                return labels

            ref_labels = field_labels(ref_fields)
            local_labels = field_labels(local_fields)

            report.append(f"\n### {desc}")
            report.append(f"| | Reference | Local |")
            report.append(f"|---|---|---|")
            report.append(f"| Page | {ref_name} | {local_form or local_list} |")
            report.append(f"| Fields | {len(ref_fields)} | {len(local_fields)} |")

            missing = ref_labels - local_labels
            extra = local_labels - ref_labels
            matching = ref_labels & local_labels

            if missing:
                report.append(f"\n**Missing in local** ({len(missing)}):")
                for m in sorted(missing):
                    report.append(f"  - `{m}`")
            if extra:
                report.append(f"\nExtra in local ({len(extra)}):")
                for e in sorted(extra):
                    report.append(f"  - `{e}`")
            if not missing and not extra and ref_labels:
                report.append(f"\nAll {len(matching)} fields match!")

            # Dropdowns
            ref_selects = ref_data.get("selects", {})
            local_selects = local_data.get("selects", {})
            if ref_selects:
                report.append(f"\nRef dropdowns ({len(ref_selects)}): {', '.join(sorted(ref_selects.keys()))}")
            if local_selects:
                report.append(f"Local dropdowns ({len(local_selects)}): {', '.join(sorted(local_selects.keys()))}")

        # ---- PAGES ONLY IN REFERENCE ----
        report.append("\n---\n## 3. Pages in Reference but Missing in Local\n")
        skip = {"Masters", "13", "Settings", "Parameters", "Role", "User", "Sync", "SoftOnCloud",
                "Parcel Stock Analysis", "Parcel Sale Analysis", "Parcel Purchase Analysis"}
        local_names = {l["text"] for l in nav_links}
        reverse_map = {}
        for ref_name, local_name, _, _ in page_map:
            reverse_map[ref_name] = local_name

        for item in ref_nav:
            name = item["text"]
            if name in skip or item["href"] == "NULL":
                continue
            mapped = reverse_map.get(name)
            if mapped and mapped in local_names:
                continue
            if name in local_names:
                continue
            report.append(f"- **{name}** (`{item['href']}`)")

        # ---- VISUAL DIFFERENCES ----
        report.append("\n---\n## 4. Key Visual / UX Differences to Check\n")
        report.append("(Compare screenshots in `scraped_ref2/` vs `scraped_local/`)\n")
        report.append("- [ ] Purchase form: all fields match reference layout?")
        report.append("- [ ] Parcel Stock Report: 3 tabs (Basic/Grading, Numeric, Date Search)?")
        report.append("- [ ] Report pages: filter forms match reference?")
        report.append("- [ ] Financial transaction forms: all fields present?")
        report.append("- [ ] Payment & Receipts WITH Ex. Diff is a separate page in ref")
        report.append("- [ ] Sidebar hierarchy matches reference structure")
        report.append("- [ ] Table columns in list views match reference")

        report_text = "\n".join(report)
        with open(DIFF_OUT, "w") as f:
            f.write(report_text)
        print(f"\nComparison report saved to: {DIFF_OUT}")
        print(f"Local screenshots: {OUT}/")
        print(f"Reference screenshots: {REF}/")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
