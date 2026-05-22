# -*- coding: utf-8 -*-
"""Worten.es scraper."""
from scanner.base_store import BaseStore


class WortenStore(BaseStore):
    VENDOR = 'worten.es'
    HOST = 'https://www.worten.es'
    STORE_ID = 'worten'
    SEARCH_URL_PATTERN = '{host}/search?query={query}&page={page}'
    PRODUCT_LINK_PATTERN = r'/productos/[a-z0-9\-]+'
    
    FTMS = [
        {'category': 'iPhone',      'query': 'iPhone Apple',  'PAGES_COUNT': 1, 'pars': True},
        {'category': 'MacBook',     'query': 'MacBook Apple', 'PAGES_COUNT': 1, 'pars': False},
        {'category': 'iPad',        'query': 'iPad Apple',    'PAGES_COUNT': 1, 'pars': False},
        {'category': 'Apple Watch', 'query': 'Apple Watch',   'PAGES_COUNT': 1, 'pars': False},
        {'category': 'AirPods',     'query': 'AirPods Apple', 'PAGES_COUNT': 1, 'pars': False},
    ]


    def skip_product(self, parsed_dict, ftm):
        """Skip refurbished + non-Apple."""
        # Skip refurbished
        if parsed_dict.get('condition') == 'refurbished':
            return True
        name = (parsed_dict.get('name') or '').lower()
        # Worten вживані часто мають "reacondicionado" в назві
        if 'reacondicionado' in name or 'flipper' in name or 'señales' in name:
            return True
        # Skip not Apple
        brand = (parsed_dict.get('brand') or '').lower()
        if brand and brand != 'apple':
            return True
        return False


if __name__ == '__main__':
    import sys
    max_prods = int(sys.argv[1]) if len(sys.argv) > 1 else None
    WortenStore().run(max_products=max_prods)