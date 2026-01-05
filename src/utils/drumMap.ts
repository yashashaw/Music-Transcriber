import type { DrumType } from '../types';

export const MIDI_TO_DRUM: Record<number, DrumType> = {
  // Kick
  35: 'bd',           // Acoustic Bass Drum
  36: 'bd',           // Bass Drum 1
  
  // Snare
  38: 'sn',          // Acoustic sn
  40: 'sn',          // Electric sn
  37: 'sn',          // Side Stick (optional, often mapped to sn)

  // Hi-Hats
  42: 'hhc',   // Closed Hi-Hat
  44: 'hhc',   // Pedal Hi-Hat
  46: 'hho',     // Open Hi-Hat
  
  // Cymbals
  49: 'cymc',          // Crash Cymbal 1
  57: 'cymc',          // Crash Cymbal 2
  51: 'cymr',           // Ride Cymbal 1
  59: 'cymr',           // Ride Cymbal 2
  
  // Toms (Optional - mapping these to existing types or ignoring them for now)
  // You can add more DrumTypes to your types.ts if you want to support toms later.
};

export const KEYBOARD_MAP: Record<string, number> = {
  'a': 36, // bd (Bass Drum 1)
  's': 38, // sn (Acoustic sn)
  'd': 42, // Hi-Hat Closed
  'f': 46, // Hi-Hat Open
  ' ': 49, // Crash (Spacebar maps to Crash 1)
  'j': 51, // Ride (Ride Cymbal 1)
  // You can map 'z' or 'x' to Toms if you add them later
};