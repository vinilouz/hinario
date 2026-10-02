import { db } from "../db/dexie";
import { extractCifraClubKey, detectFormat, COMMON_KEYS } from "./chordEngine";
import type { Song, SongLeader } from "../types";

export const SEED_ID_PREFIX = "seed_";

const LEGACY_TOMBSTONE_KEY = "hinario_deleted_seed_songs";
const SEED_DONE_KEY = "hinario_seed_package_installed";
const SEED_TIMESTAMP = 1710000000000;

// Vite lazy glob of all txt files in public/data directory
const rawSongModules = import.meta.glob<string>("../../public/data/*.txt", {
  query: "?raw",
  import: "default"
});

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanContentBody(content: string): string {
  const lines = content.split(/\r?\n/);
  const bodyLines: string[] = [];
  let pastHeaders = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!pastHeaders) {
      if (/^(?:T[ií]tulo|Artista|Autor|Tom:|tom\s+[A-G]|BPM:|Tempo:|Capotraste:|Afinação:)/i.test(trimmed)) {
        continue;
      }
      if (trimmed === "") {
        continue;
      }
      pastHeaders = true;
    }
    bodyLines.push(line);
  }
  return bodyLines.join("\n").trim();
}

interface BaseSongEntry {
  id: string;
  title: string;
  artist: string;
  leader: SongLeader;
  loader: () => Promise<string>;
}

const baseEntries = new Map<string, BaseSongEntry>();

for (const [filePath, loader] of Object.entries(rawSongModules)) {
  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);
  const baseName = fileName.replace(/\.txt$/, "");
  const [rawLeader, ...titleParts] = baseName.split(/\s*-\s*/);
  const leader: SongLeader = (["Doni", "Lucas", "Magu", "Igreja"].includes(rawLeader)
    ? rawLeader
    : "Igreja") as SongLeader;
  const title = (titleParts.length > 0 ? titleParts.join(" - ") : rawLeader).trim();

  let artist = leader;
  const fnArtistMatch = fileName.match(/\(([^)]+)\)\.[^.]+$/);
  if (fnArtistMatch && fnArtistMatch[1] !== "P") {
    artist = fnArtistMatch[1].trim();
  }

  const id = `${SEED_ID_PREFIX}${leader.toLowerCase()}_${slugify(title)}`;

  baseEntries.set(id, { id, title, artist, leader, loader });
}

async function parseBaseSong(entry: BaseSongEntry): Promise<Song> {
  const rawText = await entry.loader();
  const detectedKey = extractCifraClubKey(rawText);
  const originalKey = detectedKey && COMMON_KEYS.includes(detectedKey) ? detectedKey : "C";

  const aMatch = rawText.match(/^\s*Artista\s*:\s*(.*)$/im);
  const artist = aMatch ? aMatch[1].trim() : entry.artist;

  let bpm: number | undefined = undefined;
  const bpmMatch = rawText.match(/^\s*BPM\s*:\s*(\d+(?:[.,]\d+)?)/im);
  if (bpmMatch) {
    const val = parseInt(bpmMatch[1].replace(",", "."), 10);
    if (!isNaN(val) && val >= 30 && val <= 300) bpm = val;
  }

  const content = cleanContentBody(rawText);

  return {
    id: entry.id,
    title: entry.title,
    artist,
    leader: entry.leader,
    bpm,
    originalKey,
    format: detectFormat(content),
    content,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP
  };
}

function readLegacyTombstones(): Set<string> {
  const raw = localStorage.getItem(LEGACY_TOMBSTONE_KEY);
  if (raw === null) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

export async function ensureSeeded(): Promise<void> {
  if (localStorage.getItem(SEED_DONE_KEY) === "true") return;

  const existingIds = new Set((await db.songs.toArray()).map((song) => song.id));
  const legacyDeletedIds = readLegacyTombstones();
  const missing = Array.from(baseEntries.values()).filter(
    (entry) => !existingIds.has(entry.id) && !legacyDeletedIds.has(entry.id)
  );

  const seeded = await Promise.all(
    missing.map(async (entry) => {
      try {
        return await parseBaseSong(entry);
      } catch (err) {
        console.warn(`Falha ao carregar ${entry.id} do pacote offline:`, err);
        return null;
      }
    })
  );

  const songs = seeded.filter((song): song is Song => song !== null);
  if (songs.length > 0) {
    await db.songs.bulkPut(songs);
  }

  localStorage.setItem(SEED_DONE_KEY, "true");
  localStorage.removeItem(LEGACY_TOMBSTONE_KEY);
}

export async function getAllSongs(): Promise<Song[]> {
  return db.songs.toArray();
}

export async function getSongById(id: string): Promise<Song | null> {
  const song = await db.songs.get(id);
  return song ?? null;
}

export async function saveSong(song: Song): Promise<void> {
  await db.songs.put(song);
}

export async function deleteSong(id: string): Promise<void> {
  await db.songs.delete(id);
}