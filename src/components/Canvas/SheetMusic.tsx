import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, Voice, Formatter } from 'vexflow';
import { useScoreStore } from '../../store/scoreStore';
import { convertToVexNotes } from '../../utils/VexMap';
import type { RenderedNote } from '../../types';

const MIN_STAVE_WIDTH = 250; // Mimumum measure width
const SYSTEM_HEIGHT = 150;
const START_X = 10;
const START_Y = 20;
const BEATS_PER_MEASURE = 4;
const MEASURE_BATCH_SIZE = 4;
const NOTE_PADDING = 60; // The breathing room at the end of a measure

export const SheetMusic: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // 1. Grab notes AND the load action from the store
  const { notes, loadNotesFromBackend } = useScoreStore();

  const getDurationValue = (duration: string): number => {
    switch (duration.replace(/\W/g, '')) {
      case '1': return 4;
      case '2': return 2;
      case '4': return 1;
      case '8': return 0.5;
      case '16': return 0.25;
      case '32': return 0.125;
      default: return 0;
    }
  };

  // 2. Trigger reload on mount
  useEffect(() => {
    loadNotesFromBackend();
  }, [loadNotesFromBackend]);

  // 3. VexFlow Logic
  useEffect(() => {
    if (!rendererRef.current || !scrollContainerRef.current) return;

    // Lock height to prevent jumpiness during re-render
    const currentHeight = rendererRef.current.clientHeight;
    rendererRef.current.style.height = `${currentHeight}px`;

    // Clear Canvas
    rendererRef.current.innerHTML = '';

    // Calculate Container Width
    const containerWidth = Math.max(800, scrollContainerRef.current.clientWidth - 40);
    const renderer = new Renderer(rendererRef.current, Renderer.Backends.SVG);
    const context = renderer.getContext();

    // Group Notes into Measures
    const measures: RenderedNote[][] = [];
    let currentMeasure: RenderedNote[] = [];
    let currentBeats = 0;

    notes.forEach((note) => {
      const val = getDurationValue(note.duration);
      if (currentBeats + val > BEATS_PER_MEASURE) {
        measures.push(currentMeasure);
        currentMeasure = [];
        currentBeats = 0;
      }
      currentMeasure.push(note);
      currentBeats += val;
    });
    if (currentMeasure.length > 0) measures.push(currentMeasure);

    // Determine Total Staves (filling out the last batch if needed)
    const filledCount = measures.length;
    const totalStaves = Math.ceil(Math.max(filledCount, 1) / MEASURE_BATCH_SIZE) * MEASURE_BATCH_SIZE;

    // --- DRAW LOOP ---
    let x = START_X;
    let y = START_Y;

    for (let i = 0; i < totalStaves; i++) {
      const measureNotes = measures[i];
      
      // 1. Calculate Required Width
      // We assume the minimum, then check if notes push it wider
      let measureWidth = MIN_STAVE_WIDTH;
      let voice: Voice | null = null;
      let formatter: Formatter | null = null;

      // Only calculate dynamic width if there are actually notes
      if (measureNotes && measureNotes.length > 0) {
        const vexNotes = convertToVexNotes(measureNotes);
        voice = new Voice({ numBeats: BEATS_PER_MEASURE, beatValue: 4 });
        voice.setStrict(false);
        voice.addTickables(vexNotes);

        // Join voice to calculate width
        formatter = new Formatter().joinVoices([voice]);
        
        // Ask VexFlow: "How much space do these notes strictly need?"
        const minRequiredWidth = formatter.preCalculateMinTotalWidth([voice]);
        
        // Final width is the MAX of (Default vs Required + Padding)
        measureWidth = Math.max(MIN_STAVE_WIDTH, minRequiredWidth + NOTE_PADDING);
      }

      // 2. Check for Line Wrap
      // If adding this measure exceeds container width, wrap to next line
      if (x + measureWidth > containerWidth) {
        x = START_X;
        y += SYSTEM_HEIGHT;
      }

      // 3. Create and Draw Stave
      const stave = new Stave(x, y, measureWidth);

      // Add clef/time signature at the start of a line (or first measure)
      if (i === 0 || x === START_X) {
        stave.addClef("percussion");
        if (i === 0) stave.addTimeSignature("4/4");
      }
      
      stave.setContext(context).draw();

      // 4. Draw Notes (if they exist)
      if (voice && formatter) {
        // Use the calculated width minus padding for formatting
        // This ensures the notes stop BEFORE they hit the barline
        formatter.format([voice], measureWidth - NOTE_PADDING);
        voice.draw(context, stave);
      }

      // 5. Advance X Position
      x += measureWidth;
    }

    // Final Resize
    const finalHeight = y + SYSTEM_HEIGHT;
    rendererRef.current.style.height = `${finalHeight}px`;
    renderer.resize(containerWidth, finalHeight);

    // Scroll to bottom
    bottomAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

  }, [notes]);

  return (
    <div
      ref={scrollContainerRef}
      className="p-4 bg-white border rounded shadow-md overflow-y-auto relative"
      style={{ height: '400px', width: '100%' }}
    >
      <div ref={rendererRef} />

      <div className="text-center py-8 text-gray-500">
        <small>
          Play your electronic drums. The system will detect notes,
          calculate duration, and transcribe chords automatically.
        </small>
      </div>

      <div ref={bottomAnchorRef} style={{ height: 1 }} />
    </div>
  );
};