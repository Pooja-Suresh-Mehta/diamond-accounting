"""
Playwright scraper for the reference diamond accounting app.
Logs in, navigates every sidebar menu item, captures:
  - Full-page screenshots (including all tabs/sub-views)
  - HTML source of each page
  - Network API request/response logs
"""
import asyncio, json, os, re, time
from playwright.async_api import async_playwright

BASE = "https://mvc.softsense.in"
CREDS = {"company_id": "50002", "username": "Poojangems", "password": "Fw3170"}
OUT = "/Users/pooja.mehta/Projects/poojan_gems/scraped_reference"
os.makedirs(OUT, exist_ok=True)

network_log = []

async def save_screenshot(page, name, suffix=""):
    fname = re.sub(r'[^a-zA-Z0-9_-]', '_', f"{name}{suffix}")
    await page.screenshot(path=f"{OUT}/{fname}.png", full_page=True)
    html = await page.content()
    with open(f"{OUT}/{fname}.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  Saved: {fname}")

async def click_and_wait(page, selector, timeout=5000):
    """Click an element and wait for network to settle."""
    try:
        el = page.locator(selector).first
        await el.wait_for(state="visible", timeout=timeout)
        await el.click()
        await page.wait_for_load_state("networkidle", timeout=10000)
        await asyncio.sleep(1)
        return True
    except Exception as e:
        print(f"  Could not click {selector}: {e}")
        return False

async def explore_tabs(page, page_name):
    """Find and click through all tab-like elements on the current page."""
    # Common tab patterns in web apps
    tab_selectors = [
        "ul.nav-tabs li a",
        "ul.nav-pills li a",
        ".nav-tabs .nav-link",
        ".nav-pills .nav-link",
        "[role='tab']",
        ".tab-link",
        ".tabs a",
        ".tab-btn",
        "button[data-toggle='tab']",
        "a[data-toggle='tab']",
        "a[data-bs-toggle='tab']",
        "button[data-bs-toggle='tab']",
    ]

    tabs_found = False
    for sel in tab_selectors:
        tabs = page.locator(sel)
        count = await tabs.count()
        if count > 1:
            tabs_found = True
            print(f"  Found {count} tabs with selector: {sel}")
            for i in range(count):
                tab = tabs.nth(i)
                try:
                    tab_text = (await tab.inner_text()).strip()
                    tab_text = re.sub(r'\s+', '_', tab_text)[:30]
                    if not tab_text:
                        tab_text = f"tab_{i}"
                    await tab.click()
                    await page.wait_for_load_state("networkidle", timeout=8000)
                    await asyncio.sleep(1)
                    await save_screenshot(page, page_name, f"_tab_{tab_text}")
                except Exception as e:
                    print(f"    Tab {i} error: {e}")
            break

    return tabs_found

async def explore_dropdowns_and_filters(page, page_name):
    """Capture the state of dropdowns / filter forms on the page."""
    # Look for select elements and capture their options
    selects = page.locator("select")
    count = await selects.count()
    select_data = {}
    for i in range(count):
        sel = selects.nth(i)
        try:
            name = await sel.get_attribute("name") or await sel.get_attribute("id") or f"select_{i}"
            options = await sel.locator("option").all_inner_texts()
            select_data[name] = options
        except:
            pass
    if select_data:
        with open(f"{OUT}/{re.sub(r'[^a-zA-Z0-9_-]', '_', page_name)}_dropdowns.json", "w") as f:
            json.dump(select_data, f, indent=2)
        print(f"  Saved dropdown options ({len(select_data)} selects)")

async def explore_sub_buttons(page, page_name):
    """Click 'Search' or 'Show' buttons to reveal results tables."""
    btn_selectors = [
        "button:has-text('Search')",
        "button:has-text('Show')",
        "input[type='submit']",
        "button[type='submit']",
        "button:has-text('Get')",
        "button:has-text('Load')",
    ]
    for sel in btn_selectors:
        try:
            btn = page.locator(sel).first
            if await btn.is_visible(timeout=2000):
                btn_text = (await btn.inner_text()).strip()
                await btn.click()
                await page.wait_for_load_state("networkidle", timeout=10000)
                await asyncio.sleep(2)
                await save_screenshot(page, page_name, f"_after_{btn_text}")
                return True
        except:
            pass
    return False

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
        )

        # Capture API calls
        def on_response(response):
            url = response.url
            if "/api/" in url or "ajax" in url.lower() or "handler" in url.lower() or ".ashx" in url.lower() or ".asmx" in url.lower():
                network_log.append({
                    "url": url,
                    "method": response.request.method,
                    "status": response.status,
                    "timestamp": time.time(),
                })

        page = await context.new_page()
        page.on("response", on_response)

        # ---- LOGIN ----
        print("Logging in...")
        await page.goto(BASE, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)
        await save_screenshot(page, "00_login_page")

        # Try to find login form fields
        # Check for company ID field
        for field_sel in ["input[name*='company' i]", "input[id*='company' i]", "input[placeholder*='company' i]", "#CompanyId", "#companyId", "input[name='CompanyId']"]:
            el = page.locator(field_sel).first
            try:
                if await el.is_visible(timeout=2000):
                    await el.fill(CREDS["company_id"])
                    print(f"  Filled company ID via {field_sel}")
                    break
            except:
                pass

        # Username
        for field_sel in ["input[name*='user' i]", "input[id*='user' i]", "input[placeholder*='user' i]", "#UserName", "#username", "input[name='UserName']", "input[type='text']"]:
            el = page.locator(field_sel).first
            try:
                if await el.is_visible(timeout=2000):
                    await el.fill(CREDS["username"])
                    print(f"  Filled username via {field_sel}")
                    break
            except:
                pass

        # Password
        for field_sel in ["input[type='password']", "input[name*='pass' i]", "#Password"]:
            el = page.locator(field_sel).first
            try:
                if await el.is_visible(timeout=2000):
                    await el.fill(CREDS["password"])
                    print(f"  Filled password via {field_sel}")
                    break
            except:
                pass

        await save_screenshot(page, "00_login_filled")

        # Submit login
        for btn_sel in ["button[type='submit']", "input[type='submit']", "button:has-text('Login')", "button:has-text('Sign')", "#btnLogin", ".login-btn"]:
            el = page.locator(btn_sel).first
            try:
                if await el.is_visible(timeout=2000):
                    await el.click()
                    print(f"  Clicked login via {btn_sel}")
                    break
            except:
                pass

        await page.wait_for_load_state("networkidle", timeout=15000)
        await asyncio.sleep(3)
        await save_screenshot(page, "00_after_login")

        # ---- DISCOVER SIDEBAR / MENU ----
        print("\nDiscovering navigation...")

        # Get all sidebar/menu links
        sidebar_links = []
        for link_sel in ["nav a[href]", ".sidebar a[href]", "#sidebar a[href]", ".menu a[href]", ".nav-menu a[href]", "aside a[href]", "a.nav-link[href]"]:
            links = page.locator(link_sel)
            count = await links.count()
            if count > 3:
                print(f"  Found {count} nav links via: {link_sel}")
                for i in range(count):
                    link = links.nth(i)
                    try:
                        href = await link.get_attribute("href") or ""
                        text = (await link.inner_text()).strip()
                        if href and text and href != "#" and not href.startswith("javascript"):
                            sidebar_links.append({"href": href, "text": text})
                    except:
                        pass
                break

        # Also try clicking expandable menu items first
        expand_selectors = [
            ".has-submenu > a",
            "[data-toggle='collapse']",
            "[data-bs-toggle='collapse']",
            ".nav-item.has-treeview > a",
            "li.treeview > a",
            ".sidebar-menu .has-sub > a",
        ]
        for sel in expand_selectors:
            items = page.locator(sel)
            count = await items.count()
            if count > 0:
                print(f"  Expanding {count} submenus via: {sel}")
                for i in range(count):
                    try:
                        await items.nth(i).click()
                        await asyncio.sleep(0.5)
                    except:
                        pass
                # Re-gather links after expansion
                for link_sel in ["nav a[href]", ".sidebar a[href]", "aside a[href]", "a.nav-link[href]"]:
                    links = page.locator(link_sel)
                    count = await links.count()
                    if count > len(sidebar_links):
                        sidebar_links = []
                        for i in range(count):
                            link = links.nth(i)
                            try:
                                href = await link.get_attribute("href") or ""
                                text = (await link.inner_text()).strip()
                                if href and text and href != "#" and not href.startswith("javascript"):
                                    sidebar_links.append({"href": href, "text": text})
                            except:
                                pass
                        break

        # Fallback: get ALL anchor tags on the page
        if len(sidebar_links) < 5:
            print("  Fallback: gathering all page links...")
            all_links = page.locator("a[href]")
            count = await all_links.count()
            for i in range(count):
                link = all_links.nth(i)
                try:
                    href = await link.get_attribute("href") or ""
                    text = (await link.inner_text()).strip()
                    if href and text and len(text) < 50 and href != "#" and "logout" not in href.lower() and "login" not in href.lower():
                        sidebar_links.append({"href": href, "text": text})
                except:
                    pass

        # Deduplicate
        seen = set()
        unique_links = []
        for l in sidebar_links:
            key = l["href"]
            if key not in seen:
                seen.add(key)
                unique_links.append(l)
        sidebar_links = unique_links

        print(f"\nFound {len(sidebar_links)} navigation links:")
        for i, l in enumerate(sidebar_links):
            print(f"  {i+1}. [{l['text']}] -> {l['href']}")

        # Save nav structure
        with open(f"{OUT}/navigation_structure.json", "w") as f:
            json.dump(sidebar_links, f, indent=2)

        # ---- VISIT EACH PAGE ----
        print("\n--- Visiting each page ---\n")
        for i, link in enumerate(sidebar_links):
            page_name = f"{i+1:02d}_{re.sub(r'[^a-zA-Z0-9]', '_', link['text'])}"
            href = link["href"]

            # Make absolute URL
            if href.startswith("/"):
                url = BASE + href
            elif not href.startswith("http"):
                url = BASE + "/" + href
            else:
                url = href

            print(f"\n[{i+1}/{len(sidebar_links)}] {link['text']} -> {url}")

            try:
                await page.goto(url, wait_until="networkidle", timeout=20000)
                await asyncio.sleep(2)

                # Initial screenshot
                await save_screenshot(page, page_name)

                # Explore tabs
                await explore_tabs(page, page_name)

                # Explore dropdowns/filters
                await explore_dropdowns_and_filters(page, page_name)

                # Try clicking search/show buttons
                await explore_sub_buttons(page, page_name)

            except Exception as e:
                print(f"  ERROR visiting {url}: {e}")
                await save_screenshot(page, page_name, "_error")

        # ---- SAVE NETWORK LOG ----
        with open(f"{OUT}/network_log.json", "w") as f:
            json.dump(network_log, f, indent=2)
        print(f"\nSaved {len(network_log)} network API calls")

        await browser.close()
        print("\nDone! All data saved to:", OUT)

if __name__ == "__main__":
    asyncio.run(run())
