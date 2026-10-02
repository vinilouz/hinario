import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import QRCode from 'qrcode';
import {
  encodeSetlistToPayload,
  decodePayloadToSetlist,
  pickErrorCorrectionLevel,
} from '../src/services/qrSharing';
import type { SetlistItem, Song } from '../src/types';

const SONG_DIR = 'public/data';
const SONG_COUNT = 15;

const songs: Song[] = readdirSync(SONG_DIR)
  .slice(0, SONG_COUNT)
  .map((file, i) => ({
    id: `bundled-song-${i}`,
    title: file.replace(/\.txt$/, ''),
    artist: 'Banda',
    originalKey: 'C',
    content: readFileSync(`${SONG_DIR}/${file}`, 'utf8'),
    format: 'chords-over-lyrics',
    createdAt: 1,
    updatedAt: 1,
    isDeleted: false,
    deletedAt: null,
  }));

const items: SetlistItem[] = songs.map((song, i) => ({
  songId: song.id,
  customKey: 'C',
  order: i,
}));

const encodesAt = (level: 'L' | 'M', bytes: number): boolean => {
  try {
    QRCode.create('a'.repeat(bytes), { errorCorrectionLevel: level });
    return true;
  } catch {
    return false;
  }
};

// 1. ECC threshold equals qrcode@1.5.4 byte-mode capacity at version 40.
assert.equal(encodesAt('M', 2331), true, 'M holds 2331B');
assert.equal(encodesAt('M', 2332), false, 'M caps at 2331B');
assert.equal(encodesAt('L', 2953), true, 'L holds 2953B');
assert.equal(encodesAt('L', 2954), false, 'L caps at 2953B');

// 2. QR path: ids-only payload of a 15-song setlist stays at M and renders.
const idsPayload = await encodeSetlistToPayload('Missa de Sexta', items);
const idsLevel = pickErrorCorrectionLevel(idsPayload.length);
assert.equal(idsLevel, 'M', `ids-only ${idsPayload.length}B must keep M error correction`);
assert.equal(encodesAt(idsLevel, idsPayload.length), true, 'ids-only payload must encode at chosen level');
assert.notEqual(await QRCode.toDataURL(idsPayload, { errorCorrectionLevel: idsLevel, width: 320 }), '');

const idsDecoded = await decodePayloadToSetlist(idsPayload);
assert.notEqual(idsDecoded, null);
assert.equal(idsDecoded.items.length, SONG_COUNT);
assert.equal(idsDecoded.songs, undefined, 'ids-only payload must omit songs');

// 3. Paste path: full songs still round-trip, legacy BZN1/BZN2 prefixes still strip.
const fullPayload = await encodeSetlistToPayload('Missa de Sexta', items, songs);
assert.notEqual(fullPayload, idsPayload);
for (const raw of [fullPayload, `BZN1:${fullPayload}`, `BZN2:${fullPayload}`]) {
  const decoded = await decodePayloadToSetlist(raw);
  assert.equal(decoded.items.length, SONG_COUNT);
  assert.equal(decoded.songs?.length, SONG_COUNT);
  assert.equal(decoded.songs?.[0].content, songs[0].content);
}
assert.equal(
  encodesAt(pickErrorCorrectionLevel(fullPayload.length), fullPayload.length),
  false,
  'full-songs payload overflows every QR level, which is why paste exists'
);

console.log(
  `ok: ids-only ${idsPayload.length}B @${idsLevel} (renders) | full-songs ${fullPayload.length}B @${pickErrorCorrectionLevel(fullPayload.length)} (clipboard only)`
);
