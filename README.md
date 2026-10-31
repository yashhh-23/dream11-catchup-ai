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

Fans miss *why* the match shifted, who took the pivotal wickets, and how their Dream11 fantasy team was impacted.

---

## ⚡ The Solution: CatchUp AI
**CatchUp AI** is an interactive, spoiler-free second-screen companion built for Dream11's ecosystem (Rhea AI & FanCode streaming):

```
[Screen 1: Spoiler Gate] ──▶ [Screen 2: Rhea AI Delta Recap] ──▶ [Screen 3: Live Match Center]
   (Score shielded,             (Commentator headline,              (Unmasked live score,
    time away / over selector,   fantasy team impact,                simulated delivery ticker,
    3 spoiler levels)            top 3 key moments, audio voice)     creator room chat)
```

1. **Spoiler-Free Gate:** Shields the live score with a locked `••• / •` placeholder and lets the fan dial in their missed window by overs or time away ("~30 mins").
2. **Dream11 Fantasy Team Impact:** Highlights how the fan's Captain (2x) and Vice-Captain (1.5x) performed during the missed phase, with a masked leaderboard rank reveal.
3. **Contextual Delta-Recap:** Powered by **Groq (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`)**, Rhea AI synthesizes a 45-second personalized breakdown with mood, commentary, and top 3 key moments.
4. **In-Browser Audio Commentary & Hinglish:** 1-tap synthesized audio voiceover in English or Indian fan Hinglish.
5. **Interactive Win-Probability Chart:** Hand-crafted SVG momentum curve with stable dot tap details and delivery classification.
6. **"What to Watch Next" Live Bridge:** Forward-looking card detailing the next striker, bowler, required equation, and tactical matchup.

---

## 🏗️ System Architecture & Zero-Spoiler Security

```mermaid
flowchart TD
    subgraph Client["Next.js 14 Client Tier (Tailwind Design Tokens)"]
        UI_Gate["Screen 1: Spoiler Gate\n• Shielded Score Placeholder (•••/•)\n• Time Away & Over Selectors\n• 3 Spoiler Levels (Story Only / +Phase / Full)\n• Lock-Screen DND Shield Toggle"]
        UI_Recap["Screen 2: Rhea AI Recap\n• Fantasy Team Impact & Masked Rank\n• Commentator Headline & Story\n• Step-by-Step Moment Reveal\n• SVG Win-Prob Chart\n• Audio Voiceover (EN / Indian Hinglish)"]
        UI_Live["Screen 3: Live Match Center\n• Live Scoreboard (Paused by default at 14.2)\n• Real-Time Ball Delivery Feed\n• Cryptographic Live Clock Token Verification\n• Synced Watch-Along Chat"]
        FallbackEngine["Local Deterministic Engine\n(lib/matchUtils.ts)\nZero-Downtime Offline Fallback"]
    end

    subgraph ServerSecurity["Server-Only Isolation & Security Boundary"]
        ServerData["Server-Only Match Repository\n(lib/serverMatchData.ts)\n• 112 Match Deliveries\n• Client bundles NEVER receive future balls\n• Evaluated strictly on the server"]
        SessionCrypto["Live Simulation Clock\n(lib/sessionUtils.ts)\n• HMAC-SHA256 Signed Tokens\n• Real-Time Delivery Rate Limiting\n• Rejects premature queries with 403 Forbidden"]
    end

    subgraph API["Next.js Serverless API Tier"]
        RouteMatch["GET /api/match\n• Serves public balls up to 14.2\n• Issues signed simulator session token"]
        RouteDelta["GET /api/match/delta\n• Validates token against server clock\n• Unlocks one delivery at real-time pace (~4s)"]
        RouteRecap["POST /api/recap\n• Server-side score redaction for 'story-only'\n• Clamps toOver <= 14.2 (Max allowed live)\n• In-Memory De-duplication & Caching"]
        PromptBuilder["Prompt Builder & Token Compressor\n(lib/promptBuilder.ts)"]
    end

    subgraph External["External Cloud & AI Services"]
        Groq["Groq Cloud LPU Engine\n(llama-3.3-70b-versatile)\n<800ms JSON Latency"]
    end

    UI_Gate -->|1. User selects window [fromOver, toOver]| RouteRecap
    ServerData -->|Load safe balls up to 14.2| RouteRecap
    RouteRecap --> PromptBuilder
    PromptBuilder -->|2. Compressed ball payload & JSON schema| Groq
    Groq -->|3. Structured JSON summary| RouteRecap
    RouteRecap -->|4. Return typed ApiResponse| UI_Recap
    RouteRecap -.->|Timeout / Fallback| FallbackEngine
    FallbackEngine -.->|Immediate heuristic recap| UI_Recap
    UI_Recap -->|5. Jump to Live (Zero Spoilers)| UI_Live
    UI_Live -->|6. Advance ball with signed token| RouteDelta
    RouteDelta --> SessionCrypto
    SessionCrypto -->|Authorize next delivery| ServerData
```

---

## 📂 Project Directory & File Structure

```
dream11/
├── app/                                 # Next.js 14 App Router
│   ├── api/
│   │   ├── match/
│   │   │   ├── route.ts                 # GET /api/match: Serves safe public deliveries + session token
│   │   │   └── delta/
│   │   │       └── route.ts             # GET /api/match/delta: HMAC-validated delivery ticker stream
│   │   └── recap/
│   │       └── route.ts                 # POST /api/recap: Server-side score redaction, caching & clamp
│   ├── globals.css                      # Design tokens, Tailwind base, and dark mode palette
│   ├── layout.tsx                       # Root layout & HTML metadata (Dream11 Theme)
│   └── page.tsx                         # SSR page delivering safe initial balls and token to CatchUpFlow
│
├── components/                          # React Component Library
│   ├── CatchUpFlow.tsx                  # State machine managing screens: gate -> recap -> live
│   ├── charts/
│   │   └── WinProbChart.tsx             # Interactive SVG win-probability curve with score redaction
│   └── screens/
│       ├── SpoilerGate.tsx              # Screen 1: Shielded score, DND shield toggle & zero-spoiler modal
│       ├── RecapScreen.tsx              # Screen 2: Fantasy impact, audio, moments & what to watch next
│       └── LiveView.tsx                 # Screen 3: Live match ticker (paused by default), commentary & chat
│
├── lib/                                 # Business Logic & Utility Modules
│   ├── groqClient.ts                    # Sequential Groq SDK client (llama-3.3-70b -> llama-3.1-8b)
│   ├── matchData.ts                     # Public match metadata (safe for client reference)
│   ├── serverMatchData.ts               # Server-only match repository & dynamic simulator registry
│   ├── sessionUtils.ts                  # Cryptographic HMAC token generation & rate-limited clock
│   ├── matchUtils.ts                    # Ball classification, EVENT_STYLE, fantasy engine, stats
│   └── promptBuilder.ts                 # Token-compressed prompt generator for Groq LLM
│
├── types/                               # TypeScript Type Definitions
│   └── index.ts                         # Ball, MatchMeta, RecapPayload, ApiResponse<T>
│
├── tests/                               # Automated Test Suite
│   └── unit.test.mjs                    # 16 Unit tests running under native Node.js test runner
│
├── .env.example                         # Example environment variables template
├── next.config.mjs                      # Next.js build configuration
├── package.json                         # Lean project dependencies
├── tailwind.config.ts                   # Tailwind configuration with brand tokens
├── tsconfig.json                        # TypeScript compiler configuration
└── README.md                            # Comprehensive project documentation
```

---

## 🎨 Design System Tokens

- **Background:** `brand-bg` (`#0E1116`)
- **Card Surface:** `brand-surface` (`#161B22`)
- **Dividers & Borders:** `brand-border` (`#262C36`)
- **Primary Accent:** `brand-red` (`#E11D48`)
- **Cricket Event Indicators:**
  - **Wicket:** Rose (`#EF4444`)
  - **Six:** Emerald (`#10B981`)
  - **Four:** Blue (`#3B82F6`)
  - **Dot / Run:** Slate (`#64748B` / `#94A3B8`)

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
All 16 unit tests run using Node.js's native test runner covering range slicing, ball classification, boundary calculations, fantasy points, zero-spoiler cryptographic tokens, and score redaction.

---

## 📝 200-Word Official Submission Note

> **What fan problem are you solving?**  
> Fans tuning into a live cricket match 30–45 minutes late face an immediate dilemma: opening any score app instantly spoils the live match score, while text commentary lacks narrative and video highlights only upload post-match. Viewers miss critical tactical context—why wickets fell, how momentum shifted, and what happened to their Dream11 fantasy team.
>
> **How does your solution help?**  
> We built *CatchUp AI*, an interactive spoiler-free companion. When fans open Dream11 mid-innings, the live score is shielded. Fans pick their missed window by overs or time away ("~30 mins"). CatchUp AI generates a 45-second multimodal Delta-Recap featuring:
> 1. A Dream11 fantasy impact card with Captain/VC points (+46 pts) and a masked rank reveal.
> 2. An energetic conversational recap in English or Hinglish with speech synthesis voiceover.
> 3. Step-by-step key turning points with 10-second video clip replays.
> 4. An interactive SVG win-probability curve and a forward-looking "What to watch next" card.
> 5. A 1-tap "Jump to Live" button that transitions seamlessly into the live ball ticker.
>
> **Which AI tools did you use?**  
> Groq API (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) with structured JSON schema output for sub-second delta summarization, Web Speech API for voiceover commentary, and a deterministic cricket momentum engine for ground-truth turning points.
