import { SheetMusic } from './components/Canvas/SheetMusic';
import { useTranscriber } from './hooks/useTranscriber';
import { useScoreStore } from './store/scoreStore';
import './App.css';
import { exportToPDF } from './utils/exportPDF';
import { BpmControl } from './components/Controls/BpmControl';
import { useMetronome } from './hooks/useMetronome';

// 1. Import your new component
import AudioTranscriber from './components/Audio/AudioTranscriber'; 

function App() {
  // Activate the Logic Engine (Keyboard listeners)
  useTranscriber();
  useMetronome();

  // Get the clear function
  const clearScore = useScoreStore((state) => state.clearScore);

  return (
    <div className="container">
      <header className="header">
        <h1>Drum Transcriber</h1>
        <div className="controls">
          <BpmControl />
          
          <button 
            onClick={clearScore}
            className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
          >
            Clear Sheet
          </button>
          <button
            onClick={() => exportToPDF()}
            className="export-btn"
          >
            Export PDF
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* 2. Place the AudioTranscriber here */}
        <div style={{ marginBottom: '20px' }}>
            <AudioTranscriber />
        </div>

        <SheetMusic />
      </main>
    </div>
  );
}

export default App;