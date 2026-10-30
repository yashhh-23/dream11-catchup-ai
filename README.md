# 🏏 CatchUp AI — "Zero-Spoiler" Live Contextual Time-Machine
> **Dream11 Forward Deployed Engineer (FDE) Internship Assignment Submission**  
> *An AI-powered second-screen companion for live sports fans.*  
> **Live Artifact:** [https://dream11-wheat.vercel.app](https://dream11-wheat.vercel.app)  
> **GitHub Repository:** [https://github.com/yashhh-23/dream11-catchup-ai](https://github.com/yashhh-23/dream11-catchup-ai)

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
   (Score shielded,             (Commentator headline,              (Unmasked live score,
    slider & chips: 6–14)        top 3 key moments,                  simulated delivery ticker,
                                 win-prob curve, audio voice)        creator room chat)
```

1. **Spoiler-Free Gate:** Shields the live score with a locked `••• / •` placeholder and lets the fan dial in the exact over they missed (e.g., Overs 6 to 14) using quick chips or fine slider control.
2. **Contextual Delta-Recap:** Powered by **Groq (`llama-3.1-70b-versatile` / `llama-3.3-70b-versatile`)**, Rhea AI synthesizes a 45-second personalized breakdown—narrating the story, calculating win-probability swings, and highlighting the top 3 high-leverage key moments (wickets, sixes, boundaries).
3. **In-Browser Audio Commentary:** A 1-tap synthesized audio voiceover using the Web Speech API narrates the recap with energetic cadence.
4. **Interactive Win-Probability Chart:** Visualizes momentum shifts with stable dot hover/tap details and highlights pivotal wicket and boundary deliveries.
5. **Seamless Jump to Live:** A single tap unlocks the live match center with an auto-playing ball-by-ball delivery ticker and synced fan chat.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Next.js 14 Client Tier (Tailwind Dark Theme #0E1116)"]
        UI_Gate["Screen 1: Spoiler Gate\n• Shielded Score Placeholder (•••/•)\n• Missed Window Selector (Overs 6-14)"]
        UI_Recap["Screen 2: Rhea AI Recap\n• Commentator Headline\n• Top 3 Key Moments\n• SVG Win-Prob Chart\n• Web Speech Audio Voiceover"]
        UI_Live["Screen 3: Live Match Center\n• Live Scoreboard (14.2 ov)\n• Real-Time Ball Delivery Feed\n• Synced Watch-Along Chat"]
        FallbackEngine["Local Deterministic Engine\n(lib/matchUtils.ts)\nZero-Downtime Offline Fallback"]
    end

    subgraph API["Next.js Serverless API Tier"]
        Route["POST /api/recap\n(app/api/recap/route.ts)"]
        PromptBuilder["Prompt Builder & Token Compressor\n(lib/promptBuilder.ts)"]
    end

    subgraph External["External Cloud & AI Services"]
        Groq["Groq Cloud LPU Engine\n(llama-3.1-70b-versatile)\n<800ms JSON Latency"]
    end

    subgraph DataTier["Data Tier"]
        Cricsheet["Structured Ball-by-Ball Feed\n(lib/matchData.ts - 120+ balls)"]
    end

    UI_Gate -->|1. User selects window [fromOver, toOver]| Route
    Cricsheet -->|Load match deliveries| Route
    Route --> PromptBuilder
    PromptBuilder -->|2. Compressed ball payload & JSON schema| Groq
    Groq -->|3. Structured JSON summary| Route
    Route -->|4. Return parsed recap| UI_Recap
    Route -.->|Timeout / Rate Limit Fallback| FallbackEngine
    FallbackEngine -.->|Immediate heuristic recap| UI_Recap
    UI_Recap -->|5. Jump to Live (Zero Spoilers)| UI_Live
```

### Architectural Highlights
- **Sub-Second Token-Compressed Prompting:** Deliveries in the missed window are compressed into a compact pipe-delimited format (`O11.2|Tilak Varma vs Ish Sodhi|6r|Score:91/3|WP:44%`), cutting prompt tokens by over 70% and achieving `<800ms` round-trip inference on Groq's LPUs.
- **Strict JSON Schema Guardrails:** The LLM produces deterministic JSON with mood classifications, headline stories, and strictly typed moment arrays.
- **Dual-Layer Resilience:** If the Groq API key is omitted, exhausted, or experiences network disruption, the app automatically switches to `getTopMomentsFallback()`, delivering a mathematically accurate momentum breakdown with 0% downtime.
- **Accurate Cricket Notation Engine:** Completed overs and balls are cleanly computed and formatted (e.g. over 14, ball 2 displays standard `14.2 ov` across all UI states).

---

## 📂 Project Directory & File Structure

```
dream11/
├── app/                                 # Next.js 14 App Router
│   ├── api/
│   │   └── recap/
│   │       └── route.ts                 # POST /api/recap: Groq inference + fallback handler
│   ├── globals.css                      # Design tokens, Tailwind base, and dark mode palette
│   ├── layout.tsx                       # Root layout & HTML metadata (Dream11 Theme)
│   └── page.tsx                         # Main page mounting CatchUpFlow component
│
├── components/                          # React Component Library
│   ├── CatchUpFlow.tsx                  # State machine managing screens: gate -> recap -> live
│   ├── charts/
│   │   └── WinProbChart.tsx             # Interactive SVG win-probability momentum curve
│   └── screens/
│       ├── SpoilerGate.tsx              # Screen 1: Shielded score & over window selector
│       ├── RecapScreen.tsx              # Screen 2: Rhea AI headline, audio, & key moments
│       └── LiveView.tsx                 # Screen 3: Live match ticker, commentary, & chat
│
├── lib/                                 # Business Logic & Utility Modules
│   ├── groqClient.ts                    # Groq SDK client initializer with API key validation
│   ├── matchData.ts                     # Ball-by-ball dataset (India vs NZ 4th T20I chase)
│   ├── matchUtils.ts                    # Cricket statistics, over formatters, and fallback engine
│   ├── promptBuilder.ts                 # Token-compressed prompt generator for Groq LLM
│   └── utils.ts                         # Tailwind CSS class merging utility (clsx / twMerge)
│
├── types/                               # TypeScript Type Definitions
│   └── index.ts                         # Ball, MatchMeta, RecapResponse, TurningPoint types
│
├── tests/                               # Automated Test Suite
│   └── unit.test.mjs                    # Unit tests running under native Node.js test runner
│
├── .env.example                         # Example environment variables template
├── next.config.mjs                      # Next.js build configuration
├── package.json                         # Project dependencies and script definitions
├── tailwind.config.ts                   # Tailwind configuration with Dream11 color tokens
├── tsconfig.json                        # TypeScript compiler configuration
└── README.md                            # Comprehensive project documentation
```

---

## 🎨 Design System & Tokens

Built with a flat, focused layout adhering to modern sports UI conventions:
- **Background:** `#0E1116` (Deep stadium dark)
- **Card Surface:** `#161B22` (One step lighter, borderless dividers)
- **Dividers & Borders:** `#262C36`
- **Primary Accent:** `#E11D48` (Dream11 Red)
- **Cricket Event Indicators:**
  - **Wicket:** Rose `#F43F5E`
  - **Six:** Emerald `#10B981`
  - **Four:** Blue `#3B82F6`
  - **Neutral / Dot:** Slate `#64748B`

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/yashhh-23/dream11-catchup-ai.git
cd dream11
npm install
```

### 2. Configure Environment Variables
Create `.env.local` in the project root:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```
*(Note: If no Groq API key is provided, the application gracefully activates the local deterministic momentum engine, ensuring 100% demo uptime).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Test Suite
```bash
npm test
```
All unit tests run using Node.js's native test runner covering range slicing, boundary calculations, edge cases, and cricket over notation.

---

## 📝 200-Word Official Submission Note

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
