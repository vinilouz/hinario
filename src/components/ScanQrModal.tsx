import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Clipboard, AlertCircle, CheckCircle2, Play, Trash2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { decodeTransfer } from "../services/qrSharing";
import { saveSong } from "../services/songService";
import { useSetlists } from "../context/SetlistListsContext";
import { QR_TEXT_SEPARATOR } from "./ShareQrModal";
import type { Song } from "../types";

interface ScanQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PendingTransfer {
  n: string;
  t: number;
  k: string[];
  r: number[];
  // Added after a stuck-transfer bug: k holds only the customKey, so nothing else
  // maps an index back to a saved song. Absent in records written before this field.
  s?: string[];
}

interface ListCode {
  n: string;
  t: number;
  i: number;
  k: string;
  song: Song;
}

const PENDING_KEY = "hinario_pending_transfer";

const readPending = (): PendingTransfer | null => {
  const raw = localStorage.getItem(PENDING_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Partial<PendingTransfer>;
  const keys = candidate.k;
  const received = candidate.r;
  if (
    typeof candidate.n !== "string" ||
    typeof candidate.t !== "number" ||
    !Array.isArray(keys) ||
    !Array.isArray(received) ||
    keys.some((v) => typeof v !== "string") ||
    received.some((v) => typeof v !== "number")
  ) {
    return null;
  }
  const songIds = candidate.s;
  if (songIds === undefined) {
    return { n: candidate.n, t: candidate.t, k: keys, r: received };
  }
  if (!Array.isArray(songIds) || songIds.some((v) => typeof v !== "string")) {
    return null;
  }
  return { n: candidate.n, t: candidate.t, k: keys, r: received, s: songIds };
};

const writePending = (pending: PendingTransfer) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
};

const clearPending = () => {
  localStorage.removeItem(PENDING_KEY);
};

export const ScanQrModal: React.FC<ScanQrModalProps> = ({ isOpen, onClose }) => {
  const { importSetlist, canCreateMore } = useSetlists();
  const [activeTab, setActiveTab] = useState<"camera" | "paste">(() =>
    window.matchMedia("(min-width: 640px)").matches ? "paste" : "camera"
  );
  const [pastedCode, setPastedCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTransfer | null>(null);
  const [showResume, setShowResume] = useState(false);
  const [conflict, setConflict] = useState<ListCode | null>(null);
  const [ready, setReady] = useState<{ name: string; items: { songId: string; customKey: string }[] } | null>(
    null
  );
  const receivedSongsRef = useRef<Map<number, Song>>(new Map());

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isBusyRef = useRef<boolean>(false);
  const scanHandlerRef = useRef<(raw: string) => void>(() => {});

  const stopScanner = async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        isScanningRef.current = false;
      }
      try {
        await scannerRef.current.clear();
      } catch {
        isScanningRef.current = false;
      }
      isScanningRef.current = false;
    }
  };

  const discardPending = () => {
    clearPending();
    setPending(null);
    receivedSongsRef.current.clear();
  };

  const assembleTransfer = async (state: PendingTransfer) => {
    const ids = state.s ?? [];
    const items: { songId: string; customKey: string }[] = [];
    for (let i = 0; i < state.t; i++) {
      const fromMemory = receivedSongsRef.current.get(i);
      const songId = ids[i] ?? fromMemory?.id;
      if (songId === undefined) {
        setErrorMsg(`Mostre de novo o código da música ${i + 1} para fechar a lista "${state.n}".`);
        return false;
      }
      items.push({ songId, customKey: state.k[i] });
    }
    setPending(null);
    setReady({ name: state.n, items });
    return true;
  };

  const confirmTransfer = async (mode: "new" | "replace") => {
    if (ready === null) return;
    const result = await importSetlist(ready.name, ready.items, mode);
    if (!result.success) {
      setErrorMsg(result.message || "Erro ao montar a lista.");
      return;
    }
    clearPending();
    setPending(null);
    setReady(null);
    receivedSongsRef.current.clear();
    setSuccessMsg(`Lista "${ready.name}" pronta com ${ready.items.length} músicas offline!`);
    setTimeout(() => onClose(), 1400);
  };

  const acceptListCode = useCallback(async (code: ListCode) => {
    const stored = readPending();
    const base = stored !== null && stored.n === code.n ? stored : { n: code.n, t: code.t, k: [], r: [] };
    if (base.r.includes(code.i)) {
      if (base.r.length === base.t) {
        await assembleTransfer(base);
      }
      return;
    }
    await saveSong(code.song);
    receivedSongsRef.current.set(code.i, code.song);
    const keys = Array.from({ length: base.t }, (_, index) => base.k[index] ?? "");
    keys[code.i] = code.k;
    const songIds = Array.from({ length: base.t }, (_, index) => base.s?.[index] ?? "");
    songIds[code.i] = code.song.id;
    const next: PendingTransfer = {
      n: base.n,
      t: base.t,
      k: keys,
      r: [...base.r, code.i],
      s: songIds
    };
    writePending(next);
    setPending(next);
    if (next.r.length === next.t) {
      await assembleTransfer(next);
    }
  }, []);

  const handleCodes = useCallback(
    async (raw: string) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;
      try {
        setErrorMsg(null);
        setSuccessMsg(null);
        const segments = raw
          .split(QR_TEXT_SEPARATOR)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const segment of segments) {
          const decoded = await decodeTransfer(segment);
          if (decoded === null) {
            setErrorMsg("QR Code ou código inválido. Verifique se copiou o código completo.");
            return;
          }
          if (decoded.kind === "song") {
            await saveSong(decoded.song);
            setSuccessMsg(`Música "${decoded.song.title}" salva no aplicativo.`);
            continue;
          }
          const code: ListCode = {
            n: decoded.n,
            t: decoded.t,
            i: decoded.i,
            k: decoded.k,
            song: decoded.song
          };
          const stored = readPending();
          if (stored !== null && stored.n !== code.n) {
            setConflict(code);
            return;
          }
          await acceptListCode(code);
        }
      } finally {
        isBusyRef.current = false;
      }
    },
    [acceptListCode]
  );

  useEffect(() => {
    scanHandlerRef.current = handleCodes;
  }, [handleCodes]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setErrorMsg(null);
      setSuccessMsg(null);
      setPastedCode("");
      setConflict(null);
      setReady(null);
      return;
    }
    const restored = readPending();
    if (restored === null) {
      setPending(null);
      setShowResume(false);
      return;
    }
    if (restored.r.length === restored.t) {
      const assembled = assembleTransfer(restored);
      if (!assembled) {
        setPending(restored);
        setShowResume(true);
      }
      return;
    }
    setPending(restored);
    setShowResume(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== "camera" || showResume || conflict !== null || ready !== null) return;

    const html5QrCode = new Html5Qrcode("qr-reader-region");
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          scanHandlerRef.current(decodedText);
        },
        () => {}
      )
      .then(() => {
        isScanningRef.current = true;
      })
      .catch(() => {
        setErrorMsg("Não foi possível acessar a câmera. Você pode colar o código abaixo.");
        setActiveTab("paste");
      });

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab, showResume, conflict, ready]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const progress = pending !== null ? { got: pending.r.length, total: pending.t } : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] max-h-[calc(100dvh-2rem)] sheet-scroll rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-modal-pop my-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] leading-tight">
            Receber Músicas
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] emil-press shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {showResume && pending !== null ? (
          <div className="space-y-4 animate-ui-fade">
            <div className="p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] space-y-1.5 text-center">
              <span className="text-[11px] font-mono text-[var(--color-accent)] uppercase font-bold tracking-wider">
                Transferência pela metade
              </span>
              <h3 className="text-lg font-black text-[var(--color-text-primary)] leading-tight">
                {pending.n}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono tnum">
                Recebidas {pending.r.length} de {pending.t} músicas
              </p>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed text-left">
              As {pending.r.length} músicas já lidas estão salvas neste celular. Continue de onde a
              outra pessoa parou.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowResume(false)}
                className="w-full h-10 flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs font-bold emil-press shadow-md shadow-[var(--color-accent)]/20"
              >
                <Play className="w-4 h-4 shrink-0" />
                <span>Continuar</span>
              </button>
              <button
                onClick={() => {
                  discardPending();
                  setShowResume(false);
                }}
                className="w-full h-9 flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-[var(--color-text-primary)] text-xs font-semibold emil-press"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Descartar e recomeçar</span>
              </button>
            </div>
          </div>
        ) : ready !== null ? (
          <div className="space-y-4 animate-ui-fade">
            <div className="p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] space-y-1.5 text-center">
              <span className="text-[11px] font-mono text-[var(--color-accent)] uppercase font-bold tracking-wider">
                Lista Recebida
              </span>
              <h3 className="text-lg font-black text-[var(--color-text-primary)] leading-tight">
                {ready.name}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono tnum">
                {ready.items.length} {ready.items.length === 1 ? "música salva" : "músicas salvas"}{" "}
                neste celular
              </p>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed text-left">
              Escolha onde guardar esta lista. Você pode criar uma lista nova ou trocar o conteúdo da
              lista que está aberta agora.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => confirmTransfer("new")}
                disabled={!canCreateMore}
                className="w-full h-9 flex items-center justify-center rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] emil-press text-[var(--color-accent-contrast)] text-xs font-bold shadow-md shadow-[var(--color-accent)]/20 disabled:opacity-40"
              >
                Salvar como Nova Lista
              </button>
              <button
                onClick={() => confirmTransfer("replace")}
                className="w-full h-9 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] emil-press text-[var(--color-text-primary)] text-xs font-semibold"
              >
                Substituir Lista Aberta
              </button>
            </div>
            {!canCreateMore && (
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                Você chegou ao limite de listas. Apague uma lista antiga para poder criar outra, ou
                substitua a lista aberta.
              </p>
            )}
            <button
              onClick={() => {
                discardPending();
                setReady(null);
              }}
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-full text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] emil-press"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Descartar esta lista</span>
            </button>
          </div>
        ) : conflict !== null ? (
          <div className="space-y-4 animate-ui-fade">
            <div className="p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] space-y-1.5 text-center">
              <h3 className="text-base font-black text-[var(--color-text-primary)] leading-tight">
                Outra lista começou
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {pending !== null && (
                  <>
                    Você está recebendo <strong>{pending.n}</strong> e agora chegou{" "}
                    <strong>{conflict.n}</strong>.
                  </>
                )}
                Duas listas não podem se misturar. Começar de novo apaga o progresso da anterior.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  const incoming = conflict;
                  discardPending();
                  setConflict(null);
                  await acceptListCode(incoming);
                }}
                className="w-full h-10 flex items-center justify-center rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs font-bold emil-press shadow-md shadow-[var(--color-accent)]/20"
              >
                Começar {conflict.n}
              </button>
              <button
                onClick={() => setConflict(null)}
                className="w-full h-9 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-[var(--color-text-primary)] text-xs font-semibold emil-press"
              >
                Manter a lista atual
              </button>
            </div>
          </div>
        ) : successMsg !== null && progress === null ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[var(--color-accent)] mx-auto" />
            <p className="text-sm font-bold text-[var(--color-text-primary)]">{successMsg}</p>
            <button
              onClick={() => setSuccessMsg(null)}
              className="w-full h-10 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-xs font-semibold text-[var(--color-text-primary)] emil-press"
            >
              Continuar recebendo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-1 rounded-full">
              <button
                onClick={() => setActiveTab("paste")}
                className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-full text-xs font-bold emil-press ${
                  activeTab === "paste"
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Clipboard className="w-4 h-4 shrink-0" />
                <span>Colar código</span>
              </button>
              <button
                onClick={() => setActiveTab("camera")}
                className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-full text-xs font-bold emil-press ${
                  activeTab === "camera"
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Ler com a câmera</span>
              </button>
            </div>

            {progress !== null && (
              <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 flex items-center gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                    {pending?.n}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] font-mono tnum">
                    Recebidas {progress.got} de {progress.total} músicas
                  </p>
                </div>
                <button
                  onClick={() => setShowResume(true)}
                  className="ml-auto h-8 px-3 flex items-center justify-center rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-[11px] font-semibold text-[var(--color-text-primary)] emil-press shrink-0"
                >
                  Retomar
                </button>
              </div>
            )}

            {activeTab === "camera" && (
              <div className="space-y-2 text-left">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Aponte a câmera para o código na tela do outro celular.
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Se a tela do outro celular apagar, ela volta sozinha e continua de onde parou.
                  Cada música é salva assim que é lida, então nada se perde.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg !== null && (
              <div className="p-3 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 text-xs text-[var(--color-text-primary)] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
                <span>{successMsg}</span>
              </div>
            )}

            {activeTab === "camera" ? (
              <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] min-h-[260px] flex items-center justify-center">
                <div id="qr-reader-region" className="w-full h-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={4}
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  placeholder="Cole aqui o código que o outro celular enviou..."
                  className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-2xl text-xs sm:text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] font-mono"
                />
                <button
                  onClick={async () => {
                    await handleCodes(pastedCode);
                    setPastedCode("");
                  }}
                  disabled={!pastedCode.trim()}
                  className="w-full h-11 flex items-center justify-center rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-sm font-bold emil-press disabled:opacity-40 shadow-md shadow-[var(--color-accent)]/20"
                >
                  Receber
                </button>
              </div>
            )}

            </div>
        )}
      </div>
    </div>,
    document.body
  );
};