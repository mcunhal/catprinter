from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load from local server
    page.goto("http://localhost:8000/index.html")

    # Log console messages
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser error: {err}"))

    # Check for Connect Button
    print("Checking for Connect Button...")
    connect_btn = page.locator("#connectTextBtn")
    try:
        expect(connect_btn).to_be_visible(timeout=5000)
        print("Connect Button is visible.")
    except Exception as e:
        print(f"Connect Button NOT visible: {e}")
        page.screenshot(path="/home/jules/verification/missing_btn.png")
        raise

    # Check text
    text = connect_btn.inner_text()
    print(f"Connect Button text: {text}")

    # Check for Printer Settings Section
    print("Checking for Printer Settings section...")
    settings_section = page.locator(".config-section h3", has_text="Printer Settings")
    expect(settings_section).to_be_visible()
    print("Printer Settings section is visible.")

    # Check for Density Slider
    density_input = page.locator("#printDensity")
    expect(density_input).to_be_visible()
    print("Density slider is visible.")

    # Click Connect
    print("Clicking Connect Button...")
    connect_btn.click()

    # Check for status message update (it should say "Connecting...")
    status_bar = page.locator(".printing-status")
    try:
        expect(status_bar).to_contain_text("Connecting", timeout=2000)
        print("Status bar updated to 'Connecting'. Button click handler works.")
    except Exception as e:
        print(f"Status bar did not update: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
