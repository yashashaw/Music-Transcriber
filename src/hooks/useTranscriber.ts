import { useEffect, useRef } from 'react';
import { useScoreStore } from '../store/scoreStore';
import { classifyDuration } from '../utils/quantizer';
import { MIDI_TO_DRUM } from '../utils/drumMap';
import type { DrumType, NoteDuration } from '../types';
import { useInput } from './useInput';
import { saveNote } from '../api/api';

interface PendingHit {
  type: DrumType;
  time: number;
}

export function useTranscriber() {
  const { lastNote } = useInput();
  const addNote = useScoreStore((state) => state.addNote);
  const bpm = useScoreStore((state) => state.bpm);

  // State from your file
  const pendingBuffer = useRef<PendingHit[]>([]); // Array to hold chords
  const flushTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (lastNote === null) return;

    const drumType = MIDI_TO_DRUM[lastNote];
    if (!drumType) return;

    const now = performance.now();

    // 1. Clear the "End of Phrase" timeout
    if (flushTimeout.current) clearTimeout(flushTimeout.current);

    // 2. Sliding Window Logic
    if (pendingBuffer.current.length > 0) {
      // Calculate delta from the FIRST note in the pending group
      const delta = now - pendingBuffer.current[0].time;
      const duration = classifyDuration(delta, bpm);

      if (duration === 'chord') {
        // It's a chord! Add to the pile and don't draw anything yet.
        pendingBuffer.current.push({ type: drumType, time: now });
      } else {
        const noteData = {
          id: crypto.randomUUID(),
          types: pendingBuffer.current.map(h => h.type),
          duration: duration,
          isRest: false
        };

        addNote(noteData);

        saveNote(noteData)
          .catch(error => {
            console.error('Error saving note:', error);
          });

        // Start a NEW pile with the current hit
        pendingBuffer.current = [{ type: drumType, time: now }];
      }
    } else {
      // First hit ever (or after a flush)
      pendingBuffer.current = [{ type: drumType, time: now }];
    }

    // 3. Set Safety Flush (End of Phrase)
    flushTimeout.current = window.setTimeout(() => {
      if (pendingBuffer.current.length > 0) {
        const noteData = {
          id: crypto.randomUUID(),
          types: pendingBuffer.current.map(h => h.type),
          duration: '1' as NoteDuration,
          isRest: false
        };

        addNote(noteData);

        saveNote(noteData)
          .catch(error => {
            console.error('Error saving note:', error);
          });

        pendingBuffer.current = [];
      }
    }, 2000);

  }, [lastNote, bpm, addNote]);
}