import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import QRCode from 'qrcode';
import {
  compressString,
  decodeTransfer,
  encodeSetlistTransfer,
  encodeSongTransfer,
  generateQrDataUrl,
  pickErrorCorrectionLevel,
} from '../src/services/qrSharing';
import type { Song } from '../src/types';

const SONG_DIR = 'public/data';
const SONG_COUNT = 15;
const BYTE_CAPACITY_AT_L = 2953;
const LIST_NAME = 'Missa de Sexta';
const CUSTOM_KEYS = ['C', 'G', 'D', 'Am', 'F', 'Bb', 'Em', 'A', 'Dm', 'G', 'C', 'E', 'Am', 'F', 'G'];

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

// 1. One song in, one song out, cifras intact.
const singleDecoded = await decodeTransfer(await encodeSongTransfer(songs[0]));
assert.ok(singleDecoded?.kind === 'song', 'single share decodes as kind=song');
assert.equal(singleDecoded.song.title, songs[0].title, 'title survives the round trip');
assert.equal(singleDecoded.song.id, songs[0].id, 'id survives the round trip');
assert.equal(singleDecoded.song.content, songs[0].content, 'full content survives the round trip');

// 2. A list share is one self-contained code per song.
const entries = songs.map((song, i) => ({ customKey: CUSTOM_KEYS[i], song }));
const listPayloads = await encodeSetlistTransfer(LIST_NAME, entries);
assert.equal(listPayloads.length, SONG_COUNT, 'one payload per song');
assert.equal(new Set(listPayloads).size, SONG_COUNT, 'payloads must differ per song');

for (const [i, payload] of listPayloads.entries()) {
  const decoded = await decodeTransfer(payload);
  assert.ok(decoded?.kind === 'list', `payload ${i} decodes as kind=list`);
  assert.equal(decoded.i, i, `payload ${i} carries its 0-based index`);
  assert.equal(decoded.t, SONG_COUNT, `payload ${i} carries the total`);
  assert.equal(decoded.n, LIST_NAME, `payload ${i} carries the list name`);
  assert.equal(decoded.k, CUSTOM_KEYS[i], `payload ${i} carries its own customKey`);
  assert.equal(decoded.song.content, songs[i].content, `payload ${i} carries real cifras`);
}

// 3. Every single-song payload renders as a QR at both levels, under the L cap.
const singlePayloads = await Promise.all(songs.map((song) => encodeSongTransfer(song)));
let largestBytes = 0;

for (const payload of [...singlePayloads, ...listPayloads]) {
  const bytes = Buffer.byteLength(payload, 'utf8');
  largestBytes = Math.max(largestBytes, bytes);
  assert.ok(bytes <= BYTE_CAPACITY_AT_L, `${bytes}B payload exceeds the ${BYTE_CAPACITY_AT_L}B cap`);

  for (const level of ['M', 'L'] as const) {
    QRCode.create(payload, { errorCorrectionLevel: level });
    assert.notEqual(await generateQrDataUrl(payload, level), '', `payload must render at ${level}`);
  }
}

assert.equal(pickErrorCorrectionLevel(largestBytes), 'M', 'a single song fits EC M without paging');

// 4. Trust boundary: nothing but a valid v4 envelope decodes.
const legacyV1 = `BZN1:${await compressString(JSON.stringify({ v: 1, n: 'Lista', s: [[songs[0].id, 'C']] }))}`;
const legacyV2 = `BZN2:${await compressString(JSON.stringify({ v: 2, n: 'Lista', s: [[songs[0].id, 'C']], songs }))}`;
const rejects: [string, string][] = [
  ['empty object', '{}'],
  ['wrong version', JSON.stringify({ v: 3, kind: 'song', song: songs[0] })],
  ['unknown kind', JSON.stringify({ v: 4, kind: 'chunk', song: songs[0] })],
  ['missing content', JSON.stringify({ v: 4, kind: 'song', song: { ...songs[0], content: '' } })],
  ['garbage string', 'nao-e-json-%%'],
  ['legacy BZN1', legacyV1],
  ['legacy BZN2', legacyV2],
];

for (const [label, raw] of rejects) {
  assert.equal(await decodeTransfer(raw), null, `${label} must decode to null`);
}

// 5. Chunked-paging API is gone.
const qrSharing = await import('../src/services/qrSharing');
const removed = ['splitIntoQrChunks', 'joinQrChunks', 'parseQrChunk', 'QR_CHUNK_BUDGET', 'encodeSetlistToPayload', 'decodePayloadToSetlist'];
for (const name of removed) {
  assert.ok(!(name in qrSharing), `${name} must no longer be exported`);
}

console.log(
  `ok: single-song round trip + ${listPayloads.length} list pages (1 per song) | ` +
  `largest single-song payload ${largestBytes}B (cap ${BYTE_CAPACITY_AT_L}B, renders at M and L) | ` +
  `${rejects.length} malformed inputs rejected | ${removed.length} chunk helpers removed`
);