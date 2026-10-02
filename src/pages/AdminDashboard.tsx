import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Eye,
  RefreshCw,
  Upload,
  CheckCircle2,
  FileText,
  Download
} from 'lucide-react';
import { db } from '../db/dexie';
import {
  getAllSongs,
  getSongById,
  saveSong,
  deleteSong,
  SEED_ID_PREFIX
} from '../services/songService';
import { COMMON_KEYS, extractCifraClubKey, cleanCifraClubArtifacts, detectFormat } from '../services/chordEngine';
import { ChordViewer } from '../components/ChordViewer';
import type { Song, SongLeader } from '../types';

export const AdminDashboard: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [leader, setLeader] = useState<SongLeader>('Igreja');
  const [bpm, setBpm] = useState('');
  const [originalKey, setOriginalKey] = useState('C');
  const [keyMode, setKeyMode] = useState<'auto' | 'manual'>('auto');
  const [formatMode, setFormatMode] = useState<'auto' | 'chords-over-lyrics' | 'chordpro'>('auto');
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const detectedKey = useMemo(() => extractCifraClubKey(content), [content]);
  const resolvedKey = useMemo(() => {
    if (keyMode === 'auto' && detectedKey && COMMON_KEYS.includes(detectedKey)) {
      return detectedKey;
    }
    return originalKey;
  }, [keyMode, detectedKey, originalKey]);

  const detectedFormat = useMemo(() => detectFormat(content), [content]);
  const resolvedFormat = formatMode === 'auto' ? detectedFormat : formatMode;

const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    const allSongs = await getAllSongs();
    const allSetlists = await db.setlists.toArray();
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      songs: allSongs,
      setlists: allSetlists
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hinario-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let count = 0;
      if (Array.isArray(parsed.songs)) {
        for (const s of parsed.songs) {
          await saveSong(s);
        }
        count = parsed.songs.length;
      }
      if (Array.isArray(parsed.setlists)) {
        await db.setlists.bulkPut(parsed.setlists);
      }
      await loadSongs();
      setImportStatus(`Backup restaurado! ${count} músicas sincronizadas.`);
      if (backupInputRef.current) {
        backupInputRef.current.value = "";
      }
    } catch {
      alert("Arquivo de backup JSON inválido.");
    }
  };

  const loadSongs = async () => {
    const active = await getAllSongs();
    setSongs(active.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')));
  };

  useEffect(() => {
    loadSongs();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setArtist('');
    setLeader('Igreja');
    setBpm('');
    setOriginalKey('C');
    setKeyMode('auto');
    setFormatMode('auto');
    setContent('');
    setShowPreview(false);
    setIsEditing(true);
  };

  const handleOpenEdit = async (song: Song) => {
    let fullSong = song;
    if (!fullSong.content) {
      const fetched = await getSongById(song.id);
      if (fetched) fullSong = fetched;
    }
    setEditingId(fullSong.id);
    setTitle(fullSong.title);
    setArtist(fullSong.artist || '');
    setLeader(fullSong.leader || 'Igreja');
    setBpm(fullSong.bpm !== undefined ? String(fullSong.bpm) : '');
    setOriginalKey(fullSong.originalKey);
    setKeyMode('manual');
    setFormatMode(fullSong.format);
    setContent(fullSong.content || '');
    setShowPreview(false);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Preencha título e conteúdo da cifra.');
      return;
    }

    const sanitizedContent = cleanCifraClubArtifacts(content);
    const parsedBpm = bpm.trim() ? parseInt(bpm.trim(), 10) : undefined;
    const existingSong = editingId ? songs.find((s) => s.id === editingId) : null;

    const songData: Song = {
      id: editingId || `song_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      artist: artist.trim() || leader,
      leader: leader || 'Igreja',
      bpm: parsedBpm && !isNaN(parsedBpm) && parsedBpm > 0 ? parsedBpm : undefined,
      originalKey: resolvedKey,
      format: resolvedFormat,
      content: sanitizedContent,
      createdAt: existingSong?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    await saveSong(songData);
    setIsEditing(false);
    await loadSongs();
  };

  const handleDelete = async (songId: string, songTitle: string) => {
    if (
      window.confirm(`Excluir "${songTitle}" definitivamente? Esta ação não pode ser desfeita.`)
    ) {
      await deleteSong(songId);
      await loadSongs();
    }
  };

  const extractKeyFromText = (text: string): string => {
    const detected = extractCifraClubKey(text);
    if (detected && COMMON_KEYS.includes(detected)) return detected;
    return 'C';
  };

  const handleBatchTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportStatus(`Lendo ${files.length} arquivos...`);

    const newSongs: Song[] = [];
    const now = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        let detectedLeader: SongLeader = 'Igreja';
        const prefixMatch = file.name.match(/^([DLMI])\s*[-_]/i);
        if (prefixMatch) {
          const p = prefixMatch[1].toUpperCase();
          if (p === 'D') detectedLeader = 'Doni';
          else if (p === 'L') detectedLeader = 'Lucas';
          else if (p === 'M') detectedLeader = 'Magu';
          else if (p === 'I') detectedLeader = 'Igreja';
        }

        const rawName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/^[DLMI]\s*[-_]\s*/i, '')
          .trim();
        const songTitle = rawName || `Música ${i + 1}`;
        const key = extractKeyFromText(text);
        const detectedBpmMatch = text.match(/(?:bpm|tempo|andamento):\s*(\d{2,3})/i);
        const bpmVal = detectedBpmMatch ? parseInt(detectedBpmMatch[1], 10) : undefined;
        const validBpm = bpmVal && !isNaN(bpmVal) && bpmVal >= 30 && bpmVal <= 300 ? bpmVal : undefined;

        const slug = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/^[dlmi][-_]/, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const id = `${SEED_ID_PREFIX}${detectedLeader.toLowerCase()}_${slug || `song_${now}_${i}`}`;

        newSongs.push({
          id,
          title: songTitle,
          artist: detectedLeader,
          leader: detectedLeader,
          bpm: validBpm,
          originalKey: key,
          format: text.includes('[') && text.includes(']') ? 'chordpro' : 'chords-over-lyrics',
          content: cleanCifraClubArtifacts(text),
          createdAt: now + i * 1000,
          updatedAt: now + i * 1000
        });
      } catch (err) {
        console.warn(`Erro ao ler arquivo ${file.name}:`, err);
      }
    }

    if (newSongs.length > 0) {
      for (const s of newSongs) {
        await saveSong(s);
      }
      await loadSongs();
      setImportStatus(`Sucesso! ${newSongs.length} músicas importadas para o hinário offline.`);
    } else {
      setImportStatus('Nenhum arquivo TXT processado.');
    }

    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-7 space-y-5 animate-ui-fade">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)]/20 shadow-sm transition-colors duration-150">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C08552]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#C08552] font-mono">
              Gestão & Importação
            </span>
          </div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)] mt-1">Acervo do Hinário</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
            Cadastre louvores, edite cifras por líder (Doni, Lucas, Magu, Igreja) ou importe arquivos TXT em lote.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.chordpro,.cifra"
            onChange={handleBatchTxtUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs sm:text-sm font-bold shadow-md shadow-[#C08552]/20 disabled:opacity-50 emil-press"
            title="Importar múltiplos arquivos TXT"
          >
            <Upload className="w-4 h-4" />
            <span>{isImporting ? 'Importando...' : 'Importar TXTs em Lote'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/25 hover:bg-[var(--color-bg-card)] text-[var(--color-text-primary)] text-xs sm:text-sm font-bold emil-press shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#C08552]" />
            <span>Nova Música</span>
          </button>

          <input
            ref={backupInputRef}
            type="file"
            accept=".json"
            onChange={handleImportBackup}
            className="hidden"
          />

          <button
            onClick={() => backupInputRef.current?.click()}
            className="flex items-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/25 hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs font-bold emil-press"
            title="Restaurar backup JSON com músicas e setlists"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden md:inline">Restaurar</span>
          </button>

          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/25 hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs font-bold emil-press"
            title="Baixar backup JSON com músicas e setlists"
          >
<Download className="w-4 h-4" />
            <span className="hidden md:inline">Backup</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-4 rounded-2xl bg-[var(--color-bg-card)] border-[var(--color-border)]/25 flex items-center justify-between gap-3 text-xs text-[var(--color-text-primary)] animate-ui-fade shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importStatus}</span>
          </div>
          <button onClick={() => setImportStatus(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isEditing && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsEditing(false)}>
          <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] bg-[var(--color-bg-card)] border border-[var(--color-border)]/25 rounded-3xl p-6 shadow-2xl overflow-y-auto sheet-scroll space-y-6 animate-modal-pop my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/20 pb-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {editingId ? 'Editar Cifra / Música' : 'Cadastrar Nova Música'}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-5 space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Título da Música *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Bondade de Deus"
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Líder / Ministro *
                  </label>
                  <select
                    value={leader}
                    onChange={(e) => setLeader(e.target.value as SongLeader)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] font-bold"
                  >
                    <option value="Igreja">Igreja</option>
                    <option value="Doni">Doni</option>
                    <option value="Lucas">Lucas</option>
                    <option value="Magu">Magu</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Artista / Banda
                  </label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    BPM
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                    placeholder="Ex: 72"
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Tom Original *
                  </label>
                  <select
                    value={keyMode === 'auto' ? 'auto' : originalKey}
                    onChange={(e) => {
                      if (e.target.value === 'auto') {
                        setKeyMode('auto');
                      } else {
                        setKeyMode('manual');
                        setOriginalKey(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] font-mono font-bold"
                  >
                    <option value="auto">
                      Auto-detectar {detectedKey ? `(${detectedKey})` : '(Tom: C / 1º acorde)'}
                    </option>
                    {COMMON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Formato da Cifra
                  </label>
                  <select
                    value={formatMode}
                    onChange={(e) =>
                      setFormatMode(e.target.value as Song["format"] | "auto")
                    }
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="auto">Auto-detectar ({detectedFormat})</option>
                    <option value="chords-over-lyrics">Padrão: Cifras sobre letra (Cifra Club)</option>
                    <option value="chordpro">Manual: ChordPro ([C]Acordes entre colchetes)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Conteúdo da Cifra *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const cleaned = cleanCifraClubArtifacts(content);
                        setContent(cleaned);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      title="Remover duplicações e resíduos do Cifra Club"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Limpar Cifra</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#C08552] hover:text-[var(--color-text-primary)]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{showPreview ? 'Ocultar Preview' : 'Visualizar Preview'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={10}
                  required
                  value={content}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.includes('">')) {
                      val = cleanCifraClubArtifacts(val);
                    }
                    setContent(val);
                    const detected = extractCifraClubKey(val);
                    if (detected && COMMON_KEYS.includes(detected)) {
                      setOriginalKey(detected);
                    }
                  }}
                  placeholder="Cole aqui a cifra exatamente como no Word ou TXT..."
                  className="w-full px-3.5 py-3 bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 rounded-2xl text-base sm:text-sm font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] whitespace-pre"
                />
              </div>

              {showPreview && content && (
                <div className="p-4 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/25 space-y-2">
                  <span className="text-[11px] font-bold text-[#C08552] uppercase tracking-wider font-mono">
                    Pré-visualização:
                  </span>
                  <ChordViewer
                    song={{
                      id: 'preview',
                      title,
                      artist,
                      leader,
                      bpm: bpm.trim() ? parseInt(bpm.trim(), 10) : undefined,
                      originalKey: resolvedKey,
                      format: resolvedFormat,
                      content,
                      createdAt: 0,
                      updatedAt: 0
                    }}
                    currentKey={resolvedKey}
                    fontSize={16}
                  />
                </div>
              )}

              <div className="pt-4 border-t border-[var(--color-border)]/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-10 sm:h-11 px-5 rounded-full bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-xs sm:text-sm font-bold emil-press"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-xs font-bold shadow-md shadow-[var(--color-accent)]/25 emil-press"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Música</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)]/20 rounded-3xl overflow-hidden shadow-sm transition-colors duration-150">
        <div className="p-4 border-b border-[var(--color-border)]/15 flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Repertório Ativo ({songs.length})
          </span>
        </div>

        <div className="divide-y divide-[var(--color-border)]/15 max-h-[60vh] overflow-y-auto sheet-scroll">
          {songs.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-secondary)] text-sm">
              Nenhuma música cadastrada no momento. Clique em "Importar TXTs em Lote" para carregar a pasta da igreja.
            </div>
          ) : (
            songs.map((song) => (
              <div
                key={song.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:bg-[var(--color-bg-subtle)]/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] truncate">{song.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-mono text-[11px] font-bold">
                      {song.leader || 'Igreja'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--color-accent)]/15 border border-[#C08552]/30 text-[#C08552] font-mono font-bold text-xs sm:text-sm">
                      {song.originalKey}
                    </span>
                    {song.bpm && (
                      <span className="px-2 py-0.5 rounded-md bg-[var(--color-bg-subtle)] border border-[var(--color-border)]/30 text-[var(--color-text-secondary)] font-mono font-bold text-xs sm:text-sm">
                        {song.bpm} BPM
                      </span>
                    )}
                  </div>
                  {song.artist && song.artist !== (song.leader || 'Igreja') && (
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] truncate mt-1">{song.artist}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(song)}
                    title="Editar cifra"
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] emil-press"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(song.id, song.title)}
                    title="Mover para lixeira"
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[var(--color-bg-subtle)] hover:bg-rose-500/20 text-[var(--color-text-secondary)] hover:text-rose-600 emil-press"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
