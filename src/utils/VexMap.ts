import { StaveNote, Dot, Accidental } from 'vexflow'; // <--- 1. Import Accidental
import type { RenderedNote } from '../types';

export const convertToVexNotes = (notes: RenderedNote[]) => {
  return notes.map((note) => {
    // 1. Clean the duration string
    const baseDuration = note.duration.replace('d', '').replace('r', '');

    const staveNote = new StaveNote({
      clef: "treble", 
      keys: note.keys,
      duration: baseDuration,
      autoStem: true,
    });

    // 2. Add Accidentals (Sharps)
    // We iterate through every key (handling chords) to see if it needs a sharp
    note.keys.forEach((key, index) => {
      if (key.includes('#')) {
        staveNote.addModifier(new Accidental('#'), index);
      }
    });

    // 3. Add Dots
    if (note.duration.includes('d')) {
      Dot.buildAndAttach([staveNote], { all: true });
    }

    // 4. Apply Color
    if (note.color) {
      staveNote.setStyle({ fillStyle: note.color, strokeStyle: note.color });
    }

    return staveNote;
  });
};