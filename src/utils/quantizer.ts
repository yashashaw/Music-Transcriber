import type { NoteDuration } from '../types';

export const classifyDuration = (ms: number, bpm: number): NoteDuration | 'chord' => {
  const msPerBeat = 60000 / bpm;
  const beats = ms / msPerBeat;

  if (beats >= 3.5) return '1';      // Whole
  if (beats >= 1.5) return '2';      // Half
  if (beats >= 0.75) return '4';     // Quarter
  if (beats >= 0.35) return '8';     // Eighth
  if (beats >= 0.18) return '16';    // Sixteenth
  
  return 'chord'; // It was too fast to be a rhythm; it's a chord!
};