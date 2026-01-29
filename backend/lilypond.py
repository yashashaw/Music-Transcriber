import asyncio
import subprocess
import os
import uuid
import sys
import traceback

def parse_vexflow_duration(duration_str):
    """
    Converts VexFlow duration codes (w, h, q, 8, 16) to LilyPond numbers (1, 2, 4, 8, 16).
    Handles dots (e.g., 'qd' -> '4.').
    """
    # Remove 'r' (rest) and 'd' (dot) for the base calculation
    clean_dur = duration_str.lower().replace('r', '').replace('d', '')
    
    mapping = {
        'w': '1',
        'h': '2',
        'q': '4',
        '8': '8',
        '16': '16',
        '32': '32'
    }
    
    lily_dur = mapping.get(clean_dur, '4') # Default to quarter if unknown
    
    # Add dot back if original string had 'd'
    if 'd' in duration_str.lower():
        lily_dur += "."
        
    return lily_dur

def parse_vexflow_pitch(vex_key):
    """
    Converts VexFlow key "c#/4" to LilyPond "cis'".
    Handles B vs Bb correctly.
    """
    if '/' not in vex_key:
        return "c'" # Fallback

    note_part, octave_part = vex_key.split('/')
    try:
        octave = int(octave_part)
    except ValueError:
        octave = 4

    # --- PITCH CORRECTION ---
    raw_pitch = note_part.lower()
    accidental = ""
    base_note = raw_pitch[0] # first letter is always the note (a-g)

    # Check for accidentals in the string
    if '#' in raw_pitch:
        accidental = "is"  # Sharp
    elif 'b' in raw_pitch and len(raw_pitch) > 1:
        # Only treat 'b' as flat if it's NOT the note name itself
        # e.g. "bb" (B-flat) or "eb" (E-flat). 
        # "b" alone is B-natural.
        accidental = "es"  # Flat

    # LilyPond pitch = base + accidental (e.g., "cis", "bes", "b")
    # Note: In standard LilyPond, B-natural is 'b', B-flat is 'bes'
    final_pitch_name = f"{base_note}{accidental}"
    
    # --- OCTAVE CORRECTION ---
    # LilyPond Absolute Octaves: c = C3, c' = C4 (Middle C), c'' = C5
    suffix = ""
    if octave == 4:
        suffix = "'"
    elif octave == 5:
        suffix = "''"
    elif octave == 6:
        suffix = "'''"
    elif octave == 3:
        suffix = ""
    elif octave == 2:
        suffix = ","
    elif octave == 1:
        suffix = ",,"

    return f"{final_pitch_name}{suffix}"

def edit_notes(notes):
    """
    Parses list of Note objects into a LilyPond string.
    """
    lily_string = ""
    
    for note in notes:
        # Determine if it's a dict (raw json) or Pydantic model
        if isinstance(note, dict):
            keys = note.get('keys', [])
            duration = note.get('duration', 'q')
            is_rest = note.get('isRest', False)
        else:
            keys = note.keys
            duration = note.duration
            is_rest = note.isRest

        lily_dur = parse_vexflow_duration(duration)

        # STRICT REST CHECK: Only render rest if isRest is explicitly True.
        # This ignores 'qr' or '8r' codes in duration if the note is actually audible.
        if is_rest:
            lily_string += f" r{lily_dur}"
        elif len(keys) > 0:
            if len(keys) > 1:
                # CHORD
                pitches = [parse_vexflow_pitch(k) for k in keys]
                chord_str = " ".join(pitches)
                lily_string += f" <{chord_str}>{lily_dur}"
            else:
                # SINGLE NOTE
                pitch = parse_vexflow_pitch(keys[0])
                lily_string += f" {pitch}{lily_dur}"
            
    return lily_string.strip()

async def convert_to_lilypond(notes):
    unique_id = str(uuid.uuid4())
    base_filename = f"temp_{unique_id}"
    ly_filename = f"{base_filename}.ly"
    pdf_filename = f"{base_filename}.pdf"

    music_notes = edit_notes(notes)
    
    lilypond_content = f"""
\\version "2.24.0"
\\score {{
  \\new Staff {{
    \\clef treble
    \\time 4/4
    \\key c \\major
    \\absolute {{
        {music_notes}
    }}
  }}
  \\layout {{ }}
}}
"""

    try:
        with open(ly_filename, "w") as f:
            f.write(lilypond_content)

        cmd = ["lilypond", "--output", base_filename, ly_filename]
        
        if sys.platform == "win32":
            process = await asyncio.to_thread(
                subprocess.run, cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
            )
            returncode = process.returncode
            stderr = process.stderr
        else:
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            returncode = process.returncode

        if returncode != 0:
            error_msg = stderr.decode()
            print(f"LILYPOND ERROR:\n{error_msg}")
            return None, f"LilyPond Error: {error_msg}"

        if os.path.exists(pdf_filename):
            with open(pdf_filename, "rb") as f:
                pdf_bytes = f.read()
            return pdf_bytes, None
        else:
            return None, "PDF created but file not found."

    except Exception:
        full_error = traceback.format_exc()
        print(f"CRITICAL ERROR:\n{full_error}")
        return None, f"Server Error: {full_error}"

    finally:
        if os.path.exists(ly_filename):
            os.remove(ly_filename)
        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)
        if os.path.exists(f"{base_filename}.log"):
            os.remove(f"{base_filename}.log")