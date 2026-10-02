import QRCode from 'qrcode';
import type { QrTransferPayload, Song } from '../types';

// qrcode@1.5.4 byte-mode data capacity at version 40 (lib/core/version.js EC_CODEWORDS_TABLE):
// L=2953, M=2331, Q=1663, H=1273. Above 2953 no version fits and toDataURL throws.
const BYTE_CAPACITY_AT_M = 2331;
const LIST_NAME_MAX_LENGTH = 40;

export function pickErrorCorrectionLevel(payloadBytes: number): 'L' | 'M' {
  return payloadBytes > BYTE_CAPACITY_AT_M ? 'L' : 'M';
}

export async function compressString(str: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') {
    return btoa(unescape(encodeURIComponent(str)));
  }
  try {
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const buffer = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

export async function decompressString(encoded: string): Promise<string> {
  const clean = encoded.replace(/^BZN[12]:/, '').trim();

  if (clean.startsWith('{')) {
    return clean;
  }

  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  } catch {
    try {
      return decodeURIComponent(escape(atob(clean)));
    } catch {
      return clean;
    }
  }
}

export async function encodeSongTransfer(song: Song): Promise<string> {
  const payload: QrTransferPayload = { v: 4, kind: 'song', song };
  return compressString(JSON.stringify(payload));
}

export async function encodeSetlistTransfer(
  name: string,
  entries: { customKey: string; song: Song }[]
): Promise<string[]> {
  const listName = name.trim().slice(0, LIST_NAME_MAX_LENGTH);
  return Promise.all(
    entries.map(({ customKey, song }, i) => {
      const payload: QrTransferPayload = {
        v: 4,
        kind: 'list',
        i,
        t: entries.length,
        n: listName,
        k: customKey,
        song
      };
      return compressString(JSON.stringify(payload));
    })
  );
}

const isFilledString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const isSong = (value: unknown): value is Song => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return isFilledString(candidate.title) && isFilledString(candidate.content);
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export async function decodeTransfer(raw: string): Promise<QrTransferPayload | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await decompressString(raw));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const envelope = parsed as Record<string, unknown>;

  if (envelope.v !== 4) return null;
  if (!isSong(envelope.song)) return null;

  if (envelope.kind === 'song') {
    return { v: 4, kind: 'song', song: envelope.song };
  }

  if (envelope.kind !== 'list') return null;
  if (!isFiniteNumber(envelope.i) || !isFiniteNumber(envelope.t)) return null;
  if (typeof envelope.n !== 'string' || typeof envelope.k !== 'string') return null;

  return {
    v: 4,
    kind: 'list',
    i: envelope.i,
    t: envelope.t,
    n: envelope.n,
    k: envelope.k,
    song: envelope.song
  };
}

export async function generateQrDataUrl(payload: string, forceLevel?: 'L' | 'M'): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: forceLevel ?? pickErrorCorrectionLevel(payload.length),
      margin: 2,
      color: {
        dark: '#1D1211',
        light: '#FFF8F0'
      },
      width: 320
    });
  } catch (err) {
    console.warn('QR code muito grande para renderização visual:', err);
    return '';
  }
}
