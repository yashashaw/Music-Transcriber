// src/pages/HomePage.tsx (Formerly App.tsx)
import { SheetMusic } from '../components/Canvas/SheetMusic';
import { useScoreStore } from '../store/scoreStore';
import '../App.css'; // Keep your styles
import { exportToPDF } from '../utils/exportPDF';
import { BpmControl } from '../components/Controls/BpmControl';
import { RecordButton } from '../components/Controls/RecordButton';
import { useMetronome } from '../hooks/useMetronome';
import { useAuthStore } from '../store/authStore'; // Import auth store

export function HomePage() {
  useMetronome();
  const clearScore = useScoreStore((state) => state.clearScore);
  const { logout, username } = useAuthStore();

  return (
    <div className="container">
      <header className="header flex justify-between items-center">
        <div>
            <h1>Music Transcriber</h1>
            <span className="text-sm text-gray-500">Welcome, {username}</span>
        </div>
        
        <div className="controls">
          <RecordButton />
          <BpmControl />
          
          <button 
            onClick={clearScore}
            className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
          >
            Clear Sheet
          </button>
          <button onClick={() => exportToPDF()} className="export-btn">
            Export PDF
          </button>
          
          {/* Logout Button */}
          <button onClick={logout} className="ml-4 text-sm text-gray-600 underline">
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <SheetMusic />
      </main>
    </div>
  );
}