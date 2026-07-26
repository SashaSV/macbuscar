# -*- coding: utf-8 -*-
"""
direct_price_check.py — test harness for the direct-URL price-check path
(runner.refresh_store_direct).

For a given store (or --all), visits every already-matched variant's
saved Price.url directly via the same Selenium driver the search-based
scrapers use, and reads the price straight off that page — no search,
no scoring, no candidate list, so no risk of a wrong/refurb listing
winning the match (the class of bug that tanked the iPad mini price on
Amazon this session).

Dry-run by default (reports only, no DB writes). Pass --apply once the
report looks right.

Usage (from Scraper/):
    python direct_price_check.py --store ktuin
    python direct_price_check.py --store amazon --limit 5
    python direct_price_check.py --all --limit 3        # quick smoke test
    python direct_price_check.py --store mediamarkt --apply
"""
import argparse
import importlib
import sys

from stores import runner

# store_id (DB) -> scraper module name (stores/*.py) — these diverge for
# pccomp (module is pccomponentes.py) and istore (module is ktuin.py).
MODULE_MAP = {
    'amazon':      'amazon',
    'mediamarkt':  'mediamarkt',
    'pccomp':      'pccomponentes',
    'fnac':        'fnac',
    'elcorte':     'elcorte',
    'worten':      'worten',
    'istore':      'ktuin',
    'rossellimac': 'rossellimac',
}


def run_one(store_id, *, limit, apply_):
    module_name = MODULE_MAP.get(store_id)
    if not module_name:
        print(f'❌ unknown store_id {store_id!r} (known: {sorted(MODULE_MAP)})')
        return
    mod = importlib.import_module(f'stores.{module_name}')
    extract_price = getattr(mod, 'extract_price_pdp', None)
    runner.refresh_store_direct(
        store_id=store_id,
        store_label=getattr(mod, 'STORE_LABEL', store_id),
        host=getattr(mod, 'HOST', ''),
        is_captcha=mod.is_captcha,
        warmup_driver=mod.warmup_driver,
        extract_price=extract_price,
        dry_run=not apply_,
        limit=limit,
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--store', default=None,
                     help='single store id: ' + ', '.join(sorted(MODULE_MAP)))
    ap.add_argument('--all', action='store_true',
                     help='run every store in MODULE_MAP, one after another')
    ap.add_argument('--limit', type=int, default=None,
                     help='only check the first N variants per store (smoke-test sizing)')
    ap.add_argument('--apply', action='store_true',
                     help='write results to DB (default: dry-run, report only)')
    args = ap.parse_args()

    if not args.store and not args.all:
        print('specify --store <id> or --all')
        sys.exit(1)

    stores = list(MODULE_MAP) if args.all else [args.store]
    for sid in stores:
        run_one(sid, limit=args.limit, apply_=args.apply)


if __name__ == '__main__':
    main()
