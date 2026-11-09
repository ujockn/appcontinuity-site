from playwright.sync_api import sync_playwright
ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
    logs=[]
    pg = b.new_page(viewport={"width":1440,"height":900})
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}")); pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.goto("http://localhost:4173/", wait_until="networkidle"); pg.wait_for_timeout(3500)
    # find the core: it sits at roughly 69% x, 50% y
    pg.mouse.move(990, 450); pg.wait_for_timeout(300)
    print("hover class:", pg.evaluate("document.body.classList.contains('is-hover')"))
    pg.click("#sound"); pg.wait_for_timeout(200)
    print("sound pressed:", pg.get_attribute("#sound","aria-pressed"))
    pg.mouse.click(990, 450); pg.wait_for_timeout(350)
    pg.screenshot(path="shots/desktop-core-click.png")
    pg.click("#sound")
    # form
    pg.evaluate("document.querySelector('#contact').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(2000)
    pg.click("#fit-form button[type=submit]"); pg.wait_for_timeout(200)
    print("error msg:", pg.text_content("#form-err"))
    pg.fill("#f-name","Sam"); pg.fill("#f-email","sam@example.com"); pg.fill("#f-msg","Web subscribers hit the paywall on iOS.")
    pg.click("#fit-form button[type=submit]"); pg.wait_for_timeout(1200)
    print("thanks visible:", pg.is_visible("#thanks"))
    pg.screenshot(path="shots/desktop-form-thanks.png")
    # og image
    og = b.new_page(viewport={"width":1200,"height":630})
    og.goto("http://localhost:4173/", wait_until="networkidle"); og.wait_for_timeout(7000)
    og.screenshot(path="public/og.png")
    print("\n".join(logs))
    b.close()
