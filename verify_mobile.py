from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    # Emulate Honor Magic 5 Pro (approximate viewport)
    # Using Pixel 5 emulation as a proxy for high-end android, adjusting viewport
    device = playwright.devices['Pixel 5']
    device['viewport'] = {'width': 393, 'height': 851}

    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(**device)
    page = context.new_page()

    # Load from local server
    page.goto("http://localhost:8000/index.html")

    # Wait for page load
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Take initial screenshot
    page.screenshot(path="/home/jules/verification/mobile_initial.png")

    # Check for Connect Button
    print("Checking for Connect Button...")
    connect_btn = page.locator("#connectTextBtn")

    # Check if visible in viewport
    # is_visible() checks if it's attached and not hidden by CSS
    # is_in_viewport() checks if it's in the scrollable viewport
    if connect_btn.is_visible():
        print("Connect Button is technically visible (CSS).")
        box = connect_btn.bounding_box()
        if box:
            print(f"Button coordinates: x={box['x']}, y={box['y']}, width={box['width']}, height={box['height']}")
            if box['x'] + box['width'] > 393:
                print("FAIL: Button is overflowing horizontally off-screen.")
            if box['y'] > 851:
                 print("INFO: Button is below fold, checking scroll...")
    else:
        print("FAIL: Connect Button is hidden via CSS or not attached.")

    # Attempt to scroll to it
    try:
        connect_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        page.screenshot(path="/home/jules/verification/mobile_scrolled.png")
        print("Scrolled to button.")

        # Check intersection with viewport again
        box = connect_btn.bounding_box()
        print(f"Post-scroll coordinates: y={box['y']}")
    except Exception as e:
        print(f"Could not scroll to button: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
