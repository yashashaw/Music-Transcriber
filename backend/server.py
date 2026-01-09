import asyncio
import websockets
import json
import time
import numpy as np
from basic_pitch.inference import Model, ICASSP_2022_MODEL_PATH

# --- CONFIGURATION ---
SAMPLE_RATE = 22050
HOP_SIZE = 2048         
WINDOW_LENGTH = 43844   

# Sensitivity
NOTE_THRESHOLD = 0.4
ONSET_THRESHOLD = 0.5
MIN_VOLUME = 0.001

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

print("Loading Basic Pitch Model...")
model = Model(ICASSP_2022_MODEL_PATH)
print("Model Loaded. Ready.")

def midi_to_note_name(midi_number):
    octave = (midi_number // 12) - 1
    note_index = midi_number % 12
    return f"{NOTE_NAMES[note_index]}{octave}"

async def audio_handler(websocket):
    print(f"Client connected: {websocket.remote_address}")
    
    audio_buffer = np.zeros((1, WINDOW_LENGTH, 1), dtype=np.float32)
    input_accumulator = [] 
    active_notes = {} 
    
    try:
        async for message in websocket:
            try:
                chunk = np.frombuffer(message, dtype=np.float32)
            except Exception:
                continue
                
            if len(chunk) == 0: continue

            input_accumulator.extend(chunk)

            if len(input_accumulator) < HOP_SIZE:
                continue

            new_data = np.array(input_accumulator[:HOP_SIZE], dtype=np.float32)
            input_accumulator = input_accumulator[HOP_SIZE:]

            audio_buffer = np.roll(audio_buffer, -HOP_SIZE, axis=1)
            audio_buffer[0, -HOP_SIZE:, 0] = new_data

            # --- VOLUME GATE (FIXED) ---
            volume = float(np.sqrt(np.mean(new_data**2)))
            await websocket.send(json.dumps({"type": "volume", "value": volume}))
            
            if volume < MIN_VOLUME:
                if active_notes:
                    # FIX: Don't just delete notes! Close them gracefully first.
                    print("Silence detected - closing active notes...")
                    for midi_num, start_time in active_notes.items():
                        duration = time.time() - start_time
                        note_name = midi_to_note_name(midi_num)
                        
                        await websocket.send(json.dumps({
                            "type": "note_off", 
                            "note": note_name, 
                            "midi": midi_num,
                            "duration": duration  # <--- Ensures duration is sent on silence
                        }))
                    
                    active_notes = {}
                    await websocket.send(json.dumps({"type": "silence_reset"}))
                continue

            # --- RUN AI ---
            loop = asyncio.get_running_loop()
            output = await loop.run_in_executor(None, lambda: model.predict(audio_buffer))
            
            note_probs = output['note']
            onset_probs = output['onset']
            
            if note_probs is None: continue

            # --- NOTE DETECTION ---
            focus_window = 5
            current_notes_max = np.max(note_probs[0, -focus_window:, :], axis=0)
            current_onsets_max = np.max(onset_probs[0, -focus_window:, :], axis=0)
            
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
                    
                    if midi_num in active_notes and is_attack:
                        if (time.time() - active_notes[midi_num]) > 0.1:
                            # Re-trigger: Calculate duration of the PREVIOUS instance
                            old_duration = time.time() - active_notes[midi_num]
                            
                            active_notes[midi_num] = time.time() # Reset start time
                            
                            await websocket.send(json.dumps({
                                "type": "note_on", 
                                "note": note_name, 
                                "midi": midi_num, 
                                "event": "re_trigger",
                                "previous_duration": old_duration # Optional: Log prev note length
                            }))
                    
                    elif midi_num not in active_notes:
                        active_notes[midi_num] = time.time()
                        await websocket.send(json.dumps({
                            "type": "note_on", 
                            "note": note_name, 
                            "midi": midi_num, 
                            "event": "new_attack"
                        }))

            # --- HANDLE NATURAL NOTE OFFS ---
            for midi_num in list(active_notes.keys()):
                if midi_num not in detected_this_frame:
                    start_time = active_notes[midi_num]
                    duration = time.time() - start_time
                    note_name = midi_to_note_name(midi_num)
                    
                    del active_notes[midi_num]
                    
                    await websocket.send(json.dumps({
                        "type": "note_off", 
                        "note": note_name, 
                        "midi": midi_num,
                        "duration": duration 
                    }))

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {websocket.remote_address}")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    print("Server listening on 8000...")
    async with websockets.serve(audio_handler, "localhost", 8000):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())