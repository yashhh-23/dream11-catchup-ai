# CatchUp AI — Development Changelog & Scope

> **Product Promise:**  
> *"Rejoin a live match in 45 seconds, without being spoiled, and know how your fantasy team did."*

---

## 🚫 Non-Goals (Scope Freeze)
To maintain laser focus on core product experience, user trust, and demo execution:
- **No authentication / user logins:** Single-session, zero-friction experience for every fan.
- **No external database:** In-memory, session-token, and filesystem-based data pipeline.
- **No multi-match selector:** Focused, end-to-end execution on a dramatic, real T20 second-innings chase.
- **No real video streaming / broadcast clips:** Broadcast rights and licensing prevent video playback; all replay clips are concept UI previews.
- **No OS-level push notification interception:** Web apps cannot mute native device lock-screen push alerts; documented as an app-ecosystem roadmap feature.
- **No multi-language speech bloat:** Focus on clear, high-accuracy English commentary that reliably speaks across any browser.

---

## 📋 Implementation Roadmap

- [x] **Phase 0: Freeze Scope**
  - Product promise articulated
  - Non-goals defined
  - `CHANGELOG.md` created
- [x] **Phase 1: Be Honest & Simplify UI**
  - Audited simulated features ("Concept preview" for replay clips, "Demo estimate" for leaderboard ranks, removed unsupported native lock-screen alert mute claims)
  - Simplified first screen: 3 phase presets (`Post-Powerplay`, `Middle overs`, `Full match`), time-away chips (`~15 mins`, `~30 mins`, `~45 mins`, `Whole match`), 2 spoiler levels (`Story only`, `Story + score`), and 1 primary CTA
  - Collapsed fine-tuning slider and "What's real vs simulated" transparency into disclosure
- [x] **Phase 2: Fix Demo-Breaking Edge Cases**
  - Skip-to-live request ID race condition guard with `reqId.current` tagging and AbortController
  - LiveView interval decoupled from state updater side-effects via ref
  - Cache key partitioned by spoiler level (`${matchId}:${from}:${to}:${level}`)
  - Story-only zero-digit validation rejecting digit leaks and falling back to clean qualitative narrative
  - Fantasy scoring computed strictly per request outside cache
- [x] **Phase 3: Real Match Data (Cricsheet)**
  - Integrate real historical T20 chase from Cricsheet
  - Parser script `scripts/convertCricsheet.mjs`
  - Accurate legal balls, extras, real bowler/batter names, and genuine scorecards
  - Tuned win probability curve
- [x] **Phase 4: "You Were Away" Inactivity Detector**
  - Page Visibility API hook (`useAwayDetector`)
  - Away catch-up prompt banner ("You were away ~20 min. Catch up?")
  - Demo timescale toggle (`?timescale=60`)
- [x] **Phase 5: Captain & Vice-Captain Picker**
  - Dropdowns on gate populated from real squad XI roster
  - Validate and score selected Captain (2x) and Vice-Captain (1.5x) per request
- [x] **Phase 6: Spoiler-Safe Share Card**
  - Next.js OG / Canvas spoiler-free image card generation
  - WhatsApp share button with non-spoiler link back to gate
- [x] **Phase 7: Accuracy Evaluation Suite**
  - Automated evaluation script `scripts/evalRecaps.mjs`
  - Hallucination, over boundary, and score consistency verification
  - Generate `EVAL.md` scorecard
- [x] **Phase 8: Metrics, Demo Readiness & Submission**
  - Lightweight event tracking (`/api/events`)
  - Final README updates with methodology, metrics, and architecture
