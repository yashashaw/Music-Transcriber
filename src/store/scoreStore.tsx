import { create } from 'zustand';
import type { RenderedNote, NoteDuration } from '../types';
import { fetchNotes, clearAllNotes } from '../api/api';

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
}

// Helper: Convert Seconds -> VexFlow Duration Code
const quantizeDuration = (seconds: number, bpm: number): NoteDuration => {
  const secondsPerBeat = 60 / bpm;
  const numBeats = seconds / secondsPerBeat;

  if (numBeats < 0.25) return '16'; 
  if (numBeats < 0.75) return '8';
  if (numBeats < 1.5)  return 'q'; 
  if (numBeats < 3.0)  return 'h'; 
  return 'w';                      
};

// Helper: Convert "C4" -> "c/4"
const formatToVexKey = (note: string) => {
  if (!note) return 'c/5';
  return `${note.charAt(0).toLowerCase()}/${note.slice(1)}`;
};

export const useScoreStore = create<ScoreState>((set, get) => ({
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
}));