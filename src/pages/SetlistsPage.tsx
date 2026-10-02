import { useDragScroll } from "../hooks/useDragScroll";
import React, { useState } from "react";
import {
  Star,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  BookOpen,
  Camera,
  Share2,
  Edit2
} from "lucide-react";
import { useSetlists, MAX_SETLISTS } from "../context/SetlistListsContext";
import { COMMON_KEYS } from "../services/chordEngine";
import { ShareQrModal } from "../components/ShareQrModal";
import { ScanQrModal } from "../components/ScanQrModal";

interface SetlistsPageProps {
  onStartPerformance: (songId: string, slotIndex: number) => void;
  onNavigateToIndex: () => void;
}

export const SetlistsPage: React.FC<SetlistsPageProps> = ({
  onStartPerformance,
  onNavigateToIndex
}) => {
  const {
    setlists,
    activeSetlistId,
    activeSetlist,
    activeItemsWithSongs,
    canCreateMore,
    setActiveSetlistId,
    createSetlist,
    renameSetlist,
    deleteSetlist,
    stepItemKey,
    updateItemKey,
    removeItem,
    reorderItem,
    clearActiveSetlist
  } = useSetlists();

  const [isAddingList, setIsAddingList] = useState(false);
  const { ref: setlistsScrollRef, handleClickCapture: handleSetlistClickCapture } = useDragScroll<HTMLDivElement>();
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState("");

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const handleAddListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const res = await createSetlist(newListName);
    if (res.success) {
      setNewListName("");
      setIsAddingList(false);
    } else {
      alert(res.message);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListId || !editListName.trim()) return;
    await renameSetlist(editingListId, editListName);
    setEditingListId(null);
    setEditListName("");
  };

  const handleStartWorship = () => {
    if (activeItemsWithSongs.length === 0) return;
    onStartPerformance(activeItemsWithSongs[0].songId, 0);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-7 space-y-5 animate-ui-fade">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] shadow-sm relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center text-[var(--color-accent)]">
              <Star className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] font-mono">
              Repertório do Culto
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--color-text-primary)]">
              {activeSetlist?.name || "Lista de Louvor"}
            </h1>
            {activeSetlist && !activeSetlist.isDefault && (
              <button
                onClick={() => {
                  setEditingListId(activeSetlist.id);
                  setEditListName(activeSetlist.name);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] emil-press"
                title="Renomear lista"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-lg">
            Toque em <strong className="text-[var(--color-text-primary)]">Compartilhar</strong> e
            mostre o código para a banda. Sem internet, sem senha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto z-10">
          <button
            onClick={() => setIsScanModalOpen(true)}
            className="h-11 px-3.5 flex items-center gap-1.5 rounded-full bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] emil-press text-xs font-bold text-[var(--color-text-primary)] shadow-sm"
            title="Ler o código de outro celular"
          >
            <Camera className="w-4 h-4 text-[var(--color-text-primary)] shrink-0" />
            <span>Receber lista</span>
          </button>

          {activeItemsWithSongs.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Deseja remover todas as músicas desta lista?")) {
                  clearActiveSetlist();
                }
              }}
              className="h-9 px-3.5 flex items-center gap-1.5 rounded-full bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-card)] emil-press border border-[var(--color-border-subtle)] text-xs font-semibold text-rose-500 hover:text-rose-600"
              title="Limpar lista"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline font-bold">Limpar Lista</span>
            </button>
          )}

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex-1 sm:flex-initial h-12 sm:h-14 px-7 flex items-center justify-center gap-2.5 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] emil-press text-[var(--color-accent-contrast)] text-base sm:text-lg font-black shadow-lg shadow-[var(--color-accent)]/30 border-2 border-[var(--color-accent-hover)]"
            title="Compartilhar esta lista com a banda"
          >
            <Share2 className="w-5 h-5 shrink-0" />
            <span>Compartilhar</span>
          </button>

          <button
            onClick={handleStartWorship}
            disabled={activeItemsWithSongs.length === 0}
            className="flex-1 sm:flex-initial h-11 sm:h-12 px-6 flex items-center justify-center gap-2.5 rounded-full bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] emil-press text-[var(--color-text-primary)] text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            <span>Iniciar Culto</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-xs font-black font-mono tnum leading-none">
              {activeItemsWithSongs.length}
            </span>
          </button>
        </div>
      </div>

      {/* Setlists Segmented Control */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div ref={setlistsScrollRef} onClickCapture={handleSetlistClickCapture} className="flex items-center gap-2 horizontal-touch-scroll py-1 px-1 scrollbar-none apple-scroll-mask apple-scroll-mask-sm-none select-none">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-full shadow-sm">
          {setlists.map((s) => {
            const isActive = s.id === activeSetlistId;
            return (
              <div
                key={s.id}
                onClick={() => setActiveSetlistId(s.id)}
                className={`h-10 sm:h-11 flex items-center gap-2 px-4 sm:px-5 rounded-full text-xs sm:text-sm font-bold cursor-pointer select-none emil-press ${
                  isActive
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm font-bold"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)]"
                }`}
              >
                <span>{s.name}</span>
                <span className="text-[10px] opacity-75 font-mono tnum leading-none">({s.items?.length || 0})</span>
                {!s.isDefault && setlists.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Excluir a lista "${s.name}"?`)) {
                        deleteSetlist(s.id);
                      }
                    }}
                    className="ml-1 hover:text-rose-400 p-0.5 text-xs font-bold"
                    title="Excluir lista"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setIsAddingList(true)}
            disabled={!canCreateMore}
            className="h-10 sm:h-11 flex items-center gap-1.5 px-4 rounded-full text-xs sm:text-sm font-bold text-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)] emil-press disabled:opacity-30"
            title={canCreateMore ? `Criar lista (${setlists.length}/${MAX_SETLISTS})` : `Limite de ${MAX_SETLISTS} listas atingido`}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Nova Lista</span>
            <span className="text-[10px] font-mono tnum text-[var(--color-text-secondary)] leading-none">({setlists.length}/{MAX_SETLISTS})</span>
          </button>
        </div>
        <div className="w-4 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {isAddingList && (
        <form onSubmit={handleAddListSubmit} className="flex items-center gap-2 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-2xl animate-ui-fade shadow-sm">
          <input
            type="text"
            required
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nome da nova lista (ex: Culto de Jovens, Santa Ceia)..."
            className="flex-1 h-9 px-3.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-full text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="h-9 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs font-bold rounded-full emil-press shadow-sm"
          >
            Criar Lista
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingList(false);
              setNewListName("");
            }}
            className="h-9 px-3.5 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs font-semibold rounded-full emil-press"
          >
            Cancelar
          </button>
        </form>
      )}

      {editingListId && (
        <form onSubmit={handleRenameSubmit} className="flex items-center gap-2 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-2xl animate-ui-fade shadow-sm">
          <input
            type="text"
            required
            autoFocus
            value={editListName}
            onChange={(e) => setEditListName(e.target.value)}
            className="flex-1 h-9 px-3.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-full text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="h-9 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs font-bold rounded-full emil-press shadow-sm"
          >
            Salvar Nome
          </button>
          <button
            type="button"
            onClick={() => setEditingListId(null)}
            className="h-9 px-3.5 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs font-semibold rounded-full emil-press"
          >
            Cancelar
          </button>
        </form>
      )}

      {activeItemsWithSongs.length === 0 ? (
        <div className="p-10 sm:p-14 text-center rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center mx-auto">
            <Star className="w-6 h-6 fill-current" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Lista Vazia</h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
              Toque na estrela ao lado de cada música no Índice A-Z para adicionar, ou receba a lista
              de outro músico tocando em Receber lista.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onNavigateToIndex}
              className="h-9 px-5 flex items-center gap-2 rounded-full bg-[#C08552] hover:bg-[#AA7242] emil-press text-[#FFF8F0] text-xs font-bold shadow-md shadow-[var(--color-accent)]/20"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Explorar Índice A-Z</span>
            </button>

            <button
              onClick={() => setIsScanModalOpen(true)}
              className="h-9 px-4 flex items-center gap-2 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] emil-press text-[var(--color-text-primary)] text-xs font-bold shadow-sm"
            >
              <Camera className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
              <span>Receber lista</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activeItemsWithSongs.map((item, index) => {
            return (
              <div
                key={item.songId}
                className="flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]/50 shadow-sm gap-4"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer emil-press"
                  onClick={() => onStartPerformance(item.songId, index)}
                >
                  <span className="flex items-center justify-center shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 text-sm sm:text-base font-black font-mono tnum">
                    0{index + 1}
                  </span>
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <h3 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] truncate leading-tight">
                        {item.song.title}
                      </h3>
                      {item.song.leader && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-mono text-[10px] sm:text-xs font-semibold leading-none">
                          {item.song.leader}
                        </span>
                      )}
                      {item.song.bpm && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-mono tnum font-semibold text-[10px] leading-none">
                          {item.song.bpm} BPM
                        </span>
                      )}
                    </div>
                    {item.song.artist && (
                      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] truncate leading-none mt-1">{item.song.artist}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <div className="h-10 sm:h-11 flex items-center bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-full px-1.5 gap-1 shadow-inner">
                    <button
                      onClick={() => stepItemKey(item.songId, -1)}
                      title="Baixar 1 semitom (♭)"
                      className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] emil-press text-sm sm:text-base font-black"
                    >
                      ♭
                    </button>

                    <select
                      value={item.customKey}
                      onChange={(e) => updateItemKey(item.songId, e.target.value)}
                      className="bg-transparent text-[var(--color-accent)] font-mono font-black text-sm sm:text-base px-2 py-0.5 focus:outline-none cursor-pointer text-center leading-none"
                    >
                      {COMMON_KEYS.map((k) => (
                        <option key={k} value={k} className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                          {k}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => stepItemKey(item.songId, 1)}
                      title="Subir 1 semitom (♯)"
                      className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] emil-press text-sm sm:text-base font-black"
                    >
                      ♯
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center flex-col gap-0.5">
                    <button
                      onClick={() => reorderItem(item.songId, "up")}
                      disabled={index === 0}
                      className="p-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-20 emil-press"
                      title="Mover para cima"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => reorderItem(item.songId, "down")}
                      disabled={index === activeItemsWithSongs.length - 1}
                      className="p-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-20 emil-press"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.songId)}
                    title="Remover desta lista"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-rose-500 hover:bg-[var(--color-bg-subtle)] emil-press"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                  </button>

                  <button
                    onClick={() => onStartPerformance(item.songId, index)}
                    className="h-10 sm:h-11 px-4 sm:px-5 flex items-center gap-2 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs sm:text-sm font-bold emil-press shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="hidden xs:inline">Tocar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShareQrModal
        isOpen={isShareModalOpen}
        setlist={activeSetlist}
        onClose={() => setIsShareModalOpen(false)}
      />

      <ScanQrModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
      />
    </div>
  );
};
