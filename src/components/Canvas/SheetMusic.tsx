import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, Voice, Formatter } from 'vexflow';
import { useScoreStore, formatToVexKey } from '../../store/scoreStore';
import { convertToVexNotes } from '../../utils/VexMap';
import { quantizeDuration } from '../../utils/musicMath'; // Keep quantize, but we will count beats locally
import type { RenderedNote } from '../../types';

const MIN_STAVE_WIDTH = 250;
const SYSTEM_HEIGHT = 150;
const START_X = 10;
const START_Y = 20;
const BEATS_PER_MEASURE = 4;
const MEASURE_BATCH_SIZE = 4;
const NOTE_PADDING = 10; // Reduced padding so we rely on formatter

// Helper: Calculate exact beat value for measure grouping
// 'q' = 1, 'h' = 2, '8' = 0.5, etc.
const getNoteDuration = (durationString: string): number => {
  const base = durationString.replace(/[rd]/g, '');
  let value = 0;
  
  switch (base) {
    case 'w': value = 4; break;
    case 'h': value = 2; break;
    case 'q': value = 1; break;
    case '8': value = 0.5; break;
    case '16': value = 0.25; break;
    case '32': value = 0.125; break;
    default: value = 0;
  }

  // Handle dots (multiply by 1.5)
  if (durationString.includes('d')) {
    value *= 1.5;
  }

  return value;
};

export const SheetMusic: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  const { notes, activeNotes, bpm, loadNotesFromBackend, forceRenderTick } = useScoreStore();

  useEffect(() => {
    loadNotesFromBackend();
  }, [loadNotesFromBackend]);

  useEffect(() => {
    if (activeNotes.size === 0) return;
    const interval = setInterval(() => forceRenderTick(), 100);
    return () => clearInterval(interval);
  }, [activeNotes.size, forceRenderTick]);

  useEffect(() => {
    if (!rendererRef.current || !scrollContainerRef.current) return;

    // --- PREPARE DATA ---
    const allNotesToRender = [...notes];
    const now = Date.now() / 1000;

    activeNotes.forEach((data) => {
      const currentDurationSec = now - data.startTime;
      const liveDuration = quantizeDuration(currentDurationSec, bpm);
      
      allNotesToRender.push({
        id: `temp-${data.midi}`,
        keys: [formatToVexKey(data.noteName)],
        duration: liveDuration,
        isRest: false,
        color: "#ff0000"
      });
    });

    // --- RENDER ---
    rendererRef.current.innerHTML = ''; // Clear previous render
    
    // 1. Calculate Measures (Strict Grouping)
    const measures: RenderedNote[][] = [];
    let currentMeasure: RenderedNote[] = [];
    let currentBeats = 0;

    allNotesToRender.forEach((note) => {
      const val = getNoteDuration(note.duration);
      
      // Safety Check: Use 0.01 epsilon for float comparison errors
      // If adding this note pushes us over 4.01 beats, start a new measure
      if (currentBeats + val > BEATS_PER_MEASURE + 0.01) {
        measures.push(currentMeasure);
        currentMeasure = [];
        currentBeats = 0;
      }
      
      currentMeasure.push(note);
      currentBeats += val;
    });
    // Push the last partial measure
    if (currentMeasure.length > 0) measures.push(currentMeasure);

    // 2. Setup Renderer
    const filledCount = measures.length;
    const totalStaves = Math.ceil(Math.max(filledCount, 1) / MEASURE_BATCH_SIZE) * MEASURE_BATCH_SIZE;
    
    const containerWidth = Math.max(800, scrollContainerRef.current.clientWidth - 40);
    const renderer = new Renderer(rendererRef.current, Renderer.Backends.SVG);
    const context = renderer.getContext();
    
    let x = START_X;
    let y = START_Y;

    // 3. Render Loop
    for (let i = 0; i < totalStaves; i++) {
      const measureNotes = measures[i];
      let measureWidth = MIN_STAVE_WIDTH;
      let voice: Voice | null = null;
      let formatter: Formatter | null = null;

      // Calculate width requirement based on notes
      if (measureNotes && measureNotes.length > 0) {
        const vexNotes = convertToVexNotes(measureNotes);
        voice = new Voice({ numBeats: BEATS_PER_MEASURE, beatValue: 4 });
        
        // STRICT MODE: Setting this to true helps debug, but false is safer for live rendering
        // We set it to false so it doesn't crash, but our Grouping Logic above ensures we don't overflow.
        voice.setStrict(false); 
        voice.addTickables(vexNotes);

        formatter = new Formatter().joinVoices([voice]);
        const minRequiredWidth = formatter.preCalculateMinTotalWidth([voice]);
        measureWidth = Math.max(MIN_STAVE_WIDTH, minRequiredWidth + NOTE_PADDING);
      }

      // Wrap to new line if needed
      if (x + measureWidth > containerWidth) {
        x = START_X;
        y += SYSTEM_HEIGHT;
      }

      // Draw Stave
      const stave = new Stave(x, y, measureWidth);
      if (i === 0 || x === START_X) {
        stave.addClef("treble"); 
        if (i === 0) stave.addTimeSignature("4/4");
      }
      stave.setContext(context).draw();

      // Format and Draw Voice
      if (voice && formatter) {
        // Critical Fix: Calculate available space inside the stave (excluding clefs/keys)
        // so notes don't hit the right barline.
        const startX = stave.getNoteStartX();
        const endX = stave.getNoteEndX();
        const availableWidth = endX - startX - 10; // 10px buffer

        if (availableWidth > 0) {
            formatter.format([voice], availableWidth);
            voice.draw(context, stave);
        }
      }

      x += measureWidth;
    }

    const finalHeight = y + SYSTEM_HEIGHT;
    rendererRef.current.style.height = `${finalHeight}px`;
    renderer.resize(containerWidth, finalHeight);

    if (activeNotes.size > 0 || notes.length > 0) {
        bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

  }, [notes, activeNotes, bpm]);

  return (
    <div
      ref={scrollContainerRef}
      className="p-4 bg-white border rounded shadow-md overflow-y-auto relative"
      style={{ height: '400px', width: '100%' }}
    >
      <div ref={rendererRef} />
      <div ref={bottomAnchorRef} style={{ height: 1 }} />
    </div>
  );
};