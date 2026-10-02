import React from "react";
import { BookOpen, Star, Settings, Music2, Sun, Moon } from "lucide-react";
import { useSetlists } from "../context/SetlistListsContext";
import { useTheme } from "../context/ThemeContext";

interface NavbarProps {
  currentTab: "index" | "setlists" | "admin";
  setCurrentTab: (tab: "index" | "setlists" | "admin") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { activeItemsWithSongs, activeSetlist } = useSetlists();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/85 backdrop-blur-2xl pt-[env(safe-area-inset-top,0px)] transition-colors duration-150">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div
            onClick={() => setCurrentTab("index")}
            className="flex items-center gap-2 cursor-pointer group select-none emil-press shrink-0"
            role="button"
            tabIndex={0}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center shadow-md shadow-[var(--color-accent)]/20 group-hover:scale-105 transition-transform">
              <Music2 className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-accent-contrast)] stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg sm:text-xl tracking-tight text-[var(--color-text-primary)] leading-none">
                Hinário
              </span>
              <span className="text-xs text-[var(--color-text-secondary)] font-semibold hidden md:inline mt-0.5">
                100% Offline
              </span>
            </div>
          </div>

          {/* Desktop & Tablet Segmented Control */}
          <nav
            className="hidden sm:flex items-center gap-1 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-1 rounded-full shadow-inner"
            role="tablist"
          >
            <button
              role="tab"
              aria-selected={currentTab === "index"}
              onClick={() => setCurrentTab("index")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-bold emil-press ${currentTab === "index"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm font-bold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]"
                }`}
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Índice A-Z</span>
            </button>

            <button
              role="tab"
              aria-selected={currentTab === "setlists"}
              onClick={() => setCurrentTab("setlists")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-bold emil-press ${currentTab === "setlists"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm font-bold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]"
                }`}
              title={activeSetlist?.name}
            >
              <Star className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${activeItemsWithSongs.length > 0 ? "fill-current" : ""}`} />
              <span>Listas</span>
              {activeItemsWithSongs.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs font-mono tnum font-black ${currentTab === "setlists"
                    ? "bg-[var(--color-accent-contrast)]/30 text-[var(--color-accent-contrast)]"
                    : "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                    }`}
                >
                  {activeItemsWithSongs.length}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={currentTab === "admin"}
              onClick={() => setCurrentTab("admin")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-bold emil-press ${currentTab === "admin"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm font-bold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)]"
                }`}
              title="Gestão & Importador"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Gestão</span>
            </button>
          </nav>

          <button
            onClick={toggleTheme}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] emil-press shrink-0"
            title={theme === "light" ? "Modo Palco Escuro (Espresso Bar)" : "Modo Hinário Creme (Papel Linho)"}
            aria-label="Alternar tema"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 shrink-0" />
            ) : (
              <Sun className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Native Bottom Tab Bar (< 640px) */}
      <nav
        aria-label="Navegação Inferior"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-page)]/95 backdrop-blur-2xl border-t border-[var(--color-border-subtle)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 transition-colors duration-150"
      >
        <div className="flex items-center justify-around max-w-sm mx-auto">
          <button
            role="tab"
            aria-selected={currentTab === "index"}
            onClick={() => setCurrentTab("index")}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[56px] rounded-2xl emil-press transition-colors ${currentTab === "index"
              ? "text-[var(--color-accent)] font-black"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium"
              }`}
          >
            <BookOpen className="w-6 h-6 shrink-0 stroke-[2.4]" />
            <span className="text-xs mt-1.5 font-bold leading-none">Índice</span>
          </button>

          <button
            role="tab"
            aria-selected={currentTab === "setlists"}
            onClick={() => setCurrentTab("setlists")}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[56px] rounded-2xl emil-press relative transition-colors ${currentTab === "setlists"
              ? "text-[var(--color-accent)] font-black"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium"
              }`}
          >
            <div className="relative">
              <Star className={`w-6 h-6 shrink-0 stroke-[2.4] ${activeItemsWithSongs.length > 0 ? "fill-current" : ""}`} />
              {activeItemsWithSongs.length > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-contrast)] text-[11px] font-mono tnum font-black flex items-center justify-center leading-none">
                  {activeItemsWithSongs.length}
                </span>
              )}
            </div>
            <span className="text-xs mt-1.5 font-bold leading-none">Listas</span>
          </button>

          <button
            role="tab"
            aria-selected={currentTab === "admin"}
            onClick={() => setCurrentTab("admin")}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[56px] rounded-2xl emil-press transition-colors ${currentTab === "admin"
              ? "text-[var(--color-accent)] font-black"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium"
              }`}
          >
            <Settings className="w-6 h-6 shrink-0 stroke-[2.4]" />
            <span className="text-xs mt-1.5 font-bold leading-none">Gestão</span>
          </button>
        </div>
      </nav>
    </>
  );
};
