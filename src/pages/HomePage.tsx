// src/pages/HomePage.tsx
import { useEffect } from 'react';
import { SheetMusic } from '../components/Canvas/SheetMusic';
import { useScoreStore } from '../store/scoreStore';
import '../App.css'; 
import { exportToPDF } from '../utils/exportPDF';
import { BpmControl } from '../components/Controls/BpmControl';
import { RecordButton } from '../components/Controls/RecordButton';
import { useMetronome } from '../hooks/useMetronome';
import { useAuthStore } from '../store/authStore';

export function HomePage() {
  useMetronome();
  
  // 1. Get actions from Store
  const { 
    clearScore, 
    saveRecording,        
    loadNotesFromBackend  
  } = useScoreStore();
  
  const { logout, username } = useAuthStore();

  // 2. AUTO-LOAD: Fetch data when logged in
  useEffect(() => {
    loadNotesFromBackend();
  }, [loadNotesFromBackend]);

  // 3. AUTO-SAVE & CLEANUP: Save to DB, Wipe Memory, then Logout
  const handleLogout = async () => {
    // A. Save current work to database
    await saveRecording(); 
    
    // B. Wipe local memory (so next user sees blank sheet)
    clearScore(); 
    
    // C. Sign out
    logout();
  };

  return (
    <div className="container">
      <header className="header">
        <div>
            <h1>Music Transcriber</h1>
            <span className="header-user">Welcome, {username}</span>
        </div>
        
        <div className="controls">
          <RecordButton />
          <BpmControl />
          
          <button 
            onClick={clearScore}
            className="btn-danger"
          >
            Clear Sheet
          </button>
          <button onClick={() => exportToPDF()} className="export-btn">
            Export PDF
          </button>
          
          <button onClick={handleLogout} className="btn-ghost">
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