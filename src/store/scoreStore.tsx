import { create } from 'zustand';
import type { RenderedNote } from '../types';
import { fetchNotes, clearAllNotes } from '../api/api';

interface ScoreState {
  notes: RenderedNote[];
  bpm: number;                         
  addNote: (note: RenderedNote) => void;
  setBpm: (newBpm: number) => void;   
  clearScore: () => void;
  loadNotesFromBackend: () => Promise<void>;
  isMetronomeOn: boolean;             
  toggleMetronome: () => void;        
}

export const useScoreStore = create<ScoreState>((set) => ({
  notes: [],
  bpm: 120,
  isMetronomeOn: false,                            

  addNote: (note) => set((state) => ({
    notes: [...state.notes, note]
  })),

  setBpm: (newBpm) => set({ bpm: newBpm }),

  clearScore: () => {
    set({ notes: [] });

    clearAllNotes()
      .catch(error => {
        console.error('Error clearing backend:', error);
      });
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
}));