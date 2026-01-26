import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, Voice, Formatter } from 'vexflow';
import { useScoreStore } from '../../store/scoreStore';
import { convertToVexNotes } from '../../utils/VexMap';
import type { RenderedNote, NoteDuration } from '../../types';

const MIN_STAVE_WIDTH = 250;
const SYSTEM_HEIGHT = 150;
const START_X = 10;
const START_Y = 20;
const BEATS_PER_MEASURE = 4;
const MEASURE_BATCH_SIZE = 4;
const NOTE_PADDING = 60;

// Helper: How much "space" does a note take in a 4/4 bar?
const getDurationValue = (duration: string): number => {
  switch (duration) {
    case 'w': return 4;
    case 'h': return 2;
    case 'q': return 1;
    case '8': return 0.5;
    case '16': return 0.25;
    default: return 0;
  }
};

const quantizeDuration = (seconds: number, bpm: number): NoteDuration => {
  const secondsPerBeat = 60 / bpm;
  const numBeats = seconds / secondsPerBeat;
  if (numBeats < 0.25) return '16'; 
  if (numBeats < 0.75) return '8';
  if (numBeats < 1.5)  return 'q'; 
  if (numBeats < 3.0)  return 'h'; 
  return 'w';                      
};

const formatToVexKey = (note: string) => {
  if (!note) return 'c/5';
  return `${note.charAt(0).toLowerCase()}/${note.slice(1)}`;
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

    // Inject temporary "Red" notes
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
    const currentHeight = rendererRef.current.clientHeight;
    rendererRef.current.style.height = `${currentHeight}px`;
    rendererRef.current.innerHTML = '';

    const containerWidth = Math.max(800, scrollContainerRef.current.clientWidth - 40);
    const renderer = new Renderer(rendererRef.current, Renderer.Backends.SVG);
    const context = renderer.getContext();

    const measures: RenderedNote[][] = [];
    let currentMeasure: RenderedNote[] = [];
    let currentBeats = 0;

    allNotesToRender.forEach((note) => {
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

    const filledCount = measures.length;
    const totalStaves = Math.ceil(Math.max(filledCount, 1) / MEASURE_BATCH_SIZE) * MEASURE_BATCH_SIZE;

    let x = START_X;
    let y = START_Y;

    for (let i = 0; i < totalStaves; i++) {
      const measureNotes = measures[i];
      let measureWidth = MIN_STAVE_WIDTH;
      let voice: Voice | null = null;
      let formatter: Formatter | null = null;

      if (measureNotes && measureNotes.length > 0) {
        const vexNotes = convertToVexNotes(measureNotes);
        voice = new Voice({ numBeats: BEATS_PER_MEASURE, beatValue: 4 });
        voice.setStrict(false);
        voice.addTickables(vexNotes);

        formatter = new Formatter().joinVoices([voice]);
        const minRequiredWidth = formatter.preCalculateMinTotalWidth([voice]);
        measureWidth = Math.max(MIN_STAVE_WIDTH, minRequiredWidth + NOTE_PADDING);
      }

      if (x + measureWidth > containerWidth) {
        x = START_X;
        y += SYSTEM_HEIGHT;
      }

      const stave = new Stave(x, y, measureWidth);
      if (i === 0 || x === START_X) {
        stave.addClef("treble"); 
        if (i === 0) stave.addTimeSignature("4/4");
      }
      
      stave.setContext(context).draw();

      if (voice && formatter) {
        formatter.format([voice], measureWidth - NOTE_PADDING);
        voice.draw(context, stave);
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