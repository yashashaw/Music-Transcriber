import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RenderedNote } from '../types';
import { fetchNotes, clearAllNotes, saveSession } from '../api/api';
import { quantizeDuration } from '../utils/musicMath';

interface ActiveNoteData {
  startTime: number;
  noteName: string;
  midi: number;
}

interface ScoreState {
  notes: RenderedNote[];
  activeNotes: Map<number, ActiveNoteData>;
  bpm: number;
  isMetronomeOn: boolean;

  setBpm: (newBpm: number) => void;
  clearScore: () => void;
  loadNotesFromBackend: () => Promise<void>;
  toggleMetronome: () => void;
  handleNoteOn: (midi: number, noteName: string) => void;
  handleNoteOff: (midi: number) => void;
  forceRenderTick: () => void;

  saveRecording: () => Promise<void>;
}

export const formatToVexKey = (note: string) => {
  if (!note) return 'c/5';
  const match = note.match(/^([a-gA-G][#b]*|rest)([0-9])$/);
  if (!match) return 'c/5';
  return `${match[1].toLowerCase()}/${match[2]}`;
};

export const useScoreStore = create<ScoreState>()(
  persist(
    (set, get) => ({
      notes: [],
      activeNotes: new Map(),
      bpm: 100,
      isMetronomeOn: false,

      setBpm: (newBpm) => set({ bpm: newBpm }),

      handleNoteOn: (midi, noteName) => {
        const { activeNotes } = get();
        const newActive = new Map(activeNotes);
        newActive.set(midi, { startTime: Date.now() / 1000, noteName, midi });
        set({ activeNotes: newActive });
      },

      handleNoteOff: (midi) => {
        const { activeNotes, notes, bpm } = get();
        const noteData = activeNotes.get(midi);

        if (noteData) {
          const durationSec = (Date.now() / 1000) - noteData.startTime;
          const finalDuration = quantizeDuration(durationSec, bpm);

          const newNote: RenderedNote = {
            id: crypto.randomUUID(),
            keys: [formatToVexKey(noteData.noteName)],
            duration: finalDuration,
            rawDuration: durationSec,
            startTimeOffset: noteData.startTime,
            isRest: false,
            color: 'black'
          };

          const newActive = new Map(activeNotes);
          newActive.delete(midi);

          set({
            activeNotes: newActive,
            notes: [...notes, newNote]
          });
        }
      },

      // --- FIXED: SAVE ACTION ---
      saveRecording: async () => {
        const { notes, bpm } = get();
        
        // REMOVED: if (notes.length === 0) return; 
        // We MUST allow saving empty notes to persist the "cleared" state.

        try {
          console.log("Saving batch to backend...");
          await saveSession({
            // Optional: Give it a different title if empty, or keep generic
            title: notes.length === 0 ? "Empty Session" : `Recording ${new Date().toLocaleString()}`,
            bpm,
            notes, 
            createdAt: new Date().toISOString()
          });
          console.log("Save successful!");
        } catch (error) {
          console.error("Failed to upload, but data is safe in LocalStorage", error);
        }
      },

      forceRenderTick: () => {
        const { activeNotes } = get();
        if (activeNotes.size > 0) {
          set({ activeNotes: new Map(activeNotes) });
        }
      },

      clearScore: () => {
        set({ notes: [], activeNotes: new Map() });
        clearAllNotes().catch(e => console.error(e));
      },

      loadNotesFromBackend: async () => {
        const fetchedNotes = await fetchNotes();
        // Ensure we load even if it's an empty array, provided the fetch was successful
        if (fetchedNotes) {
          set({ notes: fetchedNotes });
        }
      },

      toggleMetronome: () => set((state) => ({
        isMetronomeOn: !state.isMetronomeOn
      })),
    }),
    {
      name: 'maestro-backup',
      partialize: (state) => ({ notes: state.notes, bpm: state.bpm }),
    }
  )
);