// Web/src/components/shared/listingLifecycle.js
//
// Lifecycle thresholds for 2ª mano Listings. We don't have a personal
// area where a seller can mark an ad as sold or renew it, so the feed
// would otherwise stay cluttered with stale offers (sold, price moved,
// seller lost interest). These constants are the policy that hides
// old ads automatically, with a soft warning chip on ones that are
// nearing expiry — a buyer signal AND an implicit nudge for the
// seller to re-post if the item is still available.
//
// Tuning notes:
//   - HIDE_AFTER_DAYS = 30 mirrors what Wallapop / Milanuncios / Vinted
//     show empirically (after a month a non-renewed ad is almost
//     never still on offer at the original price).
//   - STALE_AFTER_DAYS = 21 gives the buyer 9-day warning window
//     before the listing disappears. Long enough to surface in
//     several user sessions, short enough that "antiguo" actually
//     means antiguo.
//
// When personal cabinet ships and sellers can renew/mark-sold by hand,
// these become defaults rather than hard rules — extend lifecycle on
// any "renovar" action and you instantly get tiered expiry.

export const STALE_AFTER_DAYS = 21;
export const HIDE_AFTER_DAYS  = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the Date past which a Listing should be hidden from public
 * feeds. Use it as a WHERE clause floor on Listing.createdAt — every
 * row OLDER than this gets filtered out at query time. Keeping the
 * rows in the DB (rather than soft-deleting) means we can change the
 * window later or surface old ads in seller analytics, without ever
 * losing data.
 */
export function listingHideThreshold() {
  return new Date(Date.now() - HIDE_AFTER_DAYS * MS_PER_DAY);
}

/**
 * Age of a listing in whole days. Robust to listings created seconds
 * ago (returns 0, not negative) and to malformed timestamps (returns
 * 0 instead of NaN cascading through UI).
 */
export function listingAgeDays(createdAt) {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / MS_PER_DAY));
}

/**
 * True when a Listing has crossed STALE_AFTER_DAYS but hasn't been
 * filtered out yet. UI uses this to add a yellow "Antiguo" chip
 * that warns the buyer to verify with the seller AND signals to
 * the seller it's almost time to repost.
 */
export function isStaleListing(createdAt) {
  return listingAgeDays(createdAt) >= STALE_AFTER_DAYS;
}
