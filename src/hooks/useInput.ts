import { useMidi } from './useMidi';
import { useKeyboard } from './useKeyboard';

//enables use for both MIDI and keyboard
export function useInput() {
  const { midiNote } = useMidi();
  const { keyboardNote } = useKeyboard();

  const lastNote = midiNote ?? keyboardNote;

  return { lastNote };
}