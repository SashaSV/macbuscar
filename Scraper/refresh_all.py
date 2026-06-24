# -*- coding: utf-8 -*-
"""
Scraper/refresh_all.py
─────────────────────────────────────────────────────────────────────────────
Nightly price-refresh orchestrator. Runs each store's refresh() in sequence,
swallowing failures per-store so one bad partner doesn't kill the run.

Invoked by `.github/workflows/refresh-prices.yml` at 02:00 UTC daily
(03:00 Madrid winter / 04:00 summer). Can also be run locally with:

    cd Scraper
    $env:DATABASE_URL = "...neon postgres url..."
    python refresh_all.py            # full run
    python refresh_all.py --dry-run  # no DB writes (handy for sanity check)
    python refresh_all.py --only ktuin worten   # subset

What gets refreshed:
  - Price.price for already-matched (variant, store) pairs only
  - Previous Price.price moves into Price.oldPrice (SQL standard side-effect:
    right-hand side of SET sees pre-update values)
  - PriceHistory row written on price change

What is NOT touched:
  - ScrapedProduct (audit trail stays put)
  - financing columns (monthlyPrice/monthlyMonths/financingProvider/
    monthlyApr — these change only during full scrape, not nightly refresh)
  - Variants without a Price row for the store (full scrape can pick them up)

Exit code: 0 if every store succeeded, 1 if any store hit a fatal error.
A captcha mid-run is NOT considered fatal — the store just returns a
partial result and we move on to the next one.
"""
import sys
import os
import argparse
import time

# Make /Scraper importable so `from stores import ktuin, ...` resolves the
# same way it does when running scrapers individually with -m.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from stores import ktuin, mediamarkt, worten, amazon, pccomponentes, elcorte


# Ordered list of stores. K-tuin first because it's the most stable and
# matches the most variants (287/347 baseline) — if there's a fundamental
# bug, we'd rather catch it on K-tuin than waste a slow Amazon run. Amazon
# last because its DataDome/Akamai cousin is the most likely to captcha
# under load.
# PcComponentes and El Corte Inglés sit together right after K-tuin: both
# are Apple Authorized Resellers with clean Apple-only catalogs (PcC: 20/21
# first try, ECI: 84/347 baseline), and both fronted by Akamai. Pairing
# them lets a single warmed-up Akamai session hit both back-to-back before
# Worten (Cloudflare) breaks the streak. MediaMarkt closes out the Akamai
# tier; Amazon's DataDome rate-limits hardest so it always goes last.
STORES = [
    ('ktuin',         ktuin),
    ('pccomponentes', pccomponentes),
    ('elcorte',       elcorte),
    ('worten',        worten),
    ('mediamarkt',    mediamarkt),
    ('amazon',        amazon),
]


def parse_args():
    ap = argparse.ArgumentParser(
        description='Nightly price refresh for all stores'
    )
    ap.add_argument('--dry-run', action='store_true',
                    help='do not write to DB (each store still hits its search pages)')
    ap.add_argument('--only', nargs='+', metavar='STORE',
                    help=f'subset of stores to refresh '
                         f'(choices: {", ".join(s for s, _ in STORES)})')
    return ap.parse_args()


def main():
    args = parse_args()

    selected = STORES
    if args.only:
        wanted = set(args.only)
        unknown = wanted - {sid for sid, _ in STORES}
        if unknown:
            print(f'❌ Unknown store(s): {", ".join(sorted(unknown))}', file=sys.stderr)
            return 2
        selected = [(sid, mod) for sid, mod in STORES if sid in wanted]

    if not os.environ.get('DATABASE_URL'):
        print('❌ DATABASE_URL env var is required', file=sys.stderr)
        return 2

    print('═' * 72)
    print(f'  Nightly price refresh — {len(selected)} store(s)')
    print(f'  Mode: {"DRY-RUN" if args.dry_run else "LIVE (writes to DB)"}')
    print(f'  CI:   {os.environ.get("CI", "false")}')
    print('═' * 72)

    summary = []   # (store_id, matched, missed, captcha, error_msg_or_None)
    started_at = time.time()

    for sid, mod in selected:
        print(f'\n{"─" * 72}\n  {sid.upper()}\n{"─" * 72}')
        store_started = time.time()
        try:
            matched, missed, captcha = mod.refresh(dry_run=args.dry_run)
            summary.append((sid, matched, missed, captcha, None))
        except Exception as e:
            elapsed = time.time() - store_started
            print(f'\n❌ {sid} crashed after {elapsed:.0f}s: '
                  f'{type(e).__name__}: {e}')
            import traceback
            traceback.print_exc()
            summary.append((sid, 0, 0, False, f'{type(e).__name__}: {e}'))

    total_elapsed = time.time() - started_at

    # Final report — designed to be readable in a GHA Actions log so a
    # human can grok the night's outcome at a glance.
    print('\n' + '═' * 72)
    print(f'  REFRESH COMPLETE — {total_elapsed/60:.1f} min total')
    print('═' * 72)
    print(f'  {"Store":<12} {"Refreshed":>10} {"Missed":>10}  Status')
    print(f'  {"-"*12} {"-"*10} {"-"*10}  {"-"*40}')
    total_refreshed = 0
    total_missed = 0
    fatal = 0
    for sid, matched, missed, captcha, err in summary:
        total_refreshed += matched
        total_missed += missed
        if err:
            status = f'❌ {err[:40]}'
            fatal += 1
        elif captcha:
            status = '⚠️  partial (captcha)'
        else:
            status = '✅ ok'
        print(f'  {sid:<12} {matched:>10} {missed:>10}  {status}')
    print(f'  {"-"*12} {"-"*10} {"-"*10}')
    print(f'  {"TOTAL":<12} {total_refreshed:>10} {total_missed:>10}')
    print('═' * 72)

    return 1 if fatal else 0


if __name__ == '__main__':
    sys.exit(main())
