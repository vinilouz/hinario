import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, QrCode, Share2, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { encodeSetlistToPayload, generateQrDataUrl, splitIntoQrChunks } from "../services/qrSharing";
import { getSongById } from "../services/songService";
import type { Setlist, Song } from "../types";

interface ShareQrModalProps {
  isOpen: boolean;
  setlist: Setlist | null;
  onClose: () => void;
}

type ShareMode = "qr" | "code";

export const ShareQrModal: React.FC<ShareQrModalProps> = ({ isOpen, setlist, onClose }) => {
  const [qrUrls, setQrUrls] = useState<string[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [payload, setPayload] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<ShareMode>("qr");

  const canUseNativeShare = typeof navigator.share === "function";

  useEffect(() => {
    let isCancelled = false;
    if (isOpen && setlist) {
      if (setlist.items.length === 0) {
        setIsGenerating(false);
        setQrUrls([]);
        setPageIdx(0);
        setPayload("");
        return;
      }
      (async () => {
        setIsGenerating(true);
        const fullSongs: Song[] = [];
        for (const item of setlist.items) {
          const s = await getSongById(item.songId);
          if (s) {
            fullSongs.push(s);
          }
        }
        const code = await encodeSetlistToPayload(setlist.name, setlist.items, fullSongs);
        if (isCancelled) return;
        setPayload(code);
        const pages = splitIntoQrChunks(code);
        const urls: string[] = [];
        for (const page of pages) {
          urls.push(await generateQrDataUrl(page, pages.length > 1 ? "L" : undefined));
          if (isCancelled) return;
        }
        setQrUrls(urls);
        setPageIdx(0);
        setMode(urls.some((u) => u === "") ? "code" : "qr");
        setIsGenerating(false);
      })().catch(() => {
        if (isCancelled) return;
        setIsGenerating(false);
        setMode("code");
      });
    } else {
      setQrUrls([]);
      setPageIdx(0);
      setPayload("");
      setCopied(false);
      setCopyFailed(false);
      setIsGenerating(false);
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, setlist]);

  if (!isOpen || !setlist) return null;
  if (typeof document === "undefined") return null;

  const songCount = setlist.items.length;
  const isListEmpty = songCount === 0;
  const pageCount = qrUrls.length;
  const isQrAvailable = (qrUrls[0] !== "" && qrUrls.length > 0) || isGenerating;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: setlist.name,
        text: payload
      });
    } catch {
      setMode("code");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] max-h-[calc(100dvh-2rem)] sheet-scroll rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-modal-pop text-center my-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3 gap-3">
          <div className="flex items-center gap-2.5 text-left min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate max-w-[200px] leading-tight">
                {setlist.name}
              </h2>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-mono tnum leading-none mt-0.5">
                {songCount} {songCount === 1 ? "música" : "músicas"} • 100% Offline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] emil-press shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {isListEmpty ? (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] space-y-1">
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                Esta lista ainda não tem músicas
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Adicione músicas na tela Índice A-Z e volte aqui para compartilhar com a banda.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-sm font-bold emil-press shadow-md shadow-[var(--color-accent)]/20"
            >
              Entendi
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-1 rounded-full">
              <button
                onClick={() => setMode("qr")}
                disabled={!isQrAvailable}
                className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-full text-xs font-bold emil-press disabled:opacity-40 ${
                  mode === "qr"
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Mostrar código</span>
              </button>
              <button
                onClick={() => setMode("code")}
                className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-full text-xs font-bold emil-press ${
                  mode === "code"
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Enviar código</span>
              </button>
            </div>

            {mode === "qr" ? (
              <div className="space-y-3">
                <div className="flex flex-col items-center justify-center p-3 bg-[#FFF8F0] rounded-2xl shadow-inner border border-[#8C5A3C]/30 min-h-[240px]">
                  {isGenerating ? (
                    <div className="max-w-[240px] w-full aspect-square flex flex-col items-center justify-center text-[var(--color-text-secondary)] text-xs mx-auto gap-2">
                      <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                      <span>Preparando o código...</span>
                    </div>
                  ) : (
                    <img
                      src={qrUrls[pageIdx]}
                      alt={`Código para compartilhar a lista, página ${pageIdx + 1} de ${pageCount}`}
                      className="max-w-[240px] w-full aspect-square object-contain rounded-lg mx-auto"
                    />
                  )}
                </div>

                {pageCount > 1 && !isGenerating && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                      disabled={pageIdx === 0}
                      aria-label="Código anterior"
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] emil-press disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4 shrink-0" />
                    </button>
                    <span className="text-xs font-bold text-[var(--color-text-primary)] font-mono tnum">
                      Código {pageIdx + 1} de {pageCount}
                    </span>
                    <button
                      onClick={() => setPageIdx((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={pageIdx === pageCount - 1}
                      aria-label="Próximo código"
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] emil-press disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed text-left">
                  <strong className="text-[var(--color-text-primary)]">Como usar:</strong> no outro
                  celular, abra este aplicativo, toque em <strong>Listas</strong> e depois em{" "}
                  <strong>Escanear QR</strong>. A câmera vai ler este código.
                  {pageCount > 1 && !isGenerating && (
                    <> Mostre cada código em sequência, do 1 até o {pageCount}.</>
                  )}
                </p>

                <button
                  onClick={() => setMode("code")}
                  className="w-full h-9 flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-xs font-semibold text-[var(--color-text-primary)] emil-press"
                >
                  <Send className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                  <span>A câmera não está funcionando? Enviar por texto</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] space-y-2 text-left">
                  <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">
                    <strong>Como usar:</strong> toque em <strong>Copiar código</strong> e cole no
                    WhatsApp para o outro celular. Lá, abra o aplicativo, toque em{" "}
                    <strong>Listas → Escanear QR → Colar código</strong>.
                  </p>
                  <textarea
                    readOnly
                    value={payload}
                    rows={3}
                    aria-label="Código da lista para copiar"
                    className="w-full px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-xl text-[10px] text-[var(--color-text-secondary)] resize-none focus:outline-none font-mono break-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 px-3 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs font-bold emil-press shadow-md shadow-[var(--color-accent)]/20"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <Copy className="w-4 h-4 shrink-0" />
                    )}
                    <span>{copied ? "Copiado" : "Copiar código"}</span>
                  </button>

                  {canUseNativeShare && (
                    <button
                      onClick={handleNativeShare}
                      title="Enviar pelo menu de compartilhamento do celular"
                      className="h-11 px-4 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-[var(--color-text-primary)] emil-press shrink-0"
                    >
                      <Share2 className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                    </button>
                  )}
                </div>

                {copyFailed && (
                  <p className="text-[11px] text-rose-600 leading-relaxed">
                    O navegador não deixou copiar sozinho. Toque duas vezes no código acima e
                    copie na mão.
                  </p>
                )}

                <button
                  onClick={() => setMode("qr")}
                  disabled={!isQrAvailable}
                  className="w-full h-9 flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-bg-subtle)] disabled:opacity-40 border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-xs font-semibold text-[var(--color-text-primary)] emil-press"
                >
                  <QrCode className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                  <span>Mostrar código para a câmera</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full h-10 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] text-xs font-semibold text-[var(--color-text-primary)] emil-press"
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
