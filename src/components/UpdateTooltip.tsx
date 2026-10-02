import React, { useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import { useAppUpdate } from "../hooks/useAppUpdate";

interface UpdateTooltipProps {
  compact?: boolean;
}

export const UpdateTooltip: React.FC<UpdateTooltipProps> = ({ compact = false }) => {
  const { needsUpdate, applyUpdate } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!needsUpdate) return null;

  const showBanner = !compact && !dismissed;
  const showPill = compact || dismissed;

  return (
    <>
      {showBanner && (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 w-full border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] shadow-sm shadow-black/5 dark:shadow-black/20 px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 animate-ui-fade"
        >
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-contrast)] flex items-center justify-center shadow-md shadow-[var(--color-accent)]/25 shrink-0">
                <ArrowUpCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black tracking-tight text-[var(--color-text-primary)] leading-tight">
                  O Hinário foi atualizado
                </p>
                <p className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] font-medium mt-0.5 leading-relaxed">
                  Para usar a novidade, toque no botão abaixo. O que você está fazendo agora não se perde.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={applyUpdate}
                className="h-12 flex-1 sm:flex-none sm:px-6 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-sm sm:text-base font-black flex items-center justify-center gap-2 shadow-md shadow-[var(--color-accent)]/25 emil-press transition-colors"
              >
                <ArrowUpCircle className="w-5 h-5 stroke-[2.5]" />
                Atualizar agora
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dispensar aviso de atualização"
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors emil-press shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showPill && (
        <button
          type="button"
          onClick={applyUpdate}
          aria-label="Atualizar o Hinário"
          className="fixed z-40 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-3 sm:right-6 sm:bottom-6 h-11 px-4 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-black/10 dark:shadow-black/40 hover:bg-[var(--color-bg-subtle)] transition-colors emil-press animate-ui-fade"
        >
          <ArrowUpCircle className="w-4 h-4 stroke-[2.5] text-[var(--color-accent)]" />
          Atualizar
        </button>
      )}
    </>
  );
};