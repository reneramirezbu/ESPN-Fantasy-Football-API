# Dashboard Position & Flex Ranking Plan

## Goal
Persist weekly rankings from the 7-sheet upload (QB, RB, WR, TE, FLEX, DST, K) and surface both position-specific ranking and flex ranking (where applicable) on the dashboard roster table.

## Assumptions
- Upload flow already parses the weekly XLSX into `rankings.positions` by sheet with fields: `name`, `team`, `pos`, `rank`, `rosRank`, `matchup`, `vsEcr`.
- Rankings are saved per week/season in `data/rankings/{season}-week{week}.json` and loaded through `RankingsContext`.
- Dashboard roster data comes from ESPN API (`myTeam.roster`).
- FLEX sheet only lists RB/WR/TE and will always be present.
- QB, DST, K never need a flex ranking (display `-`).

## Deliverables
1. Players saved from uploads include both their position rank and flex rank metadata.
2. `MyTeam` table shows new `Pos Rank` and `Flex Rank` columns with chips.
3. Flex rank only rendered for RB/WR/TE players present in the FLEX sheet; otherwise fallback displays `-`.
4. Upload success toast includes counts of records with position + flex ranking for observability.

## Implementation Steps

### 1. Backend Enhancements (Parser & Storage)
1. **Augment parsed players**
   - Update `services/xlsxParser.js` to annotate each player with `positionRank` (rank within their source sheet) and `flexRank` (`null` when not applicable).
   - For FLEX sheet, store `pos` parsed from the `Pos` column to support matching.
2. **Cross-sheet enrichment**
   - After parsing all sheets, iterate RB/WR/TE lists to inject `flexRank` by matching the same player in the FLEX sheet (name + team).
   - Ensure we keep existing fields (`rank`, `rosRank`, etc.) untouched.
3. **Persist enriched structure**
   - Confirm `saveRankings` writes the new attributes to JSON (no additional schema change required beyond storing new keys).

### 2. API & Context Updates
1. **Rankings loader**: ensure `xlsxParser.loadRankings` returns the new `positionRank`/`flexRank` fields (automatic once stored).
2. **RankingsContext**
   - No structural change expected; ensure types/interfaces (if any) acknowledge new fields.
   - When matching roster players to rankings, prefer exact matches first (`lowerCase(name)` + `team`).

### 3. Frontend UI Changes
1. **`MyTeam.jsx`**
   - Extend `playerRankings` map to include:
     ```js
     rankMap[player.fullName] = {
       weeklyRank: rankedPlayer.rank,
       positionRank: rankedPlayer.positionRank,
       flexRank: rankedPlayer.flexRank,
       rosRank: rankedPlayer.rosRank,
       matchup: rankedPlayer.matchup
     };
     ```
   - Improved matching heuristics: try exact name, then last-name + team, then fallback to fuzzy (if necessary, leverage NameMatcher service).
   - Add `<TableCell>` columns for `Pos Rank` and `Flex Rank` with `Chip` styling.
   - Render `-` when rank data is missing or not applicable; for flex rank, check `['RB','WR','TE'].includes(player.position)`.
2. **Responsiveness & Layout**
   - Ensure table remains readable on smaller widths (wrap chips, adjust padding if needed).
   - Confirm new columns don’t break sorting or styling.

### 4. Validation & Testing
1. **Unit / Integration**
   - Add parser test (if harness exists) verifying a sample XLSX yields correct `positionRank` & `flexRank`.
   - Manual test: run upload with sample file, ensure JSON stored includes new fields.
2. **UI QA**
   - Upload real file, refresh dashboard; verify ranks shown for starters/bench.
   - Edge cases: player missing from positional sheet? (should show `-`).
   - Flex-only players (e.g., multi-position) still display correctly.

### 5. Analytics / Logging (Optional Enhancements)
- Extend upload response data to include counts per sheet and number of flex-ranked players for debugging.
- Console log matches/mismatches during development to aid future tuning.

## Risks & Mitigations
- **Name mismatches**: players with different naming conventions between sheets and ESPN roster.
  - Mitigation: rely on existing `NameMatcher`, consider storing normalized keys and manual overrides.
- **Flex sheet omissions**: if a ranked RB/WR/TE is missing from FLEX sheet, `flexRank` stays `null`.
  - Mitigation: optionally compute fallback based on positional percentile.
- **UI clutter on mobile**: additional columns may crowd layout.
  - Mitigation: hide flex column below specific breakpoint or convert to stacked chips.

## Definition of Done
- Uploading a valid rankings XLSX persists enriched player records with `positionRank` and `flexRank` where applicable.
- Dashboard renders both rankings columns without layout regression.
- Bench/starting players display accurate ranks consistent with the uploaded sheets.
- Manual testing for at least one week/season run recorded.


