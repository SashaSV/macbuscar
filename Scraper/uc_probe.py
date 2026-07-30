import undetected_chromedriver as uc
import sys
print("uc version:", getattr(uc, "__version__", "?"))
try:
    d = uc.Chrome(version_main=150)
    print("OK bare:", d.title)
    d.quit()
except Exception as e:
    print("FAIL bare:", type(e).__name__, str(e).splitlines()[0])

try:
    o = uc.ChromeOptions()
    o.add_argument("--lang=es-ES")
    d = uc.Chrome(options=o, version_main=150)
    d.get("https://www.worten.es/productos/iphone-17-pro-apple-6-3-256-gb-azul-oscuro-8600342")
    import time; time.sleep(6)
    print("OK ucopts | title:", d.title)
    d.quit()
except Exception as e:
    print("FAIL ucopts:", type(e).__name__, str(e).splitlines()[0])
