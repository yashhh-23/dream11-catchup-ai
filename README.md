# 🏏 CatchUp AI — "Zero-Spoiler" Live Contextual Time-Machine
> **Dream11 Forward Deployed Engineer (FDE) Internship Assignment Submission**  
> *An AI-powered second-screen companion for live sports fans.*

---

## 🎯 The Fan Problem
Fans constantly tune into a live cricket match 30–45 minutes late due to daily commutes, dinner, or work. When they open traditional sports or broadcast apps, they face two major frustrations:
1. **Instant Spoilers:** The app home screen immediately exposes the live score, ruining the dramatic tension.
2. **Context Loss & Wall of Text:** Catching up requires reading through 10+ overs of dry, ball-by-ball text commentary with zero narrative flow. Full video highlights aren't edited or uploaded until hours after the match ends.

Fans miss *why* the match shifted, who took the pivotal wickets, and why the required run rate climbed.

---

## ⚡ The Solution: CatchUp AI
**CatchUp AI** is an interactive, spoiler-free second-screen companion built for Dream11's ecosystem (Rhea AI & FanCode streaming):

```
[Screen 1: Spoiler Gate] ──▶ [Screen 2: Rhea AI Delta Recap] ──▶ [Screen 3: Live Match Center]
   (Score shielded,             (One-liner narrative,               (Unmasked live score,
    slider: Overs 6–14)          top 3 turning points,               simulated ball ticker,
                                 win-prob curve, audio voice)        creator room chat)
```

1. **Spoiler-Free Gate:** Shields the live score and lets the fan dial in the exact over they missed (e.g., Overs 6 to 14) or choose quick presets.
2. **Contextual Delta-Recap:** Powered by **Groq (`llama-3.1-70b-versatile`)**, Rhea AI synthesizes a 45-second personalized breakdown—narrating the story, calculating win-probability swings, and highlighting the top 3 high-leverage turning points (wickets, sixes).
3. **In-Browser Audio Commentary:** A 1-tap synthesized audio voiceover using the Web Speech API narrates the recap with energetic cadence.
4. **Interactive Win-Probability Chart:** Visualizes momentum shifts with hover tooltips and marks where wickets fell.
5. **Seamless Jump to Live:** A single tap unlocks the live match center with an auto-playing ball-by-ball delivery ticker and synced fan chat.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **Next.js 14 (App Router)** | Server-rendered API routes + static client rendering |
| **Styling** | **Tailwind CSS + Glassmorphism** | Mobile-first stadium dark mode styling |
| **Icons & Visuals** | **Lucide React + Custom SVG** | Zero-dependency responsive win-probability curve |
| **LLM & Inference** | **Groq SDK (`llama-3.1-70b-versatile`)** | Sub-second (<800ms) JSON inference |
| **Audio Voiceover** | **Web Speech API** | Zero-latency client-side synthesized voice |
| **Resilience & Fallback** | **FDE Deterministic Sports Engine** | Automatic client-side fallback if API limits occur |
| **Testing** | **Node.js Native Test Runner** | Unit tests covering all edge cases |

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd dream11
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and add your Groq API key:
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```
*(Note: If no Groq key is provided, the app gracefully degrades to the built-in deterministic momentum engine, ensuring 100% demo uptime).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Test Suite
```bash
npm test
```

---

## 📝 200-Word Submission Note (Ready for Submission)

> **What fan problem are you solving?**  
> Fans tuning into a live cricket match 30–45 minutes late face an immediate dilemma: opening any score app instantly spoils the live match score, while text commentary lacks narrative and video highlights only upload post-match. Viewers miss critical tactical context—why wickets fell, how momentum shifted, and what the pitch is doing.
>
> **How does your solution help?**  
> We built *CatchUp AI*, an interactive spoiler-free companion. When fans open Dream11 mid-innings, the live score is shielded. Fans drag a timeline slider to select their missed window (e.g., Overs 6 to 14). CatchUp AI generates a 45-second multimodal Delta-Recap featuring:
> 1. An energetic conversational recap text and audio voiceover like a friend briefing you.
> 2. Interactive visual cards of the top 3 high-leverage turning points (wickets and sixes with win-probability deltas).
> 3. An interactive win-probability curve.
> 4. A 1-tap "Jump to Live" button that unmasks the score and transitions into an auto-updating live ball ticker.
>
> **Which AI tools did you use?**  
> Groq API (`llama-3.1-70b-versatile`) with structured JSON schema output for sub-second ball-by-ball delta summarization, Web Speech API for voiceover commentary, and Cricsheet structured schemas for turning-point leverage calculation.
