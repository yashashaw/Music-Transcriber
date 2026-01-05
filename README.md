# 🥁 MIDI Drum Transcriber

A full-stack application that listens to real-time MIDI input (electronic drums/keyboards) and automatically transcribes it into sheet music using VexFlow. The application features a React frontend for visualization and a Python/FastAPI backend for logic and persistence.

## 🚀 Features

* Real-time MIDI Transcription: Connect any MIDI device and see notes appear instantly.
* Smart Quantization: Automatically snaps messy playing to the nearest grid (1/8th, 1/16th notes).
* Sheet Music Rendering: Uses VexFlow to render professional standard drum notation.
* State Management: Powered by Zustand for high-performance React state handling.

## 🛠️ Tech Stack

* Frontend: React, TypeScript, VexFlow, Zustand
* Backend: Python 3.14, FastAPI, Uvicorn
* Tools: Vite, npm, pip

---

## 📦 Installation & Setup

Follow these steps to get the project running locally.

### 1. Clone the Repository
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   cd drum-transcriber

### 2. Backend Setup (Python API)
The backend handles data processing and runs on Port 5000.

1. Navigate to the backend folder:
   cd backend

2. Create and activate a virtual environment:
   (Windows)
   python -m venv .venv
   .\.venv\Scripts\Activate

   (Mac/Linux)
   python3 -m venv .venv
   source .venv/bin/activate

3. Install dependencies:
   pip install -r requirements.txt

4. Start the Server:
   python -m uvicorn main:app --reload --port 5000

   (You should see: Uvicorn running on http://127.0.0.1:5000)

---

### 3. Frontend Setup (React)
Open a new terminal (keep the backend running!) and navigate to the project root.

1. Install Node dependencies:
   npm install

2. Start the Development Server:
   npm run dev

3. Open your browser to the local URL (usually http://localhost:5173).

---

## 🎹 How to Use

1.  Connect a Device (Optional)
    Plug in your electronic drum kit or MIDI keyboard via USB. The app will automatically detect MIDI input.

2.  ...Or Use Your Computer Keyboard
    No MIDI device? No problem. Use your keyboard to simulate drum hits:

    | Key | Instrument | MIDI Note |
    | :--- | :--- | :--- |
    | **A** | Bass Drum | 36 |
    | **S** | Snare Drum | 38 |
    | **D** | Hi-Hat (Closed) | 42 |
    | **F** | Hi-Hat (Open) | 46 |
    | **Space** | Crash Cymbal | 49 |
    | **J** | Ride Cymbal | 51 |

3.  Play
    Start drumming! Your notes will appear on the sheet music stave in real-time.

4.  Export
    Finished? Click the **Export PDF** button to download a professional score of your performance.
