import { db } from "../db/dexie";
import {
  saveSong as syncSaveSong,
  softDeleteSong as syncSoftDeleteSong,
  restoreSong as syncRestoreSong,
  hardDeleteSong as syncHardDeleteSong,
  readDeletedSeedIds,
  rememberDeletedSeedSong,
  forgetDeletedSeedSong,
  SEED_ID_PREFIX
} from "../db/sync";
import { extractCifraClubKey, detectFormat, COMMON_KEYS } from "./chordEngine";
import type { Song, SongLeader } from "../types";

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
  filePath: string;
  title: string;
  artist: string;
  leader: SongLeader;
  loader: () => Promise<string>;
}

const baseEntriesMap = new Map<string, BaseSongEntry>();

for (const [filePath, loader] of Object.entries(rawSongModules)) {
  const fileName = filePath.split("/").pop() || "";
  const baseName = fileName.replace(/\.txt$/, "");
  const [rawLeader, ...titleParts] = baseName.split(/\s*-\s*/);
  const leader: SongLeader = (["Doni", "Lucas", "Magu", "Igreja"].includes(rawLeader) ? rawLeader : "Igreja") as SongLeader;
  const title = (titleParts.length > 0 ? titleParts.join(" - ") : rawLeader).trim();

  let artist = leader;
  const fnArtistMatch = fileName.match(/\(([^)]+)\)\.[^.]+$/);
  if (fnArtistMatch && fnArtistMatch[1] !== "P") {
    artist = fnArtistMatch[1].trim();
  }

  const slug = slugify(title);
  const id = `${SEED_ID_PREFIX}${leader.toLowerCase()}_${slug}`;

  baseEntriesMap.set(id, {
    id,
    filePath,
    title,
    artist,
    leader,
    loader
  });
}

const parsedSongCache = new Map<string, Song>();
let isInitialized = false;

async function parseBaseSong(entry: BaseSongEntry): Promise<Song> {
  const rawText = await entry.loader();
  const detectedKey = extractCifraClubKey(rawText);
  const originalKey = detectedKey && COMMON_KEYS.includes(detectedKey) ? detectedKey : "C";

  let artist = entry.artist;
  const aMatch = rawText.match(/^\s*Artista\s*:\s*(.*)$/im);
  if (aMatch) {
    artist = aMatch[1].trim();
  }

  let bpm: number | undefined = undefined;
  const bpmMatch = rawText.match(/^\s*BPM\s*:\s*(\d+(?:[.,]\d+)?)/im);
  if (bpmMatch) {
    const val = parseInt(bpmMatch[1].replace(",", "."), 10);
    if (!isNaN(val) && val >= 30 && val <= 300) bpm = val;
  }

  const content = cleanContentBody(rawText);
  const format = detectFormat(content);

  const song: Song = {
    id: entry.id,
    title: entry.title,
    artist,
    leader: entry.leader,
    bpm,
    originalKey,
    format,
    content,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    isDeleted: false,
    deletedAt: null
  };

  parsedSongCache.set(entry.id, song);
  return song;
}

async function ensureBaseSongsLoaded(): Promise<void> {
  if (isInitialized) return;
  const promises = Array.from(baseEntriesMap.values()).map(async (entry) => {
    if (!parsedSongCache.has(entry.id)) {
      try {
        await parseBaseSong(entry);
      } catch (err) {
        console.warn(`Error loading song ${entry.id}:`, err);
      }
    }
  });
  await Promise.all(promises);
  isInitialized = true;
}

export async function getAllSongs(): Promise<Song[]> {
  await ensureBaseSongsLoaded();

  const localSongs = await db.songs.toArray();
  const localMap = new Map<string, Song>(localSongs.map((s) => [s.id, s]));
  const deletedSeedIds = readDeletedSeedIds();
  const result: Song[] = [];

  for (const [id, baseSong] of parsedSongCache.entries()) {
    if (deletedSeedIds.has(id)) continue;
    const local = localMap.get(id);
    if (local) {
      if (!local.isDeleted) {
        result.push(local);
      }
    } else {
      result.push(baseSong);
    }
  }

  for (const local of localSongs) {
    if (!local.id.startsWith(SEED_ID_PREFIX) && !local.isDeleted) {
      result.push(local);
    }
  }

  return result;
}

export async function getDeletedSongs(): Promise<Song[]> {
  await ensureBaseSongsLoaded();

  const localSongs = await db.songs.toArray();
  const localDeleted = localSongs.filter((s) => s.isDeleted);

  return localDeleted.map((local) => {
    const base = parsedSongCache.get(local.id);
    return {
      ...(base ? { title: base.title, artist: base.artist, leader: base.leader, originalKey: base.originalKey } : {}),
      ...local
    };
  });
}

export async function getSongById(id: string): Promise<Song | null> {
  if (readDeletedSeedIds().has(id)) return null;

  // 1. Check local Dexie for user overrides or custom songs
  const local = await db.songs.get(id);
  if (local) {
    if (local.isDeleted) return null;
    if (local.content) return local;
  }

  // 2. Check in-memory cache
  if (parsedSongCache.has(id)) {
    return parsedSongCache.get(id)!;
  }

  // 3. Parse from entry loader if not yet initialized
  const baseEntry = baseEntriesMap.get(id);
  if (baseEntry) {
    try {
      return await parseBaseSong(baseEntry);
    } catch (err) {
      console.error(`Failed to load song content for ${id}:`, err);
    }
  }

  return local || null;
}

export async function saveSong(song: Song): Promise<void> {
  forgetDeletedSeedSong(song.id);
  await syncSaveSong(song);
  parsedSongCache.set(song.id, song);
}

export async function softDeleteSong(songId: string): Promise<void> {
  const existing = await db.songs.get(songId);
  const base = parsedSongCache.get(songId);
  if (!existing && !base) return;

  if (!existing && base) {
    await saveSong({ ...base, isDeleted: true, deletedAt: Date.now() });
    return;
  }

  await syncSoftDeleteSong(songId);
  if (base) {
    parsedSongCache.set(songId, { ...base, isDeleted: true, deletedAt: Date.now() });
  }
}

export async function restoreSong(songId: string): Promise<void> {
  forgetDeletedSeedSong(songId);
  await syncRestoreSong(songId);
  const base = parsedSongCache.get(songId);
  if (base) {
    parsedSongCache.set(songId, { ...base, isDeleted: false, deletedAt: null });
  }
}

export async function hardDeleteSong(songId: string): Promise<void> {
  if (baseEntriesMap.has(songId)) {
    rememberDeletedSeedSong(songId);
  }
  await syncHardDeleteSong(songId);
  parsedSongCache.delete(songId);
}
