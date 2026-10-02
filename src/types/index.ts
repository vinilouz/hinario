export type SongLeader = "Doni" | "Lucas" | "Magu" | "Igreja" | string;

export interface Song {
  id: string;
  title: string;
  artist?: string;
  leader?: SongLeader;
  bpm?: number;
  originalKey: string;
  content: string;
  format: "chords-over-lyrics" | "chordpro";
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt: number | null;
}

export interface SetlistItem {
  songId: string;
  customKey: string;
  order: number;
}

export interface Setlist {
  id: string;
  name: string;
  items: SetlistItem[];
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SetlistItemWithSong {
  songId: string;
  customKey: string;
  order: number;
  song: Song;
}

export interface QrSetlistPayload {
  v: 1 | 2;
  n: string;
  s: [string, string][];
  songs?: Song[];
}

export interface AppConfig {
  trashRetentionDays: number;
  theme: "dark" | "light";
  fontSize: number;
}
