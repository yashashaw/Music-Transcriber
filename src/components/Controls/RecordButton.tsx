import React, { useEffect, useState, useRef } from 'react';
import { useScoreStore } from '../../store/scoreStore';

interface NoteEvent {
  type: 'note_on' | 'note_off' | 're_trigger' | 'volume' | 'silence_reset';
  note?: string;
  midi?: number;
  event?: string;
  value?: number;
  duration?: number;   
  start_time?: number;
}

export const RecordButton: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const { handleNoteOn, handleNoteOff } = useScoreStore(); 

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const startStreaming = async () => {
    socketRef.current = new WebSocket('ws://localhost:8000');

    socketRef.current.onopen = async () => {
      console.log("WebSocket connected. Starting Audio...");
      setIsRecording(true);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
            channelCount: 1
          } 
        });

        const audioContext = new window.AudioContext({ sampleRate: 22050 });
        audioContextRef.current = audioContext;
        await audioContext.audioWorklet.addModule('/audioProcessor.js');

        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event) => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(event.data);
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

      } catch (err) {
        console.error("Audio setup failed:", err);
        socketRef.current?.close();
        setIsRecording(false);
      }
    };

    socketRef.current.onmessage = (event) => {
      try {
        const data: NoteEvent = JSON.parse(event.data);
        handleServerEvent(data);
      } catch (e) {
        console.error("JSON Parse Error", e);
      }
    };

    socketRef.current.onclose = () => {
      setIsRecording(false);
      stopAudio();
    };
  };

  const stopAudio = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsRecording(false);
  };

  const handleServerEvent = (data: NoteEvent) => {
    if (data.type === 'note_on' && data.midi !== undefined && data.note) {
        console.log(`🎵 Note ON: ${data.note} | Start: ${data.start_time?.toFixed(3)}s`);
        handleNoteOn(data.midi, data.note);
    }
    else if (data.type === 'note_off' && data.midi !== undefined) {
        console.log(`🛑 Note OFF: ${data.note} | Start: ${data.start_time?.toFixed(3)}s | Duration: ${data.duration?.toFixed(3)}s`);
        handleNoteOff(data.midi);
    }
    else if (data.type === 'silence_reset') {
        console.log("Silence Reset");
    }
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  return (
    <button
      onClick={isRecording ? stopAudio : startStreaming}
      className={`px-3 py-1 text-sm border rounded transition-colors ${
        isRecording 
          ? 'bg-red-500 text-white border-red-600 hover:bg-red-600' 
          : 'text-blue-600 border-blue-200 bg-white hover:bg-blue-50'
      }`}
    >
      {isRecording ? 'Stop Recording' : 'Record Audio'}
    </button>
  );
};