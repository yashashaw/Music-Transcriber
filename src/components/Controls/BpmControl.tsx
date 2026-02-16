//bpmcontrol.tsx

import React from 'react';
import { useScoreStore } from '../../store/scoreStore';

export const BpmControl: React.FC = () => {
  const bpm = useScoreStore((state) => state.bpm);
  const setBpm = useScoreStore((state) => state.setBpm);
  
  const isMetronomeOn = useScoreStore((state) => state.isMetronomeOn);
  const toggleMetronome = useScoreStore((state) => state.toggleMetronome);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(Number(e.target.value));
  };

  return (
    <div className="bpm-control">
      <button
        onClick={toggleMetronome}
        className={`bpm-toggle ${isMetronomeOn ? 'bpm-toggle--active' : ''}`}
        title={isMetronomeOn ? "Stop Metronome" : "Start Metronome"}
      >
        {isMetronomeOn ? '◼' : '▶'}
      </button>

      <div className="bpm-slider-group">
        <label htmlFor="bpm-slider" className="bpm-label">
          {bpm} BPM
        </label>
        <input
          id="bpm-slider"
          type="range"
          min="40"
          max="220"
          step="1"
          value={bpm}
          onChange={handleChange}
          className="bpm-slider"
        />
      </div>
    </div>
  );
};
