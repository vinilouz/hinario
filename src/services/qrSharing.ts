import QRCode from 'qrcode';
import type { QrSetlistPayload, SetlistItem, Song } from '../types';

// qrcode@1.5.4 byte-mode data capacity at version 40 (lib/core/version.js EC_CODEWORDS_TABLE):
// L=2953, M=2331, Q=1663, H=1273. Above 2953 no version fits and toDataURL throws.
const BYTE_CAPACITY_AT_M = 2331;

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

export async function encodeSetlistToPayload(
  name: string,
  items: SetlistItem[],
  songs?: Song[]
): Promise<string> {
  const payload: QrSetlistPayload = {
    v: 2,
    n: name.trim().slice(0, 40),
    s: items.map((it) => [it.songId, it.customKey]),
    songs: songs && songs.length > 0 ? songs : undefined
  };

  const jsonStr = JSON.stringify(payload);
  return compressString(jsonStr);
}

export async function decodePayloadToSetlist(
  raw: string
): Promise<{
  name: string;
  items: { songId: string; customKey: string }[];
  songs?: Song[];
} | null> {
  try {
    const jsonStr = await decompressString(raw);
    const parsed: QrSetlistPayload = JSON.parse(jsonStr);

    if (!parsed || !parsed.n || !Array.isArray(parsed.s)) {
      return null;
    }

    return {
      name: parsed.n,
      items: parsed.s.map(([songId, customKey]) => ({
        songId,
        customKey: customKey || 'C'
      })),
      songs: Array.isArray(parsed.songs) ? parsed.songs : undefined
    };
  } catch (err) {
    console.warn('Falha ao decodificar QR/código:', err);
    return null;
  }
}

export async function generateQrDataUrl(payload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: pickErrorCorrectionLevel(payload.length),
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
