import { useEffect, useState } from 'react';

export function useMidi() {
  const [midiNote, setMidiNote] = useState<number | null>(null);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      console.warn("Web MIDI API not supported in this browser.");
      return;
    }

    const onMIDIMessage = (event: MIDIMessageEvent) => {
      if (!event.data) return;

      const command = event.data[0];
      const note = event.data[1];
      const velocity = event.data[2];
      
      if ((command === 144 || command === 153) && velocity > 0) {
        setMidiNote(note);
        setTimeout(() => setMidiNote(null), 10);
      }
    };

    navigator.requestMIDIAccess().then((access) => {
      // 1. Attach to existing inputs
      for (const input of access.inputs.values()) {
        input.onmidimessage = onMIDIMessage;
      }
      
      // 2. Attach to new inputs (Hot-plugging)
      access.onstatechange = (e: Event) => {
        const connectionEvent = e as unknown as { port: MIDIPort };
        
        // We check if it is an Input, then we Force Cast it (as MIDIInput)
        if (connectionEvent.port.type === 'input' && connectionEvent.port.state === 'connected') {
           (connectionEvent.port as MIDIInput).onmidimessage = onMIDIMessage;
        }
      };
    });

  }, []);

  return { midiNote };
}