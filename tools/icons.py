from playwright.sync_api import sync_playwright
svg = open('public/favicon.svg').read()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for size, out in [(32,'public/favicon-32.png'),(180,'public/apple-touch-icon.png'),(512,'public/icon-512.png')]:
        pg = b.new_page(viewport={"width":size,"height":size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ",1)}</body></html>')
        pg.screenshot(path=out, omit_background=True); pg.close()
    b.close()
