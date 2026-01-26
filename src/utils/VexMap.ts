import { StaveNote, Dot } from 'vexflow';
import type { RenderedNote } from '../types';

export const convertToVexNotes = (notes: RenderedNote[]) => {
  return notes.map((note) => {
    // 1. Clean the duration string for VexFlow
    // VexFlow's StaveNote constructor doesn't understand 'qd' or 'hd'.
    // It wants the base duration (w, h, q, 8, 16).
    const baseDuration = note.duration.replace('d', '').replace('r', '');

    const staveNote = new StaveNote({
      clef: "treble", 
      keys: note.keys,
      duration: baseDuration,
      autoStem: true,
    });

    // 2. Add Dots
    // If our duration code contains 'd', we tell VexFlow to draw a dot.
    if (note.duration.includes('d')) {
      // { all: true } ensures all notes in a chord get a dot
      Dot.buildAndAttach([staveNote], { all: true });
    }

    // 3. Apply Color
    if (note.color) {
      staveNote.setStyle({ fillStyle: note.color, strokeStyle: note.color });
    }

    return staveNote;
  });
};