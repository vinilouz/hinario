import { db } from './dexie';
import { dbFirestore, isFirebaseConfigured } from '../services/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import type { Song } from '../types';

const LAST_SYNC_KEY = 'hinario_last_sync_timestamp';
const DELETED_SEED_KEY = 'hinario_deleted_seed_songs';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const SEED_ID_PREFIX = 'seed_';

export function readDeletedSeedIds(): Set<string> {
  const raw = localStorage.getItem(DELETED_SEED_KEY);
  if (raw === null) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

export function rememberDeletedSeedSong(songId: string): void {
  const ids = readDeletedSeedIds();
  ids.add(songId);
  localStorage.setItem(DELETED_SEED_KEY, JSON.stringify([...ids]));
}

export function forgetDeletedSeedSong(songId: string): void {
  const ids = readDeletedSeedIds();
  if (!ids.delete(songId)) return;
  localStorage.setItem(DELETED_SEED_KEY, JSON.stringify([...ids]));
}

export async function purgeExpiredSongs(retentionMs: number = THIRTY_DAYS_MS): Promise<void> {
  const now = Date.now();
  const threshold = now - retentionMs;

  try {
    const expiredSongs = await db.songs
      .filter((song) => Boolean(song.isDeleted && song.deletedAt && song.deletedAt < threshold))
      .toArray();

    if (expiredSongs.length === 0) return;

    for (const song of expiredSongs) {
      await db.songs.delete(song.id);
      if (song.id.startsWith(SEED_ID_PREFIX)) {
        rememberDeletedSeedSong(song.id);
      }
      if (isFirebaseConfigured && dbFirestore) {
        try {
          await deleteDoc(doc(dbFirestore, 'songs', song.id));
        } catch (err) {
          console.warn('Erro ao deletar documento expirado no Firestore:', err);
        }
      }
    }
  } catch (error) {
    console.error('Erro na rotina de expiração da lixeira:', error);
  }
}

export async function syncSongsWithRemote(): Promise<void> {
  await purgeExpiredSongs();

  if (!navigator.onLine || !isFirebaseConfigured || !dbFirestore) {
    return;
  }

  try {
    const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) || '0');
    const songsRef = collection(dbFirestore, 'songs');
    const q = lastSync > 0
      ? query(songsRef, where('updatedAt', '>', lastSync))
      : query(songsRef);

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const remoteSongs: Song[] = [];
      snapshot.forEach((d) => {
        remoteSongs.push(d.data() as Song);
      });
      if (remoteSongs.length > 0) {
        await db.songs.bulkPut(remoteSongs);
      }
    }

    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch (err) {
    console.warn('Sincronização em segundo plano falhou ou foi bloqueada por permissões:', err);
  }
}

export async function saveSong(song: Song): Promise<void> {
  const updatedSong: Song = {
    ...song,
    updatedAt: Date.now()
  };

  await db.songs.put(updatedSong);

  if (isFirebaseConfigured && dbFirestore) {
    try {
      await setDoc(doc(dbFirestore, 'songs', updatedSong.id), updatedSong);
    } catch (err) {
      console.warn('Erro ao replicar música no Firestore:', err);
    }
  }
}

export async function softDeleteSong(songId: string): Promise<void> {
  const song = await db.songs.get(songId);
  if (!song) return;

  const deletedSong: Song = {
    ...song,
    isDeleted: true,
    deletedAt: Date.now(),
    updatedAt: Date.now()
  };

  await saveSong(deletedSong);
}

export async function restoreSong(songId: string): Promise<void> {
  const song = await db.songs.get(songId);
  if (!song) return;

  const restoredSong: Song = {
    ...song,
    isDeleted: false,
    deletedAt: null,
    updatedAt: Date.now()
  };

  await saveSong(restoredSong);
}

export async function hardDeleteSong(songId: string): Promise<void> {
  await db.songs.delete(songId);
  if (isFirebaseConfigured && dbFirestore) {
    try {
      await deleteDoc(doc(dbFirestore, 'songs', songId));
    } catch (err) {
      console.warn('Erro ao excluir definitivamente no Firestore:', err);
    }
  }
}
