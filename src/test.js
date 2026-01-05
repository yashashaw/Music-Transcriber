//file was utilized to develop logic algorithm for program

import readline from 'readline'; //for keyboard reading
import { performance } from 'perf_hooks'; // Node.js import for more accurate time

//Constants
const BPM = 120;
const MS_PER_BEAT = 60000 / BPM;

const keyMap = {
    'a': 'Kick',
    's': 'Snare',
    'd': 'Hi-Hat Closed',
    'f': 'Crash'
};

//State
let pendingNote = null;
let flushTimeout = null;

//Takes in the change in time between notes and returns a string stating the note classification
function classifyDuration(deltaMs) {
    const beats = deltaMs / MS_PER_BEAT;

    if (beats >= 3.5) return "Whole Note (1/1)";
    if (beats >= 1.5) return "Half Note (1/2)";
    if (beats >= 0.75) return "Quarter Note (1/4)";
    if (beats >= 0.35) return "Eighth Note (1/8)";
    if (beats >= 0.18) return "Sixteenth Note (1/16)";
    return "Chord";
}

//keyboard setup
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

console.log("-----------------------------------------------------");
console.log("🥁 DRUM TRANSCRIBER (ES MODULE MODE)");
console.log("Press 'a' (Kick) or 's' (Snare). Press 'q' to quit.");
console.log("-----------------------------------------------------");

//event listener
process.stdin.on('keypress', (str, key) => {
    //exit handler
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        process.exit();
    }

    const drumType = keyMap[key.name]; //searches for key in the object
    if (!drumType) return;

    // --- LOGIC ---
    const now = performance.now(); //gets specific time at hit

    //Immediate Feedback
    console.log(`\n🥁 HIT: [${drumType}] at ${Math.round(now)}ms`);

    // Clear Timeout
    if (flushTimeout) clearTimeout(flushTimeout); //flushing happens at 2000 ms

    //Sliding Window Calculation
    if (pendingNote) {
        const delta = now - pendingNote[0].time; //change in time between two notes in ms
        const durationName = classifyDuration(delta); //inputs the delta, returns a string

        if (durationName === "Chord") {
            pendingNote.push({ type: drumType, time: now });
        }
        else {
            // 1. Create a readable string of all note types in the buffer
            const allNotes = pendingNote.map(n => n.type).join(" + ");

            // 2. Green Text for Success
            console.log(`\x1b[32m✅ COMMITTED: Previous ${allNotes} was a ${durationName} (${Math.round(delta)}ms)\x1b[0m`);

            // Shift Buffer
            pendingNote = [{ type: drumType, time: now }];
        }

    } else {
        console.log(`ℹ️ First hit. Waiting for next hit...`);

        //Shift Buffer
        pendingNote = [{ type: drumType, time: now }];
    }

    //Set Safety Flush
    flushTimeout = setTimeout(() => {
        if (pendingNote) {
            const finalNotes = pendingNote.map(n => n.type).join(" + ");
            console.log(`\x1b[33m🛑 END OF PHRASE: Flushing final [${finalNotes}] as Whole Note\x1b[0m`);
            pendingNote = null;
        }
    }, 2000); //2000 ms
});