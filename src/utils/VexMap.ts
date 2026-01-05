import { StaveNote, Articulation } from 'vexflow';
import type { RenderedNote, DrumType } from '../types';

// The Visual Dictionary
const DRUM_PITCHES: Record<DrumType, string> = {
  'bd': 'f/4',           
  'sn': 'c/5',          
  'hhc': 'g/5/X0',
  'hho': 'g/5/X0',  
  'cymc': 'a/5/X0',       
  'cymr': 'f/5/X0'         
};

export const convertToVexNotes = (notes: RenderedNote[]) => {
  return notes.map((note) => {
    // 1. Collect ALL keys for this chord
    // We map over the array of types (e.g. ['kick', 'crash'] -> ['f/4', 'a/5/X0'])
    const keys = note.types.map(t => DRUM_PITCHES[t] || 'c/5');

    // 2. Create the Note
    const staveNote = new StaveNote({
      clef: "percussion",
      keys: keys, // VexFlow accepts an array of keys automatically!
      duration: note.duration,
      autoStem: true,
    });

    // 3. Handle Articulations (like Hi-Hat Open)
    // We check if ANY of the drums in the chord need the 'o' symbol
    if (note.types.includes('hho')) {
       staveNote.addModifier(new Articulation('a@a').setPosition(3)); 
    }

    return staveNote;
  });
};