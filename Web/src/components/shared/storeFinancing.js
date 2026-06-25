// Web/src/components/shared/storeFinancing.js
//
// Default monthly-installment plans per store — used as a fallback when
// the scraper hasn't parsed per-SKU financing data from a price row.
//
// Each store gets an ARRAY of plans, sorted longest-term first.
// computeMonthlyFallback walks the array and picks the LONGEST plan
// whose minAmount the price satisfies — that gives the user the lowest
// monthly figure available at their price tier (the cue that drives
// the "puedo permitirme un iPhone Pro" decision in Spain).
//
// Plans listed here are interest-free promos (0% TAE) that the store
// publishes as a standing offer for Apple gear — verified 2026-06-24
// against each retailer's financing page. They renew roughly once a
// year when bank partnerships are reviewed.
//
// When a scraper DOES extract real per-SKU monthly (K-tuin currently
// the only one), it always wins — the API back-fill only fires for
// price rows whose monthlyPrice is null.

export const STORE_FINANCING_DEFAULTS = {
  // Apple Store ES — CaixaBank 0% TAE up to 24 months on Apple gear.
  apple: [
    { provider: 'CaixaBank', months: 24, minAmount: 49 },
  ],

  // Amazon ES — Openbank Pay, 0% TAE. Two standing tiers:
  //   * ≥6 00 € : 6 cuotas (Apple gear typically lands here)
  //   * 60-599 € : 4 cuotas ("Paga en 4")
  // computeMonthlyFallback walks longest first, so the 6mo plan
  // applies whenever price clears 600 € and the 4mo plan handles
  // everything from accessories up to the cap.
  amazon: [
    { provider: 'Openbank Pay', months: 6, minAmount: 600 },
    { provider: 'Openbank Pay', months: 4, minAmount: 60  },
  ],

  // K-tuin — Cetelem 24mo standing offer. Scraper already extracts
  // the real monthly per SKU; this is a safety net only.
  ktuin: [
    { provider: 'Cetelem', months: 24, minAmount: 100 },
  ],

  // PcComponentes — Aplazame, 0% TAE. Standard tiers 3/6/12 months
  // depending on cart total.
  pccomp: [
    { provider: 'Aplazame', months: 12, minAmount: 100 },
    { provider: 'Aplazame', months: 6,  minAmount: 50  },
    { provider: 'Aplazame', months: 3,  minAmount: 30  },
  ],

  // MediaMarkt — Cetelem "Sin Intereses" 24mo above 99 €, 12mo
  // available on smaller purchases.
  mediamarkt: [
    { provider: 'Cetelem', months: 24, minAmount: 99 },
    { provider: 'Cetelem', months: 12, minAmount: 50 },
  ],

  // Worten — Klarna "Paga en 3", 3 cuotas 0% TAE. Min purchase ≈35 €.
  worten: [
    { provider: 'Klarna', months: 3, minAmount: 35 },
  ],

  // El Corte Inglés — Apple gear has a dedicated 12mo 0% TIN plan via
  // Financiera ECI ("Financiación Total Apple"). The broader 24/36mo
  // ECI promotion explicitly excludes Apple, so we don't model it.
  elcorte: [
    { provider: 'Financiera El Corte Inglés', months: 12, minAmount: 200 },
  ],

  // Fnac — Oney 12mo standing 0% on electronics over 99 €.
  fnac: [
    { provider: 'Oney', months: 12, minAmount: 99 },
  ],
};

/**
 * Synthesize a fallback monthly payment from the store's published
 * financing plans. Returns null when none of the plans applies (price
 * below every plan's minAmount, or the store has no plans registered)
 * — we'd rather render nothing than promise installment terms the
 * store would refuse at checkout.
 *
 * Returned object marks `computed: true` so the UI can show a "≈" cue
 * and a clarifying tooltip. If a store ever switches a plan to a
 * paid-interest promo we'd need to extend the schema with `apr` per
 * plan and revisit the renderer.
 */
export function computeMonthlyFallback(price, storeId) {
  if (!price || price <= 0) return null;
  const plans = STORE_FINANCING_DEFAULTS[storeId];
  if (!plans || !plans.length) return null;

  // Plans are pre-sorted longest-term first, so we hit the most
  // user-friendly monthly that fits the price tier.
  for (const plan of plans) {
    if (price < plan.minAmount) continue;
    const monthly = Math.round((price / plan.months) * 100) / 100;
    // Sub-€5 monthlies look spammy and usually mean the price is at
    // the edge of the tier — skip in favour of the next (shorter)
    // plan, or return null if no plan applies.
    if (monthly < 5) continue;
    return {
      monthlyPrice:      monthly,
      monthlyMonths:     plan.months,
      financingProvider: plan.provider,
      monthlyApr:        0,
      computed:          true,
    };
  }
  return null;
}
