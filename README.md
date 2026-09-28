# 👁️ SAARTHI | Live AI Assistive Vision for Visually Impaired Users

> **Ultra-Fast Real-Time Assistive Navigation Powered by Groq LPUs (`qwen/qwen3.8-27b`), Next.js 16, and Vercel Serverless.**

---

## 🌟 Overview

**SAARTHI** is an accessible, real-time computer vision assistant designed to empower visually impaired and low-vision individuals to navigate indoor and outdoor spaces with independence and confidence.

Unlike legacy architectures requiring heavy GPU servers or Python/YOLO microservices, SAARTHI is built as a **pure Next.js unified web app** that deploys in 1 click to **Vercel**, leveraging Groq's high-speed LPU infrastructure for sub-second vision reasoning.

---

## ✨ Features

- **🎯 3-Zone Spatial Navigation Radar**: Analyzes camera feeds into directional sectors (**Left**, **Center / Ahead**, **Right**) with immediate hazard alerts.
- **📏 Distance Categorization**: Pinpoints obstacles by proximity (**Immediate (<1.5m)**, **Near**, **Medium**, **Far**).
- **🔊 Smart Audio Guidance (TTS)**: Spoken directions delivered via the browser's Web Speech API with built-in deduplication and anti-spam intervals.
- **🔔 Web Audio Synthesizer**: Zero-external audio dependencies; generates real-time audio pings, caution tones, and urgent alert sirens via the Web Audio API.
- **📳 Mobile Haptic Feedback**: Vibrates phone hardware on critical and caution warnings.
- **🔄 Multimodal Modes**:
  1. **Navigation Mode**: Continuous walking obstacle avoidance (1.8s cadence).
  2. **Read Text (OCR) Mode**: Reads room numbers, signs, packaging, and labels aloud.
  3. **Describe Scene Mode**: Rich environmental overview of layout and surroundings.
- **⚡ Flashlight Torch & Camera Flip**: Toggle camera torch in low-light environments and switch between rear/front cameras.
- **🌓 High Contrast Accessibility Mode**: Yellow-on-Black and OLED high-contrast modes tailored for low-vision users.

---

## 🏗️ Architecture

```
[ User Smartphone / Web Camera ]
               │
               ▼  (Live Video Stream via WebRTC getUserMedia)
[ Next.js Client (React 19 / App Router) ]
               │
               ▼  (Sampled frame every 1.8s as compact base64 JPEG)
POST /api/analyze (Vercel Serverless Function)
               │
               ▼  (Uses GROQ_API_KEY)
[ Groq Cloud LPU ] (qwen/qwen3.8-27b Multimodal Vision)
               │  - Runs vision reasoning in ~450ms
               │  - Returns structured JSON:
               │    {
               │      "alertLevel": "clear" | "caution" | "critical",
               │      "spokenGuidance": "Watch out, chair directly ahead",
               │      "hazards": [{ "name": "chair", "direction": "center", "distance": "near" }],
               │      "sceneOverview": "Office corridor with clear exit"
               │    }
               ▼
[ Next.js Client Engine ]
               │
               ▼  (Synthesizes Web Speech + Web Audio Chimes)
[ Directional Voice Alert + Screen Reader Live Region ]
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Start the Server
```bash
npm run dev
# or on a custom port
npx next dev -p 3030
```
Open [http://localhost:3030](http://localhost:3030) in your browser.

---

## ☁️ Deploying to Vercel (1-Click)

### Step 1: Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit of SAARTHI Next.js Groq Vision assistant"
git branch -M main
git remote add origin https://github.com/your-username/saarthi.git
git push -u origin main
```

### Step 2: Import to Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `saarthi` GitHub repository.
3. Under **Environment Variables**, add:
   - `GROQ_API_KEY` = `your_groq_api_key`
4. Click **Deploy**.

That's it! Your serverless assistive vision app will be live with a production HTTPS URL and full mobile camera support.
