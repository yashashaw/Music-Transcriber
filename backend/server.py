# server.py
import sys
import time
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from basic_pitch.inference import Model, ICASSP_2022_MODEL_PATH

# --- CONFIGURATION ---
SAMPLE_RATE = 22050
WINDOW_LENGTH = 43844  # ~2 seconds context
# NOTE: We don't define HOP_SIZE here because we just process whatever the frontend sends us

# Sensitivity (Your settings)
NOTE_THRESHOLD = 0.4
ONSET_THRESHOLD = 0.5
MIN_VOLUME_THRESHOLD = 0.01

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

def midi_to_note_name(midi_number):
    octave = (midi_number // 12) - 1
    note_index = midi_number % 12
    return f"{NOTE_NAMES[note_index]}{octave}"

# Load Model ONCE when server starts
print("Loading Model...")
model = Model(ICASSP_2022_MODEL_PATH)
print("Model Loaded.")

app = FastAPI()

@app.websocket("/ws/audio")
async def audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client Connected")

    # --- STATE TRACKING (Per User) ---
    # Initialize buffer with silence
    audio_buffer = np.zeros((1, WINDOW_LENGTH, 1), dtype=np.float32)
    active_notes = {}
    start_time_ref = time.time()

    try:
        while True:
            # 1. RECEIVE RAW BYTES
            # Frontend sends Float32Array bytes
            data_bytes = await websocket.receive_bytes()
            
            # Convert bytes -> Numpy Array
            new_data = np.frombuffer(data_bytes, dtype=np.float32)
            
            # --- RESAMPLING HACK ---
            # Browsers are usually 44.1kHz or 48kHz. Model wants 22.05kHz.
            # We take every 2nd sample to roughly downsample (44k -> 22k)
            # Ideally, use scipy.signal.resample, but this is faster for real-time.
            new_data = new_data[::2] 

            # Reshape to match model expectation (Frames, 1)
            new_data = new_data.reshape(-1, 1)
            frames = len(new_data)

            # 2. VOLUME GATE
            volume = np.sqrt(np.mean(new_data**2))
            
            # Update Buffer (Roll old data out, put new data in)
            audio_buffer = np.roll(audio_buffer, -frames, axis=1)
            audio_buffer[0, -frames:, :] = new_data

            if volume < MIN_VOLUME_THRESHOLD:
                 # Optional: Send "silence" event if needed
                continue

            # 3. RUN AI INFERENCE
            output = model.predict(audio_buffer)
            note_probs = output['note']
            onset_probs = output['onset']

            if note_probs is None: continue

            # Focus on the "new" audio we just received (last 5 frames)
            focus_window = 5
            current_notes_max = np.max(note_probs[0, -focus_window:, :], axis=0)
            current_onsets_max = np.max(onset_probs[0, -focus_window:, :], axis=0)

            # 4. PROCESS NOTES
            detected_notes = [] # List to send back to frontend

            detected_this_frame = set()
            for i in range(88):
                midi_num = i + 21
                prob_note = current_notes_max[i]
                prob_onset = current_onsets_max[i]

                is_sustaining = prob_note > NOTE_THRESHOLD
                is_attack = prob_onset > ONSET_THRESHOLD

                if is_sustaining:
                    detected_this_frame.add(midi_num)
                    note_name = midi_to_note_name(midi_num)

                    # LOGIC: Attack (New Note)
                    if midi_num not in active_notes or (midi_num in active_notes and is_attack):
                         # Debounce re-triggers (only allow re-trigger after 100ms)
                        if midi_num in active_notes and (time.time() - active_notes[midi_num] < 0.1):
                            continue

                        active_notes[midi_num] = time.time()
                        detected_notes.append({"note": note_name, "type": "ON"})
                        print(f"Note ON: {note_name}")

            # LOGIC: Note Off
            active_ids = list(active_notes.keys())
            for midi_num in active_ids:
                if midi_num not in detected_this_frame:
                    note_name = midi_to_note_name(midi_num)
                    detected_notes.append({"note": note_name, "type": "OFF"})
                    print(f"Note OFF: {note_name}")
                    del active_notes[midi_num]

            # 5. SEND RESULT BACK
            if detected_notes:
                await websocket.send_json({"events": detected_notes})

    except WebSocketDisconnect:
        print("Client Disconnected")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)