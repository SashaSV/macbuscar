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
// Each plan exposes a `providers` array because most Spanish retailers
// offer the same installment terms through more than one financing
// partner at checkout — the user picks which bank they prefer. We
// render every provider in the row as its own coloured chip so the
// listing matches what the retailer's own product page advertises.
//
// Plans listed here are interest-free promos (0% TAE) that the store
// publishes as a standing offer for Apple gear — verified 2026-06-25
// against each retailer's financing page. They renew roughly once a
// year when bank partnerships are reviewed.
//
// When a scraper DOES extract real per-SKU monthly (K-tuin currently
// the only one), it always wins — the API back-fill only fires for
// price rows whose monthlyPrice is null.

export const STORE_FINANCING_DEFAULTS = {
  // Apple Store ES — CaixaBank 0% TAE up to 24 months on Apple gear.
  apple: [
    { providers: ['CaixaBank'], months: 24, minAmount: 49 },
  ],

  // Amazon ES — Openbank Pay + Cofidis, 0% TAE. Two standing tiers:
  //   * ≥600 € : 6 cuotas (Apple gear typically lands here)
  //   * 60-599 € : 4 cuotas ("Paga en 4")
  // Openbank Pay is the promoted partner for Apple SKUs but Cofidis
  // offers the same terms through its credit line; both appear at
  // Amazon checkout, so we show both chips.
  amazon: [
    { providers: ['Openbank Pay', 'Cofidis'], months: 6, minAmount: 600 },
    { providers: ['Openbank Pay', 'Cofidis'], months: 4, minAmount: 60  },
  ],

  // K-tuin — three providers at checkout (Cetelem, Aplazame,
  // CaixaBank), all 24mo 0% TAE on Apple gear. Scraper extracts the
  // real per-SKU monthly (currently from the Cetelem widget) but the
  // API enriches the providers list from this entry so the UI shows
  // every chip the store actually offers.
  ktuin: [
    { providers: ['Cetelem', 'Aplazame', 'CaixaBank'], months: 24, minAmount: 100 },
  ],

  // PcComponentes — three financing partners visible on product
  // pages: Aplazame (Wizink), Cetelem, Sequra. The condiciones page
  // also lists CaixaBank as a financing entity but it's only offered
  // at checkout for direct transfers, not as an installment widget,
  // so we don't surface it here. Standing 0% TAE tier runs up to 12
  // months on electronics, with shorter terms for smaller carts.
  pccomp: [
    { providers: ['Aplazame', 'Cetelem', 'Sequra'], months: 12, minAmount: 100 },
    { providers: ['Aplazame', 'Cetelem', 'Sequra'], months: 6,  minAmount: 50  },
    { providers: ['Aplazame', 'Cetelem', 'Sequra'], months: 3,  minAmount: 30  },
  ],

  // MediaMarkt — Cetelem "Sin Intereses" 24mo above 99 €, 12mo
  // available on smaller purchases.
  mediamarkt: [
    { providers: ['Cetelem'], months: 24, minAmount: 99 },
    { providers: ['Cetelem'], months: 12, minAmount: 50 },
  ],

  // Worten — three standing 0% TAE paths verified on the retailer's
  // own financiacion page:
  //   * Klarna "Paga en 3" — 3 cuotas, min ≈35 €
  //   * Oney Fácil Pay — 3/4/6 cuotas via any card, min 90 €, cap 2500 €
  //   * Tarjeta Worten Mastercard — 3 mo standard 0% (longer during
  //     promos); issued through Santander Consumer / Oney back-end
  //
  // All three chips render at every tier even though their individual
  // term ceilings differ — same pattern PcComponentes uses, and it
  // matches what the seller's checkout actually shows ("financia con
  // Klarna / Oney / Tarjeta Worten" appears as a unified row). The
  // displayed term reflects the longest plan that applies to the
  // price; the chips identify the available providers for the buyer
  // to choose from at checkout.
  worten: [
    { providers: ['Oney', 'Tarjeta Worten', 'Klarna'], months: 6, minAmount: 90 },
    { providers: ['Klarna', 'Oney', 'Tarjeta Worten'], months: 3, minAmount: 35 },
  ],

  // El Corte Inglés — Apple gear has a dedicated 12mo 0% TIN plan via
  // Financiera ECI ("Financiación Total Apple"). The broader 24/36mo
  // ECI promotion explicitly excludes Apple, so we don't model it.
  elcorte: [
    { providers: ['Financiera El Corte Inglés'], months: 12, minAmount: 200 },
  ],

  // Fnac — Oney 12mo standing 0% on electronics over 99 €.
  fnac: [
    { providers: ['Oney'], months: 12, minAmount: 99 },
  ],

  // Rossellimac — Apple Premium Reseller. Standing offer is 10mo at
  // 0% TAE via Cetelem, with Aplazame and Klarna available as
  // alternative partners at checkout. Min purchase 120 €. Verified
  // 26 Jun 2026 on their financiacion page + PDP widgets.
  rossellimac: [
    { providers: ['Cetelem', 'Aplazame', 'Klarna'], months: 10, minAmount: 120 },
  ],
};

/**
 * Synthesize a fallback monthly payment from the store's published
 * financing plans. Returns null when none of the plans applies (price
 * below every plan's minAmount, or the store has no plans registered)
 * — we'd rather render nothing than promise installment terms the
 * store would refuse at checkout.
 *
 * Returned object marks `computed: true` for callers that want a UI
 * cue ("≈", tooltip) distinguishing synthesized terms from terms a
 * scraper read directly off a product page.
 *
 * `providers` is always an array, even for stores with a single bank,
 * so the renderer can map without branching.
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
      financingProviders: plan.providers,
      monthlyApr:        0,
      computed:          true,
    };
  }
  return null;
}
