import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import QRCode from 'qrcode';
import {
  encodeSetlistToPayload,
  decodePayloadToSetlist,
  pickErrorCorrectionLevel,
  splitIntoQrChunks,
  joinQrChunks,
  parseQrChunk,
  QR_CHUNK_BUDGET,
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

// 2. Full 15-song payload with embedded cifras exceeds one QR — ships as pages.
const fullPayload = await encodeSetlistToPayload('Missa de Sexta', items, songs);
assert.equal(
  encodesAt(pickErrorCorrectionLevel(fullPayload.length), fullPayload.length),
  false,
  'full-songs payload overflows every QR level, which is why pages exist'
);

const chunks = splitIntoQrChunks(fullPayload);
assert.ok(chunks.length > 1, `15 full songs must split into pages, got ${chunks.length}`);
for (const chunk of chunks) {
  assert.ok(chunk.length <= QR_CHUNK_BUDGET + 64, `chunk ${chunk.length}B must fit budget`);
  const level = pickErrorCorrectionLevel(chunk.length);
  assert.equal(encodesAt(level, chunk.length), true, 'every page must encode at chosen level');
  assert.notEqual(await QRCode.toDataURL(chunk, { errorCorrectionLevel: level, width: 320 }), '');
}

// 3. Pages reassemble in any scan order; missing/corrupt pages fail loud.
const shuffled = [...chunks].reverse();
assert.equal(joinQrChunks(shuffled), fullPayload, 'pages join out of order');
assert.equal(joinQrChunks(chunks.slice(1)), null, 'missing page must not join');
assert.equal(joinQrChunks([...chunks.slice(1), 'not a chunk']), null, 'corrupt page must not join');
assert.equal(parseQrChunk(fullPayload), null, 'raw payload is not a chunk envelope');

// 4. Reassembled payload decodes to full cifras, legacy prefixes still strip.
for (const raw of [fullPayload, `BZN1:${fullPayload}`, `BZN2:${fullPayload}`]) {
  const decoded = await decodePayloadToSetlist(raw);
  assert.equal(decoded.items.length, SONG_COUNT);
  assert.equal(decoded.songs?.length, SONG_COUNT);
  assert.equal(decoded.songs?.[0].content, songs[0].content);
}

// 5. Small payloads stay one page, no envelope.
const small = await encodeSetlistToPayload('Um louvor', items.slice(0, 1), songs.slice(0, 1));
assert.deepEqual(splitIntoQrChunks(small), [small], 'small payload must not paginate');

console.log(
  `ok: 15 full songs ${fullPayload.length}B -> ${chunks.length} pages (each renders) | reassembly + decode verified`
);
