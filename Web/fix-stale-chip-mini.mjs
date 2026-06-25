// Inject the "⚠ Antiguo" stale chip into renderListingCard in
// ModalProducto.jsx — surfaces between day 21 and day 30 so the buyer
// knows the listing may have moved/sold. Same logic as ListingCard
// in the 2ª mano tab. Run from Web/:
//   node fix-stale-chip-mini.mjs
import fs from 'fs';

const PATH = 'src/components/modals/ModalProducto.jsx';
let src = fs.readFileSync(PATH, 'utf8');

// We anchor on the estado pill INSIDE renderListingCard (the compact
// card). The block is unique because it lives inside the IIFE and uses
// the local `a` variable plus colorEstado() — appears once in the file.
const oldBlock =
  '                        {a.estado && (\n' +
  '                          <span style={{\n' +
  '                            background: colorEstado(a.estado) + \'22\',\n' +
  '                            color: colorEstado(a.estado),\n' +
  '                            fontSize: 9, fontWeight: 700,\n' +
  '                            padding: \'1px 7px\', borderRadius: 12,\n' +
  '                            textTransform: \'uppercase\', letterSpacing: 0.3,\n' +
  '                            flexShrink: 0,\n' +
  '                          }}>{a.estado}</span>\n' +
  '                        )}';

const newBlock =
  '                        {/* Stale-listing warning (21+ days old). Same\n' +
  '                            threshold as the full 2\u00aa-mano card, so the\n' +
  '                            buyer gets a consistent cue whether they\n' +
  '                            spotted the ad on Precios or in the dedicated\n' +
  '                            tab. */}\n' +
  '                        {isStaleListing(a.createdAt) && (\n' +
  '                          <span\n' +
  '                            title={`Publicado hace ${listingAgeDays(a.createdAt)} d\u00edas. Verifica disponibilidad con el vendedor.`}\n' +
  '                            style={{\n' +
  '                              background: \'rgba(245,158,11,0.20)\',\n' +
  '                              color: \'#b45309\',\n' +
  '                              fontSize: 9, fontWeight: 700,\n' +
  '                              padding: \'1px 7px\', borderRadius: 12,\n' +
  '                              textTransform: \'uppercase\', letterSpacing: 0.3,\n' +
  '                              flexShrink: 0, cursor: \'help\',\n' +
  '                            }}\n' +
  '                          >\u26a0 Antiguo</span>\n' +
  '                        )}\n' +
  '                        {a.estado && (\n' +
  '                          <span style={{\n' +
  '                            background: colorEstado(a.estado) + \'22\',\n' +
  '                            color: colorEstado(a.estado),\n' +
  '                            fontSize: 9, fontWeight: 700,\n' +
  '                            padding: \'1px 7px\', borderRadius: 12,\n' +
  '                            textTransform: \'uppercase\', letterSpacing: 0.3,\n' +
  '                            flexShrink: 0,\n' +
  '                          }}>{a.estado}</span>\n' +
  '                        )}';

if (!src.includes(oldBlock)) {
  console.error('Could not find estado pill block in renderListingCard');
  process.exit(1);
}
src = src.replace(oldBlock, newBlock);
fs.writeFileSync(PATH, src, 'utf8');
console.log('Injected ⚠ Antiguo chip into renderListingCard');
