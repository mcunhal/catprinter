from playwright.sync_api import sync_playwright, expect

def test_banner_dimensions(page):
    print("Navigating to app...")
    page.goto("http://localhost:8000/index.html")

    # Wait for app to load
    page.wait_for_selector("#editor")

    print("Setting text 'Short'...")
    # Clear and set text
    page.evaluate("document.querySelector('.ql-editor').innerHTML = '<p>Short</p>'")

    # Switch to Landscape using the CORRECT selector
    print("Switching to Landscape...")
    # The selector in the HTML is #textOrientation, NOT #orientationSelect
    page.select_option("#textOrientation", "landscape")

    # Wait for preview to update (debounce is 300ms usually, wait 1s)
    page.wait_for_timeout(1000)

    # Capture screenshot of the preview area
    preview_panel = page.locator(".preview-panel").first
    preview_panel.screenshot(path="verification/banner_fix.png")

    # Also verify the dimensions of the generated canvas in the preview
    # The canvas is inside .preview-container
    canvas = page.locator(".preview-container canvas")
    box = canvas.bounding_box()

    print(f"Canvas Dimensions: {box['width']}x{box['height']}")

    # In landscape:
    # Width should be fixed 384px (scaled by CSS if any, but let's check attributes)
    # Height should be small (banner length)

    width_attr = canvas.get_attribute("width")
    height_attr = canvas.get_attribute("height")

    print(f"Canvas Attributes: width={width_attr}, height={height_attr}")

    # Verification Logic
    # 384px width
    if width_attr != "384":
        print("FAIL: Width attribute is not 384")

    # Height should be small (approx 20-50px for 'Short')
    # If bug exists, height would be huge (e.g. 1000px)
    h = int(height_attr)
    if h > 200:
        print(f"FAIL: Height is too large ({h}px). Banner mode is capturing full screen.")
    else:
        print(f"SUCCESS: Height is compact ({h}px).")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_banner_dimensions(page)
        finally:
            browser.close()
