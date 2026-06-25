/**
 * BankBadge — small colored pill showing the financing provider's brand.
 *
 * Used under store price cards to make "desde X €/mes ×N" lines more
 * scannable: a user spotting the CaixaBank blue or Cetelem green can
 * tell at a glance who's behind the installment plan without reading.
 *
 * Design rationale:
 *   - Subtle tinted background + saturated brand text (Apple-style chips)
 *     reads as a label, not a CTA. Stops it from drawing the eye away
 *     from the price itself.
 *   - A tiny symbol prefix (★ / ● / ◆) gives an icon-like silhouette
 *     when the page is zoomed out or skimmed quickly. We avoid real
 *     bank logos (they would need to live in /public/banks/ and carry
 *     copyright considerations) — the colored pill carries the brand
 *     recognition just as well at this small size.
 *
 * Adding a new bank: add an entry to BANK_STYLES below. Unknown
 * providers fall through to a neutral grey pill so the UI never breaks.
 */

// Brand palette — keep these aligned with each bank's official colour.
// `bg` is the chip background (low-opacity tint of the brand colour so
// it doesn't fight with the surrounding card); `text` is the saturated
// brand colour for legibility; `symbol` is a tiny iconic prefix that
// loosely mimics each bank's identity (CaixaBank's star, Cetelem's dot,
// MediaMarkt's diamond, etc).
const BANK_STYLES = {
  'CaixaBank':                  { bg: 'rgba(2, 85, 156, 0.10)',    text: '#02559C', symbol: '★' },
  'Cetelem':                    { bg: 'rgba(0, 168, 89, 0.12)',    text: '#008941', symbol: '●' },
  'Worten Crédito':             { bg: 'rgba(247, 82, 0, 0.12)',    text: '#D44600', symbol: '●' },
  'MediaMarkt VISA':            { bg: 'rgba(214, 0, 0, 0.10)',     text: '#B30000', symbol: '◆' },
  'Amazon Financing':           { bg: 'rgba(255, 153, 0, 0.14)',   text: '#B85B00', symbol: '◆' },
  'Cofidis':                    { bg: 'rgba(102, 51, 153, 0.10)',  text: '#663399', symbol: '◆' },
  'Younited':                   { bg: 'rgba(35, 47, 62, 0.10)',    text: '#1F2A37', symbol: '●' },
  'Aplazame':                   { bg: 'rgba(255, 90, 95, 0.10)',   text: '#C7314F', symbol: '●' },
  // Klarna — brand pink (#FFA8CD) on near-black text. Subtle tint
  // keeps the chip readable while still cueing Klarna's signature
  // colour. Worten's "Paga en 3 con Klarna" promo.
  'Klarna':                     { bg: 'rgba(255, 168, 205, 0.22)', text: '#A8005C', symbol: '●' },
  // Openbank Pay — Santander-red identity (#EC0000) but Openbank's
  // own brand uses a slightly cooler magenta/red. Pay is Amazon ES's
  // 6-cuota 0% partner.
  'Openbank Pay':               { bg: 'rgba(236, 0, 0, 0.10)',     text: '#C30000', symbol: '◆' },
  // Financiera El Corte Inglés — ECI's in-house Apple 0% plan. Match
  // the same muted grey ECI uses in their own UI for finance lines.
  'Financiera El Corte Inglés': { bg: 'rgba(29, 29, 31, 0.06)',    text: '#1d1d1f', symbol: '◆' },
  // Oney — Fnac's standing 0% partner.
  'Oney':                       { bg: 'rgba(45, 95, 155, 0.10)',   text: '#1F4B7C', symbol: '●' },
  // Tarjeta Worten Mastercard — issued through Santander Consumer /
  // Oney back-end. Use Worten's coral-orange brand colour so the chip
  // reads as Worten-branded rather than just "a generic Mastercard".
  'Tarjeta Worten':             { bg: 'rgba(247, 82, 0, 0.10)',    text: '#D44600', symbol: '◆' },
  // Sequra — BNPL platform used by PcComponentes and many other ES
  // retailers. Brand colour is deep teal.
  'Sequra':                     { bg: 'rgba(0, 138, 138, 0.12)',   text: '#006666', symbol: '●' },
};
const NEUTRAL = { bg: 'rgba(0, 0, 0, 0.06)', text: '#1d1d1f', symbol: '●' };

export default function BankBadge({ provider }) {
  if (!provider) return null;
  const c = BANK_STYLES[provider] || NEUTRAL;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: c.bg,
        color: c.text,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.1,
        padding: '1.5px 7px 1.5px 6px',
        borderRadius: 999,
        lineHeight: 1.4,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        // Slight inset shadow gives the chip a touch of depth without
        // looking like a button.
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ fontSize: 7, lineHeight: 1, opacity: 0.85 }}>{c.symbol}</span>
      {provider}
    </span>
  );
}
