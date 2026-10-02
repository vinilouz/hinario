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

export interface QrSongPayload {
  v: 4;
  kind: "song";
  song: Song;
}

export interface QrListItemPayload {
  v: 4;
  kind: "list";
  i: number;
  t: number;
  n: string;
  k: string;
  song: Song;
}

export type QrTransferPayload = QrSongPayload | QrListItemPayload;

export interface QrSetlistPayload {
  v: 1 | 2;
  n: string;
  s: [string, string][];
  songs?: Song[];
}

export interface AppConfig {
  theme: "dark" | "light";
  fontSize: number;
}
