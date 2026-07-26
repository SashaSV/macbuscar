# -*- coding: utf-8 -*-
"""
price_probe.py — proof-of-concept for the "direct product-page price check"
idea: for each store, fetch a REAL saved Price.url with plain `requests`
(no Selenium, no search, no scoring) and try to extract the current price
using, in order:
  1. <meta property="og:price:amount"> / <meta property="product:price:amount">
  2. <script type="application/ld+json"> Product/Offer schema
  3. best-effort regex on visible text near the top of the page

Two things this proves at once:
  - whether the VPS's datacenter IP gets blocked/served different content
    than a residential IP (the real risk for this approach)
  - which extraction strategy actually works per store, so we know what
    to build into the real store-specific parsers

Run from Scraper/ (needs `requests`, `beautifulsoup4` — both already
scraper deps):
    python price_probe.py
"""
import re
import json
import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'),
    'Accept-Language': 'es-ES,es;q=0.9',
}

# (store, url, price we have saved in DB right now) — real rows pulled via
# get-sample-urls.mjs earlier this session.
SAMPLES = [
    ('ktuin', 'https://www.k-tuin.com/apple-watch-ultra-3-49mm-titanio-negro-ocean-negro', 899.00),
    ('elcorte', 'https://www.elcorteingles.es/electronica/A56790349-0195950609998-pr-apple-watch-ultra-3-gps-cellular-49mm-titanio-negro-con-correa-ocean-negro-titanio-negro/', 869.00),
    ('worten', 'https://www.worten.es/productos/macbook-air-apple-blanco-estrella-15-apple-m5-10-core-ram-16-gb-512-gb-ssd-gpu-10-core-8785254', 1543.02),
    ('rossellimac', 'https://rossellimac.es/products/airpods-pro-3-mfhp4zm-a', 249.00),
    ('amazon', 'https://www.amazon.es/dp/B01JZZ0MIA', 139.89),
    ('mediamarkt', 'https://www.mediamarkt.es/es/product/_apple-watch-ultra-3-2025-gpscel-49-mm-caja-de-titanio-negro-correa-ocean-band-negro-calidad-del-sueno-via-satelite-42h-autonomia-1606350.html', 839.00),
    ('pccomp', 'https://www.pccomponentes.com/apple-watch-ultra-3-gps-plus-cellular-49mm-caja-de-titanio-negro-con-correa-ocean-negra', 859.00),
    ('fnac', 'https://www.fnac.es/Apple-Watch-Ultra-3-GPS-Cellular-49mm-Caja-Titanio-Negro-y-Correa-Alpine-Loop-Negro-Talla-S-Wearable-Reloj-conectado/a12303570', 799.97),
]


def try_meta_price(soup):
    for prop in ('og:price:amount', 'product:price:amount', 'og:product:price:amount'):
        tag = soup.find('meta', attrs={'property': prop})
        if tag and tag.get('content'):
            return tag['content'], f'meta[{prop}]'
    return None, None


def try_jsonld_price(soup):
    for el in soup.select('script[type="application/ld+json"]'):
        raw = el.string
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        candidates = data if isinstance(data, list) else [data]
        for item in candidates:
            if not isinstance(item, dict):
                continue
            stack = [item]
            while stack:
                node = stack.pop()
                if not isinstance(node, dict):
                    continue
                offers = node.get('offers')
                if isinstance(offers, dict) and offers.get('price'):
                    return offers['price'], 'jsonld offers.price'
                if isinstance(offers, list):
                    for o in offers:
                        if isinstance(o, dict) and o.get('price'):
                            return o['price'], 'jsonld offers[].price'
                for v in node.values():
                    if isinstance(v, dict):
                        stack.append(v)
                    elif isinstance(v, list):
                        stack.extend(x for x in v if isinstance(x, dict))
    return None, None


def try_regex_price(html):
    # Very rough fallback: first "NNN,NN €" or "NNN.NN€" near the top 20k
    # chars, biased toward the typical PDP price-block wording seen in
    # this session's fetches ("799,00€", "899,00 €", "1.543,02€"...).
    head = html[:60000]
    m = re.search(r'(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*€', head)
    if m:
        return m.group(1), 'regex fallback'
    return None, None


def main():
    for store, url, db_price in SAMPLES:
        print(f'\n=== {store}  (db={db_price}€) ===')
        print(f'    {url}')
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
        except Exception as e:
            print(f'    ❌ request failed: {type(e).__name__}: {e}')
            continue
        print(f'    HTTP {r.status_code}, {len(r.text)} chars')
        if r.status_code != 200 or len(r.text) < 2000:
            print(f'    ⚠️  looks blocked/empty — this store likely needs Selenium, not plain requests')
            continue
        soup = BeautifulSoup(r.text, 'html.parser')
        price, method = try_meta_price(soup)
        if not price:
            price, method = try_jsonld_price(soup)
        if not price:
            price, method = try_regex_price(r.text)
        if price:
            print(f'    ✅ found price={price}  via {method}')
        else:
            print(f'    ❌ no price found by any strategy')


if __name__ == '__main__':
    main()
