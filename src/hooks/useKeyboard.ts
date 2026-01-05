import { useEffect, useState } from 'react';
import { KEYBOARD_MAP } from '../utils/drumMap';

export function useKeyboard() {
  const [keyboardNote, setKeyboardNote] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      //prevent spam typing (eg. "aaaaaa")
      if (event.repeat) return;

      //ignore typing in input and textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      //look up MIDI number
      const key = event.key.toLowerCase();
      const note = KEYBOARD_MAP[key];

      //if mapped, update state
      if (note) {
        setKeyboardNote(note);
        
        //clear it shortly after to allow re-triggering the same note
        setTimeout(() => setKeyboardNote(null), 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    //if exist the component, delete Event Listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return { keyboardNote };
}