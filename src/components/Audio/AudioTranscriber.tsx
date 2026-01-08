import React, { useEffect, useState, useRef } from 'react';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// Define the shape of the data coming from Python
interface NoteEvent {
  note: string;
  type: 'ON' | 'OFF';
}

interface ServerResponse {
  events: NoteEvent[];
}

const AudioTranscriber: React.FC = () => {
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  
  // Refs need specific types for WebSocket and AudioContext
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startListening = async () => {
    // 1. Initialize WebSocket
    socketRef.current = new WebSocket('ws://localhost:8000/ws/audio');

    socketRef.current.onopen = () => {
      console.log("WebSocket Connected");
      setIsListening(true);
    };

    socketRef.current.onmessage = (event: MessageEvent) => {
      try {
        const data: ServerResponse = JSON.parse(event.data);
        // Safely update state with new notes
        setNotes((prev) => [...prev, ...data.events]);
      } catch (error) {
        console.error("Failed to parse server message:", event.data);
        console.error("Error:", error)
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    // 2. Initialize Audio Context
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Handle cross-browser compatibility
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;

      // Ensure context is running (sometimes browsers suspend it)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Add the AudioWorklet module
      // Note: This path is relative to the PUBLIC folder
      await ctx.audioWorklet.addModule('/audioProcessor.js');

      // Create Nodes
      const source = ctx.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(ctx, 'audio-processor');

      // 3. Bridge Audio -> WebSocket
      processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          // Send the raw buffer to Python
          socketRef.current.send(event.data);
        }
      };

      // Connect graph
      source.connect(processor);
      // Connect to destination to prevent garbage collection (even if we don't hear it)
      processor.connect(ctx.destination); 

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or error occurred.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Real-time AI Transcription</h2>
      
      <div style={{ marginBottom: '20px' }}>
        {!isListening ? (
          <button 
            onClick={startListening}
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
          >
            Start Mic
          </button>
        ) : (
          <button 
            onClick={stopListening}
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#ffcccc' }}
          >
            Stop Mic
          </button>
        )}
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '100px', width: '300px' }}>
        <strong>Detected Notes:</strong>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {notes.slice(-10).map((n, i) => (
            <li key={i} style={{ color: n.type === 'ON' ? 'green' : 'red' }}>
              {n.type}: <b>{n.note}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AudioTranscriber;