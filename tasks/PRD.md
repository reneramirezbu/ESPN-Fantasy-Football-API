We’re building a one-page fantasy football assistant that centralizes roster sync, ranking uploads, lineup optimization, and waiver suggestions across multiple leagues and providers. Today, pulling accurate league data (rosters, lineup slots, free agents) from hosts like ESPN typically requires manual copy/paste or insecure cookie hacks. Our approach uses a Chrome Extension (Manifest V3) to read league data from your already-authenticated session (no cookies sent to our server) and push a clean JSON snapshot into the web app. For providers with public APIs (e.g., Sleeper), we fetch directly.

Once league data is in, the user uploads Establish The Run (ETR) Weekly positional rankings and Rest-of-Season (ROS) Top-150 as CSVs (v1 manual upload). The app then:

Optimizes weekly lineups using the weekly rankings, honoring roster slots and FLEX eligibility, with sensible defaults (exclude OUT/bye players, toggle-able).

Surfaces waiver opportunities by comparing each league’s free-agent pool to the ROS Top-150, proposing add/drop pairs with a clear ROI-style delta (e.g., “ROS 38 > ROS 92 by 54 spots”) while respecting roster limits and minimum depth rules.

This keeps the product simple, private, and fast:

Single-page UI, per-league tools, global rankings.

Manual re-sync via extension (no server-stored cookies), so data is always user-controlled and current when needed.

Monorepo with shared core logic enables adding more providers (Yahoo via extension, MFL via API) without rewriting optimization or mapping logic.

Scope for v1: read-only sync for ESPN (extension) + Sleeper (API), CSV uploads for ETR, greedy/rank-based lineup optimizer, ROS-driven waiver suggestions, multi-league management with per-league re-sync. Future enhancement: automated ETR ingestion when/if a stable data path exists.



# Assumptions
* Read-only imports; no server-side storage of ESPN/Yahoo cookies.
* v1 providers: **ESPN (via Chrome Extension)** and **Sleeper (via public API)**.
* Rankings source: user uploads **ETR Weekly positional CSVs** + **ROS Top-150 CSV**.
* One-page web app (Next.js) with per-league Optimize + Waivers panels.
* Monorepo with shared core logic.

---

# 0) Prep

* [ ] Create repo name (e.g., `fantasy-lineup-optimizer`).
* [ ] Decide persistence: **SQLite (via Prisma)** or **Supabase** (pick one).
* [ ] Generate secrets: `HMAC_SECRET`, `SESSION_SECRET`.
* [ ] Define FA page cap default (e.g., **3 pages per position** on ESPN).
* [ ] Define minimum bench depth rules (default: keep ≥1 backup **QB** and **TE**).

---

# 1) Monorepo & Tooling

* [ ] Initialize **pnpm workspaces** + **Turborepo**.
* [ ] Create structure:

  ```
  repo/
    apps/
      web/          # Next.js SPA
      extension/    # Chrome MV3
    packages/
      core/         # domain models, parsers, optimizer, waivers
      providers/
        espn/       # mapper from extension payload -> core models
        sleeper/    # fetch + map from Sleeper API -> core models
    .github/workflows/
  ```
* [ ] Add GitHub Actions:

  * [ ] Build/test all workspaces.
  * [ ] Produce **ZIP artifact** for `apps/extension` on tag.

---

# 2) Core Domain (packages/core)

* [ ] Define Types: `League`, `Team`, `Player`, `RosterSlots`, `FreeAgent`, `Provider`.
* [ ] CSV parsers:

  * [ ] Weekly positional: `{name, team, pos, rank, week?}`.
  * [ ] ROS Top-150: `{name, team, pos, rosRank}`.
  * [ ] Column-mapper utility + header normalization.
* [ ] Name normalization:

  * [ ] Trim suffixes (Jr., III), standardize team codes, DST naming.
* [ ] Mapping:

  * [ ] Exact match (name+team+pos) → fuzzy fallback → override store.
* [ ] Optimizer:

  * [ ] Greedy weekly-rank fill → mandatory slots then FLEX.
  * [ ] Exclude OUT/Bye by default (toggle-able).
  * [ ] Tie-break: weekly rank → ROS rank → keep current.
* [ ] Waivers engine:

  * [ ] Compare ROS Top-150 vs league FAs.
  * [ ] Suggest add/drop with delta, enforce roster limits + min-depth rules.

---

# 3) Provider Adapters (packages/providers)

## ESPN

* [ ] Define TypeScript mappers from **extension payload** → `core` models.

## Sleeper

* [ ] Implement fetchers:

  * [ ] League meta, roster, users/teams, player pool (FAs).
* [ ] Map to `core` models.

---

# 4) Web App (apps/web)

## 4.1 Next.js SPA skeleton

* [ ] One page with 3 areas:

  * [ ] **Leagues Drawer** (multi-league list, provider badges, last-sync, Re-Sync).
  * [ ] **Optimize Panel** (current vs recommended, OUT/Bye toggle, copy moves).
  * [ ] **Waivers Panel** (Top ROS FAs, add/drop suggestions, conflict badges).
  * [ ] **Rankings Upload Card** (global; shows parsed counts & unresolved names).
* [ ] Add design system: Tailwind + basic table (TanStack Table).

## 4.2 API routes (Next.js API)

* [ ] `POST /api/link-code/create` → `{ code, expiresAt }` (5–10 min TTL).
* [ ] `POST /api/import/espn` → validate HMAC + `linkCode`, persist snapshot.
* [ ] `POST /api/import/sleeper` → given `leagueId`, fetch+map snapshot.
* [ ] `POST /api/rankings/upload` → parse + store Weekly + ROS; return counts & unresolved names.
* [ ] `GET /api/league/:id/optimize` → run optimizer with latest Weekly/ROS.
* [ ] `GET /api/league/:id/waivers` → run waivers engine with ROS + FA pool.
* [ ] Persistence models (SQLite/Supabase):

  * [ ] `League`, `LeagueSnapshot`, `MappingOverride`, `RankWeekly`, `RankROS`.

## 4.3 Security & infra

* [ ] Implement short-lived **link codes** store (TTL).
* [ ] HMAC verify for `/import/espn` payloads from extension.
* [ ] CORS (restrict to extension ID + app origin).
* [ ] Do **not** accept or store cookies in backend.

---

# 5) Chrome Extension (apps/extension) – ESPN v1

## 5.1 Manifest & Permissions

* [ ] Manifest V3:

  * [ ] `host_permissions`: `https://fantasy.espn.com/*`
  * [ ] `permissions`: `storage`, `activeTab`, `scripting`, `alarms` (optional later).
  * [ ] `background.service_worker`: `background.js`
  * [ ] `action.default_popup`: `popup.html`
  * [ ] `content_scripts`: run on ESPN fantasy pages.
* [ ] Config file for backend base URL + HMAC secret.

## 5.2 Popup UX

* [ ] Input: **Link Code**.
* [ ] Button: **Import Leagues**.
* [ ] Status area (success/fail, counts).

## 5.3 Content Script (page context)

* [ ] Detect league context (URL params).
* [ ] Fetch JSON data via ESPN endpoints or in-page state:

  * [ ] League settings (slots, scoringPeriod).
  * [ ] Your team roster (starters/bench; statuses, byes, eligibility).
  * [ ] Free agents (iterate first N pages per position).
* [ ] Normalize basic shapes (shallow; deep mapping happens server-side).

## 5.4 Background Worker

* [ ] Receive payload from content script.
* [ ] Compute HMAC; `POST /api/import/espn?code=<linkCode>`.
* [ ] Handle retries/backoff; surface outcome to popup.

---

# 6) Rankings Upload & Name Resolution (web)

* [ ] Drag-and-drop for multiple weekly files + single ROS file.
* [ ] Column-mapper UI when headers unknown.
* [ ] Unresolved names modal:

  * [ ] Show best fuzzy candidates per position/team.
  * [ ] One-click override; persist `MappingOverride`.
* [ ] Display summary: total rows, mapped %, unresolved count, week detected.

---

# 7) Optimize Panel

* [ ] Inputs: OUT/Bye toggle, Week selector (from `scoringPeriodId`).
* [ ] Output tables:

  * [ ] **Current Starters** vs **Recommended Starters**.
  * [ ] Bench list with weekly/ROS ranks.
* [ ] “Copy Moves” button: generate human-readable swap list.

---

# 8) Waivers Panel

* [ ] Show Top-150 ROS players **available** in this league.
* [ ] For each: propose **Add <FA> / Drop <Bench Player>** with ROS delta.
* [ ] Flag conflicts (violates min depth; position caps).
* [ ] Allow user to toggle min-depth rules.

---

# 9) Re-Sync Flow (per league)

* [ ] ESPN: “Re-Sync” → create link code → user opens extension → paste code → Import → update snapshot + timestamp.
* [ ] Sleeper: “Re-Sync” → refetch via API.
* [ ] Show **Last Synced** badge; spinner during refresh.

---

# 10) Data Contracts (pin for dev)

**Extension → `/api/import/espn`**

```json
{
  "linkCode": "ABC123",
  "hmac": "base64(hmacSha256(body, HMAC_SECRET))",
  "league": {
    "provider": "espn",
    "leagueId": "12345",
    "seasonId": 2025,
    "scoringPeriodId": 3,
    "name": "League Name",
    "rosterSlots": { "QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1,"K":1,"DST":1,"BENCH":6 },
    "team": { "teamId": 7, "name": "Rene", "starters": [/* players */], "bench": [/* players */] },
    "freeAgents": [/* players */]
  }
}
```

**Rankings parsed shape** (stored server-side):

* Weekly: `{ name, team, pos, rank, week, providerPlayerId? }`
* ROS: `{ name, team, pos, rosRank, providerPlayerId? }`

---

# 11) QA & Acceptance Tests

* [ ] ESPN import succeeds when logged into ESPN; no cookies sent to server.
* [ ] Sleeper import by League ID succeeds.
* [ ] Multi-league list shows both providers; each with independent **Re-Sync**.
* [ ] Upload Weekly + ROS; < 3 unresolved names after overrides.
* [ ] Optimizer outputs legal lineup (slots + FLEX) and excludes OUT/Bye by default.
* [ ] Waivers shows available Top-150 FAs and at least one valid add/drop when eligible FAs exist.
* [ ] Security: invalid/expired link code rejected; HMAC mismatch rejected.
* [ ] Performance: initial ESPN import returns data within FA cap threshold.
* [ ] Persistence: mapping overrides survive server restarts.

---

# 12) Docs & Developer UX

* [ ] `README.md` with:

  * [ ] High-level architecture + repo layout.
  * [ ] `.env` variables & secrets.
  * [ ] How to run web + extension locally.
  * [ ] How to package the extension ZIP.
* [ ] Simple **troubleshooting** section (ESPN MFA, ad-blockers, 3rd-party cookies).

---

# 13) Post-v1 Enhancements (backlog)

* [ ] Yahoo via extension.
* [ ] MyFantasyLeague via API.
* [ ] Optional extension “auto-push on ESPN page open” (via `chrome.alarms`).
* [ ] Notifications (email/Slack) when a new Top-150 FA appears.
* [ ] Provider-specific scoring nuance toggles (if needed later).

---

If you want, I can also produce a **short “Create-with-Claude” prompt** that scaffolds each workspace with the exact file/folder stubs and API route signatures from this checklist.
