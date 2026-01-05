import { useEffect, useRef } from 'react';
import { useScoreStore } from '../store/scoreStore';

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext: typeof AudioContext;
}

export function useMetronome() {
  const bpm = useScoreStore((state) => state.bpm);
  const isPlaying = useScoreStore((state) => state.isMetronomeOn);
  
  const beatsPerMeasure = 4; 

  const audioContext = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef<number>(0.0);
  const timerID = useRef<number | null>(null);
  
  // Track the current beat (0-indexed: 0, 1, 2, 3...)
  const currentBeat = useRef<number>(0);

  useEffect(() => {
    // Cleanup if playback stops
    if (!isPlaying) {
      if (timerID.current !== null) {
        window.clearTimeout(timerID.current);
      }
      return;
    }

    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec

    if (!audioContext.current) {
      const AudioContextClass = window.AudioContext || 
        (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
      audioContext.current = new AudioContextClass();
    }

    if (audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }

    // Reset nextNoteTime if starting fresh
    if (nextNoteTime.current < audioContext.current.currentTime) {
      nextNoteTime.current = audioContext.current.currentTime + 0.05;
      // Reset beat counter on start so the first click is always the Downbeat (Beat 1)
      currentBeat.current = 0; 
    }

    const playClick = (time: number, isAccent: boolean) => {
      if (!audioContext.current) return;

      const osc = audioContext.current.createOscillator();
      const envelope = audioContext.current.createGain();

      // Accent = Higher Pitch (1500Hz), Normal = Lower Pitch (1000Hz)
      osc.frequency.value = isAccent ? 1500 : 1000;
      
      // Force the gain to 1 at the start time (for loud clicks)
      envelope.gain.setValueAtTime(1, time);
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
     
      osc.connect(envelope);
      envelope.connect(audioContext.current.destination);

      osc.start(time);
      osc.stop(time + 0.05);
    };

    const scheduler = () => {
      if (!audioContext.current) return;

      while (nextNoteTime.current < audioContext.current.currentTime + scheduleAheadTime) {
        // Determine if this is the first beat of the measure
        const isAccent = currentBeat.current === 0;

        playClick(nextNoteTime.current, isAccent);
        
        // Advance time
        const secondsPerBeat = 60.0 / bpm;
        nextNoteTime.current += secondsPerBeat;

        // Advance beat counter
        currentBeat.current = (currentBeat.current + 1) % beatsPerMeasure;
      }

      timerID.current = window.setTimeout(scheduler, lookahead);
    };

    scheduler(); // Loop

    return () => {
      if (timerID.current !== null) {
        window.clearTimeout(timerID.current);
      }
    };
  }, [isPlaying, bpm, beatsPerMeasure]); 
}