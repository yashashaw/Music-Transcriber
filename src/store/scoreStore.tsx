import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // <--- 1. Import Middleware
import type { RenderedNote } from '../types';
import { fetchNotes, clearAllNotes, saveSession } from '../api/api'; // Import saveSession
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
  
  // NEW ACTION
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
          
          // Create the note with RAW data for future editing
          const newNote: RenderedNote = {
            id: crypto.randomUUID(),
            keys: [formatToVexKey(noteData.noteName)],
            duration: finalDuration,
            
            // --- NEW DATA ---
            rawDuration: durationSec,
            startTimeOffset: noteData.startTime, // You might want to offset this by session start later
            // ----------------
            
            isRest: false,
            color: 'black'
          };

          const newActive = new Map(activeNotes);
          newActive.delete(midi);
          
          set({ 
            activeNotes: newActive,
            notes: [...notes, newNote]
          });
          // Zustand Persist auto-saves to LocalStorage here!
        }
      },

      // --- NEW: BATCH SAVE ACTION ---
      saveRecording: async () => {
        const { notes, bpm } = get();
        if (notes.length === 0) return;

        try {
          console.log("Saving batch to backend...");
          await saveSession({
            title: `Recording ${new Date().toLocaleString()}`,
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
        if (fetchedNotes && fetchedNotes.length > 0) {
          set({ notes: fetchedNotes });
        }
      },

      toggleMetronome: () => set((state) => ({ 
        isMetronomeOn: !state.isMetronomeOn 
      })),
    }),
    {
      name: 'maestro-backup', // Unique name for LocalStorage key
      partialize: (state) => ({ notes: state.notes, bpm: state.bpm }), // Only persist notes and settings
    }
  )
);