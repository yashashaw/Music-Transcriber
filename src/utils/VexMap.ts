import { StaveNote } from 'vexflow';
import type { RenderedNote } from '../types';

export const convertToVexNotes = (notes: RenderedNote[]) => {
  return notes.map((note) => {
    // 1. Create the Note
    const staveNote = new StaveNote({
      clef: "treble", 
      keys: note.keys, // Direct array of pitches (e.g. ["c/4"])
      duration: note.duration,
      autoStem: true,
    });

    // 2. Apply Color (Red for active notes)
    if (note.color) {
      staveNote.setStyle({ fillStyle: note.color, strokeStyle: note.color });
    }

    return staveNote;
  });
};