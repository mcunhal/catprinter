from playwright.sync_api import sync_playwright

def dump_html(page):
    page.goto("http://localhost:8000/index.html")
    page.wait_for_selector("body")
    print(page.content())

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        dump_html(page)
