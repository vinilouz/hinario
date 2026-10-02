import { useDragScroll } from "../hooks/useDragScroll";
import React, { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, Star, X, Music, UserCheck, Share2 } from "lucide-react";
import { ShareQrModal } from "../components/ShareQrModal";
import { getAllSongs } from "../services/songService";
import { useSetlists } from "../context/SetlistListsContext";
import type { Song, SongLeader } from "../types";

interface IndexBookProps {
  onOpenSong: (songId: string, fromTab: "index" | "setlists") => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

const LEADERS: { id: string; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "Igreja", label: "Igreja" },
  { id: "Doni", label: "Doni" },
  { id: "Lucas", label: "Lucas" },
  { id: "Magu", label: "Magu" }
];

export const IndexBook: React.FC<IndexBookProps> = ({ onOpenSong }) => {
  const { isSongInActiveSetlist, toggleSongInActiveSetlist, activeSetlist, setlists, setActiveSetlistId } = useSetlists();
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedLeader, setSelectedLeader] = useState<string>("all");
  const [shareSong, setShareSong] = useState<Song | null>(null);
  const { ref: alphabetRef, handleClickCapture } = useDragScroll<HTMLDivElement>();

  useEffect(() => {
    getAllSongs().then((data) => {
      setSongs(data.sort((a, b) => a.title.localeCompare(b.title, "pt-BR")));
    });
  }, []);

  const leaderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: songs.length,
      Igreja: 0,
      Doni: 0,
      Lucas: 0,
      Magu: 0
    };
    for (const s of songs) {
      const l = s.leader || "Igreja";
      if (counts[l] !== undefined) {
        counts[l]++;
      }
    }
    return counts;
  }, [songs]);

  const filteredSongs = useMemo(() => {
    let result = songs;

    if (selectedLeader !== "all") {
      result = result.filter((s) => (s.leader || "Igreja") === selectedLeader);
    }

    if (selectedLetter) {
      if (selectedLetter === "#") {
        result = result.filter((s) => /^[0-9]/.test(s.title));
      } else {
        result = result.filter((s) =>
          s.title.toUpperCase().startsWith(selectedLetter)
        );
      }
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((s) => {
        const inTitle = s.title.toLowerCase().includes(q);
        const inArtist = s.artist?.toLowerCase().includes(q);
        const inLeader = s.leader?.toLowerCase().includes(q);
        const inLyrics = s.content ? s.content.toLowerCase().includes(q) : false;
        return inTitle || inArtist || inLeader || inLyrics;
      });
    }

    return result;
  }, [songs, selectedLeader, query, selectedLetter]);

  const getLeaderBadgeStyle = (leader?: SongLeader) => {
    switch (leader) {
      case "Doni":
        return "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400";
      case "Lucas":
        return "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
      case "Magu":
        return "bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400";
      case "Igreja":
      default:
        return "bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-7 space-y-5 animate-ui-fade">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center text-[var(--color-accent)]">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-accent)] font-mono">
              Índice Geral do Hinário
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[var(--color-text-primary)] tracking-tight leading-tight">
            Todas as Músicas (A-Z)
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
            {songs.length} louvores disponíveis 100% offline. Toque para abrir a cifra.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {setlists.length > 0 && (
            <div className="h-11 sm:h-12 flex items-center gap-2 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-full px-4 text-xs sm:text-sm text-[var(--color-text-secondary)]">
              <span className="text-[11px] font-semibold">Lista:</span>
              <select
                value={activeSetlist?.id || ""}
                onChange={(e) => setActiveSetlistId(e.target.value)}
                className="bg-transparent text-[var(--color-accent)] font-bold focus:outline-none cursor-pointer truncate max-w-[150px] leading-none"
              >
                {setlists.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full sm:w-80 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedLetter) setSelectedLetter(null);
              }}
              placeholder="Buscar título, líder, artista..."
              className="w-full h-11 sm:h-12 pl-11 pr-10 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-full text-base sm:text-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1 emil-press rounded-full"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leader Filters & Alphabet Scrubber */}
      <div className="space-y-2.5">
        {/* Leader Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
          {LEADERS.map((leader) => {
            const count = leaderCounts[leader.id] ?? 0;
            const isSelected = selectedLeader === leader.id;
            return (
              <button
                key={leader.id}
                onClick={() => {
                  setSelectedLeader(leader.id);
                  if (selectedLetter) setSelectedLetter(null);
                }}
                className={`h-9 sm:h-10 px-3.5 sm:px-4 flex items-center gap-1.5 rounded-full text-xs sm:text-sm font-bold shrink-0 emil-press border transition-all ${
                  isSelected
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] border-[var(--color-accent)] shadow-sm"
                    : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)]"
                }`}
              >
                {leader.id !== "all" && <UserCheck className="w-3.5 h-3.5 opacity-80" />}
                <span>{leader.label}</span>
                <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-black/20 text-white" : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Alphabet Scrubber */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
          <div
            ref={alphabetRef}
            onClickCapture={handleClickCapture}
            className="flex items-center gap-1.5 horizontal-touch-scroll py-1 px-1 scrollbar-none apple-scroll-mask apple-scroll-mask-sm-none select-none"
          >
            <button
              onClick={() => setSelectedLetter(null)}
              className={`h-8 sm:h-9 px-3 sm:px-3.5 flex items-center justify-center rounded-xl sm:rounded-full text-xs sm:text-sm font-bold shrink-0 emil-press ${
                selectedLetter === null
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm font-bold"
                  : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]"
              }`}
            >
              Todas
            </button>
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                onClick={() => {
                  setSelectedLetter(letter === selectedLetter ? null : letter);
                  setQuery("");
                }}
                className={`w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center rounded-xl sm:rounded-full text-xs sm:text-sm font-bold shrink-0 emil-press ${
                  selectedLetter === letter
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm font-bold"
                    : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]"
                }`}
              >
                {letter}
              </button>
            ))}
            <div className="w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Song List */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-3xl divide-y divide-[var(--color-border-subtle)] overflow-hidden shadow-sm">
        {filteredSongs.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-text-secondary)] text-sm space-y-2">
            <Music className="w-8 h-8 mx-auto opacity-40 text-[var(--color-accent)]" />
            <p>Nenhuma música encontrada com os filtros buscados.</p>
          </div>
        ) : (
          filteredSongs.map((song) => {
            const starred = isSongInActiveSetlist(song.id);
            const leader = song.leader || "Igreja";
            return (
              <div
                key={song.id}
                className="flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--color-bg-subtle)] emil-press group cursor-pointer"
                onClick={() => onOpenSong(song.id, "index")}
              >
                <div className="min-w-0 pr-4 flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] truncate leading-tight">
                      {song.title}
                    </h2>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full border font-mono tnum font-semibold text-[11px] sm:text-xs leading-none ${getLeaderBadgeStyle(song.leader)}`}>
                      {leader}
                    </span>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)] font-mono tnum font-bold text-xs sm:text-sm leading-none">
                      {song.originalKey}
                    </span>
                    {song.bpm && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-mono tnum font-semibold text-xs sm:text-sm leading-none">
                        {song.bpm} BPM
                      </span>
                    )}
                  </div>
                  {song.artist && song.artist !== leader && (
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] truncate leading-none mt-1">
                      {song.artist}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSongInActiveSetlist(song);
                    }}
                    title={starred ? `Remover de ${activeSetlist?.name}` : `Adicionar em ${activeSetlist?.name}`}
                    className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full border emil-press ${
                      starred
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] border-[var(--color-accent)] shadow-sm"
                        : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)]"
                    }`}
                  >
                    <Star className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${starred ? "fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareSong(song);
                    }}
                    title="Compartilhar esta música"
                    aria-label={`Compartilhar a música ${song.title}`}
                    className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] emil-press"
                  >
                    <Share2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ShareQrModal
        isOpen={shareSong !== null}
        setlist={null}
        song={shareSong ?? undefined}
        onClose={() => setShareSong(null)}
      />
    </div>
  );
};
