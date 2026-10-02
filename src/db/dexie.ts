import Dexie, { type EntityTable } from "dexie";
import type { Song, Setlist } from "../types";

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
