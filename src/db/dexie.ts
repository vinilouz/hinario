import Dexie, { type EntityTable } from "dexie";
import type { Song, Setlist } from "../types";

const LEGACY_TOMBSTONE_KEY = "hinario_deleted_seed_songs";

type TrashedSongRow = Song & { isDeleted?: boolean };

function readTombstonedIds(): string[] {
  const raw = localStorage.getItem(LEGACY_TOMBSTONE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export class HinarioDB extends Dexie {
  songs!: EntityTable<Song, "id">;
  setlists!: EntityTable<Setlist, "id">;

  constructor() {
    super("HinarioDB");
    this.version(1).stores({
      songs: "id, title, artist, originalKey, isDeleted, updatedAt, deletedAt",
      setlists: "id, name, isDefault, updatedAt"
    });
    this.version(2).stores({
      songs: "id, title, artist, leader, originalKey, isDeleted, updatedAt, deletedAt, isBase"
    });
    this.version(3).stores({
      songs: "id, title, artist, leader, originalKey, isDeleted, updatedAt, deletedAt"
    });
    this.version(4)
      .stores({
        songs: "id, title, artist, leader, originalKey, updatedAt",
        setlists: "id, name, isDefault, updatedAt"
      })
      .upgrade(async (tx) => {
        const trashed = await tx
          .table<TrashedSongRow, string>("songs")
          .filter((song) => Boolean(song.isDeleted))
          .toArray();

        if (trashed.length > 0) {
          localStorage.setItem(
            LEGACY_TOMBSTONE_KEY,
            JSON.stringify([...new Set([...readTombstonedIds(), ...trashed.map((song) => song.id)])])
          );
          await tx.table<TrashedSongRow, string>("songs").bulkDelete(trashed.map((song) => song.id));
        }
      });
  }
}

export const db = new HinarioDB();

export async function initializeDatabase(): Promise<void> {
  try {
    if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
      try {
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name && dbInfo.name !== "HinarioDB") {
            const oldDb = new Dexie(dbInfo.name);
            await oldDb.open();
            if (oldDb.tables.some((t) => t.name === "songs")) {
              const oldSongs = await oldDb.table("songs").toArray();
              if (oldSongs.length > 0) {
                await db.songs.bulkPut(oldSongs);
              }
            }
            if (oldDb.tables.some((t) => t.name === "setlists")) {
              const oldSetlists = await oldDb.table("setlists").toArray();
              if (oldSetlists.length > 0) {
                await db.setlists.bulkPut(oldSetlists);
              }
            }
            oldDb.close();
            await Dexie.delete(dbInfo.name);
          }
        }
      } catch {
        // Ignore legacy db errors
      }
    }

    const setlistCount = await db.setlists.count();
    if (setlistCount === 0) {
      await db.setlists.put({
        id: "setlist_default",
        name: "Culto de Domingo",
        isDefault: true,
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}
