import asyncio
import subprocess
import os
import uuid
import sys
import traceback

# helper function that takes an array of note objects/dicts and parses them to a string
def edit_notes(notes):
    note_map = ""
    for note in notes:
        if isinstance(note, dict):
            types = note['types']
            duration = note['duration']
        else:
            types = note.types
            duration = note.duration
        
        if len(types) > 1:
            note_map += f" <{' '.join(types)}>{duration}" 
        else:
            note_map += f" {types[0]}{duration}"
    return note_map.strip()

async def convert_to_lilypond(notes):
    unique_id = str(uuid.uuid4())
    base_filename = f"temp_{unique_id}"
    ly_filename = f"{base_filename}.ly"
    pdf_filename = f"{base_filename}.pdf"

    new_notes = edit_notes(notes)
    
    # Use drum mode for percussion
    lilypond_content = f"""
\\version "2.24.0"
\\score {{
  \\new DrumStaff \\drummode {{
    \\set DrumStaff.drumStyleTable = #drums-style
    {new_notes}
  }}
  \\layout {{ }}
}}
"""

    try:
        # Write the file
        with open(ly_filename, "w") as f:
            f.write(lilypond_content)

        # --- THE SMART PART: CHOOSE EXECUTION METHOD ---
        
        if sys.platform == "win32":
            # WINDOWS (Development): run synchronously to avoid NotImplementedError
            process = await asyncio.to_thread(
                subprocess.run,
                ["lilypond", "--output", base_filename, ly_filename],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False
            )
            # Normalize the result to look like the async version
            stdout = process.stdout
            stderr = process.stderr
            returncode = process.returncode
            
        else:
            # LINUX (Production): Run fully async for max performance
            process = await asyncio.create_subprocess_exec(
                "lilypond",
                "--output", base_filename,
                ly_filename,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
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
        # Cleanup temp files
        if os.path.exists(ly_filename):
            os.remove(ly_filename)
        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)