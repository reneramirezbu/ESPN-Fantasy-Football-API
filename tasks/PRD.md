Love it. Here’s a concise, copy-pasteable **Claude Code prompt** tailored to your XLSX (one tab per position) and the roadmap (ROS Top-150 + waiver wire view). I’m also stating assumptions so Claude doesn’t overcomplicate anything.

---

# Prompt: Weekly Rankings XLSX Ingest + Usage

**Objective**
Add an upload flow that ingests an **XLSX** file with one worksheet per position (`QB`, `RB`, `WR`, `TE`, `FLEX`, `DST`, `K`) and normalizes it for:

1. **Weekly lineup optimization** (fill required slots, then FLEX).
2. **Waiver/available players view** (compare weekly + ROS ranks vs my starters/bench).
3. Future: ingest **ROS Top-150** to power waiver suggestions and tie-breaks.

**Assumptions**

* The XLSX **tabs are exactly**: `QB`, `RB`, `WR`, `TE`, `FLEX`, `DST`, `K`.
* **All tabs share the same columns**. Required columns (case-insensitive):

  * `Player` (string), `Team` (e.g., SF), `Pos` (QB/RB/WR/TE/K/DST), `Rank` (int).
  * Optional: `Week` (int), `Tier` (string/int), `Notes` (string).
* FLEX tab lists multi-eligible players (RB/WR/TE) ranked for FLEX only.
* If `Week` is missing, use the **current scoringPeriodId** from the league snapshot.

**File handling**

* Accept **XLSX** directly. Also allow **CSV** fallback (one combined CSV or multiple by position), but normalize to the same internal shape.
* For XLSX: read each positional sheet, validate required columns, and build one merged weekly-rank table with fields:

  ```
  { name, team, pos, rank, week?, sourcePos }  // sourcePos is the sheet name (QB/RB/WR/TE/FLEX/DST/K)
  ```
* Normalization rules: trim, collapse spaces, drop suffixes (Jr., III), normalize DST names (`49ers D/ST` ⇒ team=SF, pos=DST).
* **Name resolution**: try exact (name+team+pos) → fuzzy within same pos → manual override (persist overrides for reuse across uploads/leagues).

**Business logic**

* **Weekly lineup optimizer** (per league):

  * Fill mandatory slots by **Weekly Rank** (lower is better).
  * Fill **FLEX** using the **FLEX sheet** ranks; if the FLEX sheet is missing a player, compute an inferred FLEX score using that player’s positional rank (simple fallback: percentile within position).
  * Default exclude **OUT** and **Bye** (toggle to include).
  * Tie-break: if two players are unranked or tied, fall back to **ROS Top-150** (when available), else keep current starter.
* **Waiver/Available players panel** (per league):

  * Show all **free agents** (from league snapshot) with their **Weekly Rank** (pos + flex) and, when available, **ROS rank**.
  * Compare to my **bench (and optionally weakest starter)** by position and propose **Add/Drop** suggestions when FA’s ROS rank beats my candidate by a configured delta (e.g., Δ ≥ 20), respecting roster limits and min depth rules (keep ≥1 backup QB/TE).
  * Display rationale: “FA ROS 38 vs Your Bench WR ROS 92 (+54).”

**Future enhancement (ROS Top-150)**

* Add a second upload that accepts **ROS Top-150** (XLSX or CSV).
* Expected columns: `Player`, `Team`, `Pos`, `RosRank` (1–150), optional `Tier`.
* Normalize and persist; use for waiver deltas and optimizer tie-breaks.

**UX requirements**

* Upload card supports **XLSX** (primary) and **CSV** (fallback).
* After upload, show: row counts by tab, mapped %, unresolved names (open “Resolve” modal).
* Optimizer panel: **Current vs Recommended** + “Copy Moves” list; OUT/Bye toggle.
* Waivers panel: table of available players with Weekly Rank, ROS Rank (if uploaded), suggested add/drop with reasons, and conflict badges.

**APIs / functions (contract level)**

* `POST /api/rankings/weekly/upload` → parse XLSX/CSV, normalize, persist; return `{ byPosCounts, mappedPct, unresolved[] }`.
* `GET /api/rankings/weekly?week=` → unified weekly ranks for all positions (and flex).
* `POST /api/rankings/ros/upload` (future) → persist ROS Top-150.
* `GET /api/league/:id/optimize?week=` → returns recommended starters + bench with explanations.
* `GET /api/league/:id/waivers?week=` → returns FA list + suggested add/drop (if ROS uploaded).
* Core helper: `getWeeklyRank(providerPlayerId, week) -> number | null` and `getFlexRank(providerPlayerId, week) -> number | null`.

**Acceptance criteria**

* Ingesting the XLSX produces a unified weekly rank table with ≥95% auto-matched players; unresolved are manually resolvable and persisted.
* Optimizer fills legal lineup (slots + FLEX) using weekly ranks and excludes OUT/Bye by default.
* Waiver panel renders available players with weekly ranks; if ROS is uploaded, add/drop suggestions include rank deltas and respect roster rules.
* Both XLSX and CSV paths normalize to the same structure; FLEX tab is honored.

**Non-goals**

* No auto-download of ETR files (manual upload v1).
* No projections/points models beyond rank ordering.

---

## Quick guidance: CSV vs XLSX

* Keep **XLSX as first-class** (since your file is multi-tab by position).
* Also support **CSV** for flexibility and speed (combined or per-position).
* Internally, **normalize both** into the same structure so the optimizer/waiver code is format-agnostic.

**Assumptions I’m making**

* Sheet names match exactly; if not, implement a lightweight sheet-to-position selector.
* Ranks are **ascending = better**.
* FLEX sheet exists; if not, compute an inferred FLEX rank from positional ranks.

---

If you want, I can add a tiny sample header row + 3 example rows for each sheet, but this should be enough for Claude to wire up the parser and downstream usage.
