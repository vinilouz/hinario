import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SetlistListsProvider } from './context/SetlistListsContext';
import { initializeDatabase } from './db/dexie';
import { ensureSeeded } from './services/songService';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { UpdateTooltip } from './components/UpdateTooltip';
import { IndexBook } from './pages/IndexBook';
import { SetlistsPage } from './pages/SetlistsPage';
import { Performance } from './pages/Performance';
import { AdminDashboard } from './pages/AdminDashboard';

type Tab = 'index' | 'setlists' | 'admin';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>('index');
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [performanceSongId, setPerformanceSongId] = useState<string>('');
  const [performanceSlotIndex, setPerformanceSlotIndex] = useState<number>(0);
  const [sourceTab, setSourceTab] = useState<'index' | 'setlists'>('index');

  useEffect(() => {
    initializeDatabase()
      .then(ensureSeeded)
      .catch((err: unknown) => {
        console.warn('Falha ao preparar o repertório local:', err);
      });
  }, []);

  const handleOpenSongFromIndex = (songId: string) => {
    setPerformanceSongId(songId);
    setPerformanceSlotIndex(0);
    setSourceTab('index');
    setIsPerformanceMode(true);
  };

  const handleStartPerformanceFromSetlists = (songId: string, slotIndex: number) => {
    setPerformanceSongId(songId);
    setPerformanceSlotIndex(slotIndex);
    setSourceTab('setlists');
    setIsPerformanceMode(true);
  };

  const handleExitPerformance = () => {
    setIsPerformanceMode(false);
  };

  if (isPerformanceMode) {
    return (
      <>
        <Performance
          initialSongId={performanceSongId}
          initialSlotIndex={performanceSlotIndex}
          sourceTab={sourceTab}
          onExit={handleExitPerformance}
        />
        <UpdateTooltip compact />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] flex flex-col selection:bg-[#C08552]/30 selection:text-[var(--color-text-primary)] transition-colors duration-150">
      <UpdateTooltip />
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 pb-20 sm:pb-10">
        {currentTab === 'index' && (
          <IndexBook onOpenSong={handleOpenSongFromIndex} />
        )}

        {currentTab === 'setlists' && (
          <SetlistsPage
            onStartPerformance={handleStartPerformanceFromSetlists}
            onNavigateToIndex={() => setCurrentTab('index')}
          />
        )}

        {currentTab === 'admin' && <AdminDashboard />}
      </main>

      <Footer />
      <PwaInstallPrompt />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SetlistListsProvider>
          <AppContent />
        </SetlistListsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
