import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/"
ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
def scroll_to(pg, sel, block="center"):
    pg.evaluate("""([s,b]) => { const el = document.querySelector(s); const vh = innerHeight;
      const y = b==='bottom' ? document.documentElement.scrollHeight : el.offsetTop - Math.max(0,(vh-el.offsetHeight)/2);
      window.scrollTo({top:y, behavior:'instant'}); }""", [sel, block])
    pg.wait_for_timeout(2600)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
    logs = []
    ctx = b.new_context(viewport={"width":1440,"height":900})
    pg = ctx.new_page(); pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}")); pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(300)
    pg.screenshot(path="shots/desktop-0-loader.png")
    pg.wait_for_timeout(3500)
    pg.screenshot(path="shots/desktop-1-hero.png")
    for name, sel, blk in [("2-problem","#problem","c"),("3-scope","#scope","c"),("4-process","#process","c"),("5-fit","#fit","c"),("6-cta","#contact","c"),("7-footer","#contact","bottom")]:
        scroll_to(pg, sel, blk); pg.screenshot(path=f"shots/desktop-{name}.png")
    # click the core at hero
    scroll_to(pg, "#top"); pg.wait_for_timeout(800)
    ctx.close()
    m = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pm = m.new_page(); pm.on("pageerror", lambda e: logs.append(f"[m pageerror] {e}")); pm.on("console", lambda x: logs.append(f"[m {x.type}] {x.text}"))
    pm.goto(URL, wait_until="networkidle"); pm.wait_for_timeout(3800)
    pm.screenshot(path="shots/mobile-1-hero.png")
    scroll_to(pm, "#problem"); pm.screenshot(path="shots/mobile-2-problem.png")
    scroll_to(pm, "#scope"); pm.screenshot(path="shots/mobile-3-scope.png")
    scroll_to(pm, "#contact", "bottom"); pm.screenshot(path="shots/mobile-4-cta.png")
    m.close()
    r = b.new_context(viewport={"width":1440,"height":900}, reduced_motion="reduce")
    pr = r.new_page(); pr.on("pageerror", lambda e: logs.append(f"[rm pageerror] {e}"))
    pr.goto(URL, wait_until="networkidle"); pr.wait_for_timeout(1500)
    pr.screenshot(path="shots/desktop-reduced-motion-hero.png")
    r.close(); b.close()
    print("\n".join(logs[:40]))
