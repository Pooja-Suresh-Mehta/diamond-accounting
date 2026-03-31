"""
Scraper v2 — Expands sidebar sections, discovers all sub-links, visits each page,
captures all tabs/views/filter forms, dropdowns, and network calls.
"""
import asyncio, json, os, re, time
from playwright.async_api import async_playwright

BASE = "https://mvc.softsense.in"
CREDS = {"company_id": "50002", "username": "Poojangems", "password": "Fw3170"}
OUT = "/Users/pooja.mehta/Projects/poojan_gems/scraped_ref2"
os.makedirs(OUT, exist_ok=True)

network_log = []

def safe_name(s):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', s).strip('_')[:60]

async def screenshot(page, name):
    path_base = f"{OUT}/{name}"
    await page.screenshot(path=f"{path_base}.png", full_page=True)
    html = await page.content()
    with open(f"{path_base}.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"    saved: {name}")

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
        )

        def on_response(response):
            url = response.url
            if any(x in url.lower() for x in ["/api/", "ajax", "handler", ".ashx", ".asmx", "json", "getdata", "getlist"]):
                network_log.append({
                    "url": url,
                    "method": response.request.method,
                    "status": response.status,
                })

        page = await context.new_page()
        page.on("response", on_response)

        # ---- LOGIN ----
        print("Logging in...")
        await page.goto(BASE, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)

        # Fill login
        inputs = page.locator("input:visible")
        count = await inputs.count()
        print(f"  Found {count} visible inputs on login page")

        # Try specific selectors for company/user/password
        await page.locator("input[name*='company' i], input[id*='company' i], input[placeholder*='company' i]").first.fill(CREDS["company_id"])
        await page.locator("input[name*='user' i], input[id*='user' i], input[placeholder*='user' i]").first.fill(CREDS["username"])
        await page.locator("input[type='password']").first.fill(CREDS["password"])
        await page.locator("button[type='submit'], button:has-text('Login')").first.click()
        await page.wait_for_load_state("networkidle", timeout=15000)
        await asyncio.sleep(3)
        print("  Logged in!")

        # ---- EXPAND ALL SIDEBAR SECTIONS ----
        print("\nExpanding sidebar menus...")

        # The sidebar has sections like "Masters ^", "Parcel ^", "Financial Transaction ^", "Reports ^"
        # These are already expanded (^ means open). But let's click each to make sure.
        sidebar_sections = page.locator(".left-side-bar a, .sidebar a, nav a, aside a, .side-nav a, .main-menu a, [class*='sidebar'] a, [class*='nav'] a")
        all_count = await sidebar_sections.count()
        print(f"  Total nav elements: {all_count}")

        # First, let's get the sidebar HTML to understand structure
        await screenshot(page, "00_dashboard")

        # Let's try to find expandable menu headers and click them
        # Look for elements that toggle submenus
        togglers = page.locator("a[data-toggle='collapse'], a[data-bs-toggle='collapse'], [class*='sidebar'] > ul > li > a, .side-nav > ul > li > a")
        toggle_count = await togglers.count()
        print(f"  Toggle elements: {toggle_count}")

        # More targeted: look at the sidebar structure from the screenshot
        # The sidebar has: Parcel Dashboard, Masters (expandable), Parcel (expandable), Financial Transaction (expandable), Reports (expandable)
        # Let's find all li > a in the sidebar that have siblings (sub-menus)

        # Strategy: get ALL links in the left panel, click parent items to expand, then gather child links
        left_panel = page.locator(".left-sidebar, .sidebar, nav, aside, [class*='side-bar'], [class*='sidebar']").first

        # Get all anchor tags
        all_anchors = page.locator("a[href]")
        a_count = await all_anchors.count()
        print(f"  Total anchors on page: {a_count}")

        # Collect all hrefs and texts
        all_links = []
        for i in range(a_count):
            a = all_anchors.nth(i)
            try:
                href = await a.get_attribute("href") or ""
                text = (await a.inner_text()).strip()
                classes = await a.get_attribute("class") or ""
                parent_classes = await a.evaluate("el => el.parentElement?.className || ''")
                if text and len(text) < 80:
                    all_links.append({"href": href, "text": text, "class": classes, "parent_class": parent_classes, "index": i})
            except:
                pass

        print(f"\n  All links with text ({len(all_links)}):")
        for l in all_links:
            print(f"    [{l['text'][:40]}] -> {l['href'][:60]}  (cls: {l['class'][:30]})")

        # Save this for reference
        with open(f"{OUT}/all_links_dump.json", "w") as f:
            json.dump(all_links, f, indent=2)

        # Now let's click each sidebar section header to expand it, then re-scan
        # Look for items that are section headers (Masters, Parcel, Financial Transaction, Reports)
        section_names = ["Masters", "Parcel", "Financial Transaction", "Reports"]

        for section in section_names:
            try:
                # Click the section header
                header = page.locator(f"a:has-text('{section}')").first
                if await header.is_visible(timeout=2000):
                    await header.click()
                    await asyncio.sleep(1)
                    print(f"  Clicked section: {section}")
            except Exception as e:
                print(f"  Could not click section {section}: {e}")

        await asyncio.sleep(1)
        await screenshot(page, "00_sidebar_expanded")

        # Now re-gather all links
        all_anchors = page.locator("a[href]")
        a_count = await all_anchors.count()

        nav_links = []
        seen_hrefs = set()
        skip_texts = {"logout", "login", "english", "softsense", "soft on cloud", "solitaire and account", "search menu"}

        for i in range(a_count):
            a = all_anchors.nth(i)
            try:
                href = await a.get_attribute("href") or ""
                text = (await a.inner_text()).strip()
                if not text or not href or href == "#" or href.startswith("javascript"):
                    continue
                if text.lower() in skip_texts or "logout" in href.lower():
                    continue
                if len(text) > 60:
                    continue
                # Normalize href
                if href.startswith("../"):
                    href = "/" + href.lstrip("./")
                if href not in seen_hrefs:
                    seen_hrefs.add(href)
                    nav_links.append({"href": href, "text": text})
            except:
                pass

        print(f"\n  Discovered {len(nav_links)} unique navigation links:")
        for i, l in enumerate(nav_links):
            print(f"    {i+1}. [{l['text']}] -> {l['href']}")

        with open(f"{OUT}/navigation.json", "w") as f:
            json.dump(nav_links, f, indent=2)

        # ---- VISIT EACH PAGE ----
        print(f"\n{'='*60}")
        print(f"Visiting {len(nav_links)} pages...")
        print(f"{'='*60}\n")

        for idx, link in enumerate(nav_links):
            page_label = safe_name(link["text"])
            page_name = f"{idx+1:02d}_{page_label}"
            href = link["href"]

            if href.startswith("/"):
                url = BASE + href
            elif href.startswith("http"):
                url = href
            else:
                url = BASE + "/" + href

            print(f"\n[{idx+1}/{len(nav_links)}] {link['text']} -> {url}")

            try:
                resp = await page.goto(url, wait_until="networkidle", timeout=20000)
                await asyncio.sleep(2)

                # Main screenshot
                await screenshot(page, page_name)

                # --- EXPLORE TABS ---
                tab_sels = [
                    "ul.nav-tabs li a", "ul.nav-pills li a",
                    ".nav-tabs .nav-link", "[role='tab']",
                    "a[data-toggle='tab']", "a[data-bs-toggle='tab']",
                    "button[data-toggle='tab']", "button[data-bs-toggle='tab']",
                ]
                for sel in tab_sels:
                    tabs = page.locator(sel)
                    count = await tabs.count()
                    if count > 1:
                        print(f"  Found {count} tabs ({sel})")
                        for ti in range(count):
                            tab = tabs.nth(ti)
                            try:
                                tt = safe_name((await tab.inner_text()).strip())[:25] or f"tab{ti}"
                                await tab.click()
                                await page.wait_for_load_state("networkidle", timeout=8000)
                                await asyncio.sleep(1.5)
                                await screenshot(page, f"{page_name}_tab_{tt}")
                            except Exception as e:
                                print(f"    Tab {ti} error: {e}")
                        break

                # --- DROPDOWNS / SELECT OPTIONS ---
                selects = page.locator("select:visible")
                sel_count = await selects.count()
                if sel_count > 0:
                    dd = {}
                    for si in range(sel_count):
                        s = selects.nth(si)
                        try:
                            sname = await s.get_attribute("name") or await s.get_attribute("id") or f"sel_{si}"
                            opts = await s.locator("option").all_inner_texts()
                            dd[sname] = opts
                        except:
                            pass
                    if dd:
                        with open(f"{OUT}/{page_name}_selects.json", "w") as f:
                            json.dump(dd, f, indent=2)
                        print(f"  Saved {len(dd)} dropdowns")

                # --- FORM FIELDS ---
                form_inputs = page.locator("input:visible, textarea:visible, select:visible")
                fi_count = await form_inputs.count()
                if fi_count > 2:
                    fields = []
                    for fi in range(fi_count):
                        inp = form_inputs.nth(fi)
                        try:
                            tag = await inp.evaluate("el => el.tagName")
                            inp_type = await inp.get_attribute("type") or ""
                            inp_name = await inp.get_attribute("name") or ""
                            inp_id = await inp.get_attribute("id") or ""
                            inp_ph = await inp.get_attribute("placeholder") or ""
                            inp_label = ""
                            try:
                                inp_label = await inp.evaluate("""el => {
                                    const id = el.id;
                                    if (id) { const lbl = document.querySelector('label[for=\"'+id+'\"]'); if (lbl) return lbl.textContent.trim(); }
                                    const parent = el.closest('.form-group, .form-field, label');
                                    if (parent) { const lbl = parent.querySelector('label'); if (lbl) return lbl.textContent.trim(); }
                                    return '';
                                }""")
                            except:
                                pass
                            fields.append({
                                "tag": tag, "type": inp_type, "name": inp_name,
                                "id": inp_id, "placeholder": inp_ph, "label": inp_label
                            })
                        except:
                            pass
                    if fields:
                        with open(f"{OUT}/{page_name}_fields.json", "w") as f:
                            json.dump(fields, f, indent=2)
                        print(f"  Saved {len(fields)} form fields")

                # --- CLICK SEARCH/SHOW TO GET RESULTS ---
                for btn_text in ["Search", "Show", "Get", "Load", "Submit"]:
                    try:
                        btn = page.locator(f"button:has-text('{btn_text}'), input[value='{btn_text}']").first
                        if await btn.is_visible(timeout=1500):
                            await btn.click()
                            await page.wait_for_load_state("networkidle", timeout=10000)
                            await asyncio.sleep(2)
                            await screenshot(page, f"{page_name}_results")
                            break
                    except:
                        pass

            except Exception as e:
                print(f"  ERROR: {e}")

        # ---- SAVE NETWORK LOG ----
        with open(f"{OUT}/network_log.json", "w") as f:
            json.dump(network_log, f, indent=2)
        print(f"\nSaved {len(network_log)} network calls")

        await browser.close()
        print(f"\nDone! Output: {OUT}")

if __name__ == "__main__":
    asyncio.run(run())
