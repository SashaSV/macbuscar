'use client';
import { IconBrandApple, IconCircleCheck } from '@tabler/icons-react';

/**
 * Trust badge that surfaces a store's Apple authorization tier.
 *
 * Renders next to the store name in Modal Precios cards. The badge is
 * the at-a-glance answer to the buyer's silent question "is this place
 * legit for Apple gear?" — full warranty, genuine SKUs, etc. Apple's
 * own retailer locator (locate.apple.com) is the source of truth for
 * the tier classification.
 *
 * Visual hierarchy mirrors the trust hierarchy:
 *
 *   premium    Apple Premium Reseller  — top tier, blue Apple logo
 *              chip with subtle gradient. K-tuin, PcComponentes,
 *              iStore, Rossellimac.
 *
 *   authorized Authorized Reseller     — standard tier, smaller
 *              Apple-logo-only chip in muted gray. MediaMarkt,
 *              El Corte Inglés, Fnac.
 *
 *   mixed      "Verifica vendedor"     — amber caution chip for
 *              marketplaces where SOME SKUs are authorized but you
 *              must check the seller per listing. Amazon.
 *
 *   official   — nothing rendered. Apple IS Apple; a "this is Apple"
 *              badge on apple.com is noise. Caller can branch on this
 *              if they want a different cue, but the badge stays silent.
 *
 *   null / other — nothing rendered. Quiet absence is friendlier than
 *              an explicit "unauthorized" warning, and it avoids
 *              implying genuine product from non-listed stores is fake
 *              (Worten sells genuine Apple gear, just not formally
 *              authorized).
 *
 * Hover/title carries the human-readable label so AT users and curious
 * pointer users can dig into the meaning without us spending precious
 * card width on long text.
 */
export default function AppleAuthBadge({ level, size = 'sm' }) {
  if (!level || level === 'official') return null;

  const cfg = {
    premium: {
      label: 'Apple Premium Reseller',
      short: 'Premium',
      bg:    'rgba(0,113,227,0.12)',
      border:'rgba(0,113,227,0.35)',
      color: '#0066CC',
      icon:  IconBrandApple,
    },
    authorized: {
      label: 'Authorized Apple Reseller',
      short: 'Apple Auth.',
      bg:    'rgba(29,29,31,0.06)',
      border:'rgba(29,29,31,0.18)',
      color: 'rgba(29,29,31,0.7)',
      icon:  IconBrandApple,
    },
    mixed: {
      label: 'Verifica vendedor — solo SKUs vendidas por Amazon son oficiales',
      short: 'Verifica',
      bg:    'rgba(245,158,11,0.10)',
      border:'rgba(245,158,11,0.40)',
      color: '#b45309',
      icon:  IconCircleCheck,
    },
  }[level];

  if (!cfg) return null;

  const Icon = cfg.icon;
  const isXs = size === 'xs';
  // Mini-chip dimensions tuned to sit on the same baseline as the store
  // name without dominating the row. iconSize keeps the Apple glyph the
  // same visual weight as the surrounding text x-height.
  const iconSize = isXs ? 10 : 11;
  const fontSize = isXs ? 9  : 10;
  const padY     = isXs ? 1  : 2;
  const padX     = isXs ? 5  : 6;

  return (
    <span
      title={cfg.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: `${padY}px ${padX}px`,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 980,
        fontSize,
        fontWeight: 600,
        color: cfg.color,
        letterSpacing: 0.1,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} stroke={2} />
      {cfg.short}
    </span>
  );
}
