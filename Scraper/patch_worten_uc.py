import io
p = r"E:\AllProjects\manzana-es-project\macbuscar\Scraper\stores\worten.py"
src = io.open(p, encoding="utf-8").read()
io.open(p + ".bak3", "w", encoding="utf-8").write(src)

old = ("    service = Service(ChromeDriverManager().install())\n"
       "    driver = webdriver.Chrome(service=service, options=opts)\n")
assert src.count(old) == 1, f"anchor count: {src.count(old)}"

new = (
    "    # Worten sits behind Cloudflare. Plain selenium (even headless=new with a\n"
    "    # real UA) gets served the 'Un momento...' interstitial instead of the\n"
    "    # product page, which is why the 27 Jul run read prices off a challenge\n"
    "    # page. undetected_chromedriver patches the fingerprint giveaways the\n"
    "    # same way fnac.py already relies on for DataDome.\n"
    "    import undetected_chromedriver as uc\n"
    "    from .fnac import _detect_chrome_major\n"
    "    runner._cleanup_uc_dir()\n"
    "    chrome_major = _detect_chrome_major()\n"
    "    if chrome_major:\n"
    "        print(f'   \\U0001f527 Detected Chrome {chrome_major}; pinning chromedriver')\n"
    "    driver = uc.Chrome(options=opts, version_main=chrome_major)\n"
)
io.open(p, "w", encoding="utf-8").write(src.replace(old, new))
print("patched worten.py make_driver (backup: worten.py.bak3)")
