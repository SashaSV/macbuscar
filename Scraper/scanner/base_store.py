# -*- coding: utf-8 -*-
"""
Base class for all e-commerce scrapers.

Stores inherit from BaseStore and override:
- VENDOR, HOST, STORE_ID
- SEARCH_URL_PATTERN (use {query} and {page})
- PRODUCT_LINK_PATTERN (regex for product URLs in search results)
- FTMS (list of category configs)

Optionally override:
- skip_product(data) — filter logic
- post_process(data) — last-minute fixes
"""
import re
import time
from scanner import dbservice_postgres, universal_parser
from scanner.dbservice_postgres import DataScraps
from scanner.gethtml import driver_init, close_driver


class BaseStore:
    VENDOR = ''            # e.g. 'worten.es'
    HOST = ''              # e.g. 'https://www.worten.es'
    STORE_ID = ''          # e.g. 'worten'
    SEARCH_URL_PATTERN = ''  # e.g. 'https://www.worten.es/search?query={query}&page={page}'
    PRODUCT_LINK_PATTERN = r'/productos/[a-z0-9\-]+'  # regex for product links
    
    FTMS = []  # [{'category': 'iPhone', 'query': 'iPhone Apple', 'PAGES_COUNT': 1, 'pars': True}, ...]
    
    # === Hooks (override in subclasses) ===
    
    def skip_product(self, parsed_dict, ftm):
        """Return True to skip this product. Override for store-specific filters."""
        # Default: skip refurbished
        return parsed_dict.get('condition') == 'refurbished'
    
    def post_process(self, data, parsed_dict, ftm):
        """Last-minute transformations on DataScraps object."""
        return data
    
    # === Core methods ===
    
    def build_search_url(self, ftm, page=1):
        q = ftm['query'].replace(' ', '+')
        return self.SEARCH_URL_PATTERN.format(host=self.HOST, query=q, page=page)
    
    def crawl_products(self, driver, ftm):
        """Find product URLs from search pages."""
        urls = []
        pages = ftm.get('PAGES_COUNT', 1)
        
        for page in range(1, pages + 1):
            search_url = self.build_search_url(ftm, page)
            print(f'  page {page}: {search_url}')
            
            driver.get(search_url)
            time.sleep(4)
            html = driver.page_source
            
            found = set(re.findall(self.PRODUCT_LINK_PATTERN, html))
            for link in found:
                full = link if link.startswith('http') else self.HOST + link
                if full not in urls:
                    urls.append(full)
            
            print(f'    found {len(found)} product links (total: {len(urls)})')
        
        return urls
    
    def parse_product(self, driver, url, ftm):
        """Load a product page and parse it via universal_parser."""
        print(f'  • {url}')
        driver.get(url)
        time.sleep(2.5)
        html = driver.page_source
        
        parsed = universal_parser.parse_product_page(html, host=self.HOST)
        
        if not parsed['_jsonld_found'] and not parsed['price']:
            print('    ⚠️ no data found, skip')
            return None
        
        if not parsed['price']:
            print('    ⚠️ no price')
            return None
        
        if self.skip_product(parsed, ftm):
            print(f'    ⏭ skip ({parsed.get("condition")})')
            return None
        
        # Build DataScraps
        data = DataScraps(vendor=self.VENDOR)
        data.url = url
        data.sku = parsed['sku'] or url.rstrip('/').split('/')[-1]
        data.name = parsed['name']
        data.manufacturer = parsed['brand'] or 'Apple'
        data.category = ftm['category']
        data.price = parsed['price']
        data.oldprice = parsed.get('oldprice') or 0.0
        data.images = parsed['images']
        data.available = parsed.get('availability', '')
        
        if parsed.get('gtin'):
            data.techs = {'ean': parsed['gtin']}
        
        data = self.post_process(data, parsed, ftm)
        
        print(f'    ✅ {data.name[:60]} — {data.price}€')
        return data
    
    def pars_new_card_into_db(self, ftm, batch_size=5, max_products=None):
        """Crawl + parse + save in batches. max_products limits how many to scrape (for testing)."""
        driver = driver_init()
        dbservice_postgres.clear_store_data(self.STORE_ID, ftm['category'])
        
        try:
            urls = self.crawl_products(driver, ftm)
            
            # Limit for testing
            if max_products:
                urls = urls[:max_products]
                print(f'\n  🧪 TEST MODE: limited to {max_products} products')
            
            print(f'\n  Total: {len(urls)} URLs to parse (batch size: {batch_size})\n')
            
            batch = []
            total_saved = 0
            errors_in_row = 0
            
            for i, url in enumerate(urls):
                if i > 0 and i % 10 == 0:
                    print(f'  🔄 Restart browser at {i}/{len(urls)}')
                    try: close_driver(driver)
                    except: pass
                    time.sleep(2)
                    driver = driver_init()
                
                try:
                    d = self.parse_product(driver, url, ftm)
                    if d:
                        batch.append(d)
                    errors_in_row = 0
                except KeyboardInterrupt:
                    print('  ⛔ Cancelled by user')
                    break
                except Exception as e:
                    print(f'    ❌ {type(e).__name__}: {str(e)[:100]}')
                    errors_in_row += 1
                    if errors_in_row >= 3:
                        print('  ⚠️ Multiple errors, restarting browser…')
                        try: close_driver(driver)
                        except: pass
                        time.sleep(5)
                        driver = driver_init()
                        errors_in_row = 0
                
                if len(batch) >= batch_size:
                    dbservice_postgres.save_scraped_products(batch, store_id=self.STORE_ID)
                    total_saved += len(batch)
                    print(f'  💾 Batch saved ({total_saved}/{len(urls)})\n')
                    batch = []
            
            if batch:
                dbservice_postgres.save_scraped_products(batch, store_id=self.STORE_ID)
                total_saved += len(batch)
            
            print(f'\n  ✅ Total saved: {total_saved}')
        finally:
            try: close_driver(driver)
            except: pass

    def run(self, max_products=None):
        """Run scraping. Pass max_products to limit per category (for testing)."""
        for ftm in self.FTMS:
            if ftm.get('pars'):
                print(f"\n=== {ftm['category']} ({self.STORE_ID}) ===")
                self.pars_new_card_into_db(ftm, max_products=max_products)