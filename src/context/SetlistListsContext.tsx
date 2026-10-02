import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "../db/dexie";
import { getSongById, saveSong } from "../services/songService";
import { transposeKeyName } from "../services/chordEngine";
import type { Setlist, SetlistItemWithSong, Song } from "../types";

export const MAX_SETLISTS = 8;
const ACTIVE_SETLIST_KEY = "hinario_active_setlist_id";

interface SetlistListsContextType {
  setlists: Setlist[];
  activeSetlistId: string;
  activeSetlist: Setlist | null;
  activeItemsWithSongs: SetlistItemWithSong[];
  canCreateMore: boolean;
  setActiveSetlistId: (id: string) => void;
  createSetlist: (name: string) => Promise<{ success: boolean; id?: string; message?: string }>;
  renameSetlist: (id: string, newName: string) => Promise<void>;
  deleteSetlist: (id: string) => Promise<void>;
  toggleSongInActiveSetlist: (song: Song) => Promise<boolean>;
  isSongInActiveSetlist: (songId: string) => boolean;
  updateItemKey: (songId: string, newKey: string) => Promise<void>;
  stepItemKey: (songId: string, semitones: number) => Promise<void>;
  removeItem: (songId: string) => Promise<void>;
  reorderItem: (songId: string, direction: "up" | "down") => Promise<void>;
  clearActiveSetlist: () => Promise<void>;
  importSetlist: (
    name: string,
    items: { songId: string; customKey: string }[],
    mode: "new" | "replace",
    embeddedSongs?: Song[]
  ) => Promise<{ success: boolean; id?: string; message?: string }>;
}

const SetlistListsContext = createContext<SetlistListsContextType | undefined>(undefined);

export const SetlistListsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [activeSetlistId, setActiveSetlistIdState] = useState<string>(() => {
    return localStorage.getItem("hinario_active_setlist_id") || "setlist_default";
  });
  const [activeItemsWithSongs, setActiveItemsWithSongs] = useState<SetlistItemWithSong[]>([]);

  const loadData = useCallback(async (forcedTargetId?: string) => {
    try {
      const all = await db.setlists.toArray();
      const sorted = all.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      setSetlists(sorted);

      const targetId = forcedTargetId ?? activeSetlistId;
      const validId = sorted.some((s) => s.id === targetId)
        ? targetId
        : sorted[0]?.id || "setlist_default";

      if (validId !== activeSetlistId) {
        setActiveSetlistIdState(validId);
        localStorage.setItem(ACTIVE_SETLIST_KEY, validId);
      }

      const active = sorted.find((s) => s.id === validId);
      if (active && Array.isArray(active.items) && active.items.length > 0) {
        const fullItems: SetlistItemWithSong[] = [];
        const sortedItems = [...active.items].sort((a, b) => a.order - b.order);

        for (const it of sortedItems) {
          const song = await getSongById(it.songId);
          if (song) {
            fullItems.push({
              songId: it.songId,
              customKey: it.customKey || song.originalKey,
              order: it.order,
              song
            });
          }
        }
        setActiveItemsWithSongs(fullItems);
      } else {
        setActiveItemsWithSongs([]);
      }
    } catch (err) {
      console.error("Error loading setlists:", err);
    }
  }, [activeSetlistId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setActiveSetlistId = (id: string) => {
    setActiveSetlistIdState(id);
    localStorage.setItem(ACTIVE_SETLIST_KEY, id);
    loadData(id);
  };

  const createSetlist = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, message: "Digite um nome para a lista." };

    if (setlists.length >= MAX_SETLISTS) {
      return {
        success: false,
        message: `Limite de ${MAX_SETLISTS} listas atingido. Exclua uma lista antiga para criar outra.`
      };
    }

    const newId = `setlist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newSetlist: Setlist = {
      id: newId,
      name: trimmed,
      items: [],
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.setlists.put(newSetlist);
    setActiveSetlistIdState(newId);
    localStorage.setItem(ACTIVE_SETLIST_KEY, newId);
    setActiveItemsWithSongs([]);
    await loadData(newId);
    return { success: true, id: newId };
  };

  const renameSetlist = async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await db.setlists.update(id, { name: trimmed, updatedAt: Date.now() });
    await loadData(id);
  };

  const deleteSetlist = async (id: string) => {
    const target = setlists.find((s) => s.id === id);
    if (!target || target.isDefault) return;

    await db.setlists.delete(id);
    const remaining = setlists.filter((s) => s.id !== id);
    const fallback = remaining[0]?.id || "setlist_default";
    setActiveSetlistIdState(fallback);
    localStorage.setItem(ACTIVE_SETLIST_KEY, fallback);
    await loadData(fallback);
  };

  const isSongInActiveSetlist = (songId: string): boolean => {
    return activeItemsWithSongs.some((it) => it.songId === songId);
  };

  const toggleSongInActiveSetlist = async (song: Song): Promise<boolean> => {
    const current = setlists.find((s) => s.id === activeSetlistId);
    if (!current) return false;

    const existingIndex = current.items.findIndex((it) => it.songId === song.id);
    let updatedItems = [...current.items];

    if (existingIndex !== -1) {
      updatedItems.splice(existingIndex, 1);
      await db.setlists.update(activeSetlistId, {
        items: updatedItems,
        updatedAt: Date.now()
      });
      await loadData(activeSetlistId);
      return false;
    }

    const nextOrder = updatedItems.length > 0 ? Math.max(...updatedItems.map((i) => i.order)) + 1 : 1;
    updatedItems.push({
      songId: song.id,
      customKey: song.originalKey,
      order: nextOrder
    });

    await db.setlists.update(activeSetlistId, {
      items: updatedItems,
      updatedAt: Date.now()
    });
    await loadData(activeSetlistId);
    return true;
  };

  const updateItemKey = async (songId: string, newKey: string) => {
    const current = setlists.find((s) => s.id === activeSetlistId);
    if (!current) return;

    const updatedItems = current.items.map((it) =>
      it.songId === songId ? { ...it, customKey: newKey } : it
    );

    await db.setlists.update(activeSetlistId, {
      items: updatedItems,
      updatedAt: Date.now()
    });
    await loadData(activeSetlistId);
  };

  const stepItemKey = async (songId: string, semitones: number) => {
    const item = activeItemsWithSongs.find((it) => it.songId === songId);
    if (!item) return;

    const nextKey = transposeKeyName(item.customKey, semitones);
    await updateItemKey(songId, nextKey);
  };

  const removeItem = async (songId: string) => {
    const current = setlists.find((s) => s.id === activeSetlistId);
    if (!current) return;

    const updatedItems = current.items.filter((it) => it.songId !== songId);
    await db.setlists.update(activeSetlistId, {
      items: updatedItems,
      updatedAt: Date.now()
    });
    await loadData(activeSetlistId);
  };

  const reorderItem = async (songId: string, direction: "up" | "down") => {
    const current = setlists.find((s) => s.id === activeSetlistId);
    if (!current) return;

    const sortedItems = [...current.items].sort((a, b) => a.order - b.order);
    const index = sortedItems.findIndex((it) => it.songId === songId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sortedItems.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const tempOrder = sortedItems[index].order;
    sortedItems[index].order = sortedItems[targetIndex].order;
    sortedItems[targetIndex].order = tempOrder;

    await db.setlists.update(activeSetlistId, {
      items: sortedItems,
      updatedAt: Date.now()
    });
    await loadData(activeSetlistId);
  };

  const clearActiveSetlist = async () => {
    await db.setlists.update(activeSetlistId, {
      items: [],
      updatedAt: Date.now()
    });
    setActiveItemsWithSongs([]);
    await loadData(activeSetlistId);
  };

  const importSetlist = async (
    name: string,
    rawItems: { songId: string; customKey: string }[],
    mode: "new" | "replace",
    embeddedSongs?: Song[]
  ) => {
    if (Array.isArray(embeddedSongs) && embeddedSongs.length > 0) {
      for (const s of embeddedSongs) {
        if (s && s.id && s.title && s.content) {
          await saveSong(s);
        }
      }
    }
    const validItems = rawItems.map((it, idx) => ({
      songId: it.songId,
      customKey: it.customKey,
      order: idx + 1
    }));

    if (mode === "replace") {
      await db.setlists.update(activeSetlistId, {
        name,
        items: validItems,
        updatedAt: Date.now()
      });
      await loadData(activeSetlistId);
      return { success: true, id: activeSetlistId };
    }

    if (setlists.length >= MAX_SETLISTS) {
      return {
        success: false,
        message: `Limite de ${MAX_SETLISTS} listas atingido. Substitua a lista atual ou apague uma antiga.`
      };
    }

    const newId = `setlist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.setlists.put({
      id: newId,
      name,
      items: validItems,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    setActiveSetlistIdState(newId);
    localStorage.setItem(ACTIVE_SETLIST_KEY, newId);
    await loadData(newId);
    return { success: true, id: newId };
  };

  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || null;

  return (
    <SetlistListsContext.Provider
      value={{
        setlists,
        activeSetlistId,
        activeSetlist,
        activeItemsWithSongs,
        canCreateMore: setlists.length < MAX_SETLISTS,
        setActiveSetlistId,
        createSetlist,
        renameSetlist,
        deleteSetlist,
        toggleSongInActiveSetlist,
        isSongInActiveSetlist,
        updateItemKey,
        stepItemKey,
        removeItem,
        reorderItem,
        clearActiveSetlist,
        importSetlist
      }}
    >
      {children}
    </SetlistListsContext.Provider>
  );
};

export const useSetlists = (): SetlistListsContextType => {
  const context = useContext(SetlistListsContext);
  if (!context) {
    throw new Error("useSetlists must be used within SetlistListsProvider");
  }
  return context;
};
