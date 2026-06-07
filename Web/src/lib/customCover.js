import fs from 'fs';
import path from 'path';

const COVERS_DIR = path.join(process.cwd(), 'public', 'productscover');

// Look for .webp first (post-optimization), fall back to .png so the site
// keeps working during the migration period when only some images have
// been converted yet.
function findExisting(slug, suffix) {
  const webp = path.join(COVERS_DIR, `${slug}${suffix}.webp`);
  if (fs.existsSync(webp)) return `/productscover/${slug}${suffix}.webp`;
  const png = path.join(COVERS_DIR, `${slug}${suffix}.png`);
  if (fs.existsSync(png)) return `/productscover/${slug}${suffix}.png`;
  return null;
}

export function resolveCustomCover(slug) {
  if (!slug) return { cover: null, hover: null };
  return {
    cover: findExisting(slug, ''),
    hover: findExisting(slug, '-hover'),
  };
}
