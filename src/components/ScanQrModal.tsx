import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Clipboard, AlertCircle, CheckCircle2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { decodePayloadToSetlist } from "../services/qrSharing";
import { useSetlists } from "../context/SetlistListsContext";
import type { Song } from "../types";

interface ScanQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DecodedSetlist {
  name: string;
  items: { songId: string; customKey: string }[];
  songs?: Song[];
}

export const ScanQrModal: React.FC<ScanQrModalProps> = ({ isOpen, onClose }) => {
  const { importSetlist, canCreateMore } = useSetlists();
  const [activeTab, setActiveTab] = useState<"camera" | "paste">(() =>
    window.matchMedia("(min-width: 640px)").matches ? "paste" : "camera"
  );
  const [pastedCode, setPastedCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<DecodedSetlist | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const stopScanner = async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn("Error stopping scanner:", err);
      }
      try {
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Error clearing scanner:", err);
      }
      isScanningRef.current = false;
    }
  };

  const handleProcessCode = async (code: string) => {
    setErrorMsg(null);
    const decoded = await decodePayloadToSetlist(code);
    if (!decoded) {
      setErrorMsg("QR Code ou código inválido. Verifique se copiou o código completo.");
      return;
    }
    setScannedData(decoded);
    await stopScanner();
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedData(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setPastedCode("");
      return;
    }

    if (activeTab === "camera" && !scannedData) {
      const qrRegionId = "qr-reader-region";
      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 }
          },
          (decodedText) => {
            handleProcessCode(decodedText);
          },
          () => {}
        )
        .then(() => {
          isScanningRef.current = true;
        })
        .catch((err) => {
          console.warn("Camera access issue:", err);
          setErrorMsg("Não foi possível acessar a câmera. Você pode colar o código abaixo.");
          setActiveTab("paste");
        });
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab, scannedData]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const handleConfirmImport = async (mode: "new" | "replace") => {
    if (!scannedData) return;
    const result = await importSetlist(scannedData.name, scannedData.items, mode, scannedData.songs);
    if (result.success) {
      const count = scannedData.songs?.length || 0;
      setSuccessMsg(
        count > 0
          ? `Lista "${scannedData.name}" e ${count} ${count === 1 ? 'música importada' : 'músicas importadas'} offline!`
          : `Lista "${scannedData.name}" sincronizada com sucesso!`
      );
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setErrorMsg(result.message || "Erro ao importar lista.");
    }
  };

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
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] leading-tight">
              Escanear Lista de Culto
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] emil-press"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[var(--color-accent)] mx-auto animate-bounce" />
            <p className="text-sm font-bold text-[var(--color-text-primary)]">{successMsg}</p>
          </div>
        ) : scannedData ? (
          <div className="space-y-4 animate-ui-fade">
            <div className="p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] space-y-1.5 text-center">
              <span className="text-[11px] font-mono text-[var(--color-accent)] uppercase font-bold tracking-wider">
                Lista Detectada:
              </span>
              <h3 className="text-lg font-black text-[var(--color-text-primary)] leading-tight">{scannedData.name}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono tnum">
                {scannedData.items.length} {scannedData.items.length === 1 ? "louvor" : "louvores"} com tons pré-definidos
              </p>
              {scannedData.songs && scannedData.songs.length > 0 && (
                <div className="inline-block px-2.5 py-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-bold mt-1">
                  {scannedData.songs.length} {scannedData.songs.length === 1 ? "cifra completa inclusa" : "cifras completas inclusas"}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleConfirmImport("new")}
                disabled={!canCreateMore}
                className="w-full h-9 flex items-center justify-center rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] emil-press text-[var(--color-accent-contrast)] text-xs font-bold shadow-md shadow-[var(--color-accent)]/20 disabled:opacity-40"
              >
                Salvar como Nova Lista
              </button>

              <button
                onClick={() => handleConfirmImport("replace")}
                className="w-full h-9 flex items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] emil-press text-[var(--color-text-primary)] text-xs font-semibold"
              >
                Substituir Lista Aberta
              </button>

              <button
                onClick={() => setScannedData(null)}
                className="w-full h-8 flex items-center justify-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] emil-press"
              >
                Escanear Outra
              </button>
            </div>
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

            {activeTab === "camera" && (
              <p className="text-xs text-[var(--color-text-secondary)] text-left leading-relaxed">
                Aponte a câmera para o código na tela do outro celular.
              </p>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
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
                  onClick={() => handleProcessCode(pastedCode)}
                  disabled={!pastedCode.trim()}
                  className="w-full h-11 flex items-center justify-center rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-sm font-bold emil-press disabled:opacity-40 shadow-md shadow-[var(--color-accent)]/20"
                >
                  Receber lista
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
