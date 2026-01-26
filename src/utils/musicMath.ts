import type { NoteDuration } from '../types';

/**
 * Converts raw play time into the nearest musical duration based on BPM.
 * Uses midpoints to create "buckets" for each note type.
 */
export const quantizeDuration = (seconds: number, bpm: number): NoteDuration => {
  const secondsPerBeat = 60 / bpm;
  const numBeats = seconds / secondsPerBeat;

  // We widen the '8' and 'q' buckets by pushing the triplet thresholds further away
  if (numBeats < 0.29) return '16';
  if (numBeats < 0.38) return '8r'; // Narrowed triplet bucket
  if (numBeats < 0.62) return '8';  // WIDENED 8th bucket (0.583 now falls here!)
  if (numBeats < 0.88) return 'qr'; // Narrowed triplet bucket
  if (numBeats < 1.30) return 'q';  // WIDENED quarter bucket
  if (numBeats < 1.75) return 'qd';
  if (numBeats < 2.5)  return 'h';
  if (numBeats < 3.5)  return 'hd';
  return 'w';
};

/**
 * Returns the decimal beat value for measure-filling calculations.
 */
export const getDurationValue = (duration: string): number => {
  switch (duration) {
    case 'w':  return 4;
    case 'hd': return 3;
    case 'h':  return 2;
    case 'qd': return 1.5;
    case 'q':  return 1;
    case 'qr': return 2/3;
    case '8':  return 0.5;
    case '8r': return 1/3;
    case '16': return 0.25;
    default:   return 0;
  }
};