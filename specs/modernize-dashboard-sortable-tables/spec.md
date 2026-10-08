# Modernize Dashboard UI and Add Sortable Data Tables — Specification

## 1. What is being built and why

The GitHub Audit Dashboard currently renders two server-side pages: a login page
(`public/index.html`) and a single authenticated dashboard page (`public/dashboard.html`,
served via `src/app.ts:27-29`) containing one 20-column repository table (`public/dashboard.html:41-67`).
The visual design is a minimal GitHub-colored stylesheet (`public/styles.css`), and the only
existing sort mechanism is a `<select>` dropdown (`public/dashboard.html:33-37`) plus a direction
toggle button (`public/dashboard.html:38`), wired up in `public/dashboard.js:148-160`, which can sort
by exactly three of the table's twenty columns (`stars`, `updatedAt`, `size` — see
`public/sort.js:2-6`).

This feature has two parts:

1. **Visual modernization**: refresh the look of the existing pages (typography, spacing, color
   palette, contrast) without touching the data, pages, or navigation structure.
2. **Per-column sortable tables**: replace/extend the current dropdown-based, 3-key sort with
   clickable column headers on every column of every data table, using type-aware comparisons
   (numeric, date, case-insensitive string), entirely client-side, with a visible indicator of
   the active sort column and direction, and no persistence across reloads.

The motivation (per the feature description) is a cleaner, accessible visual baseline and a more
discoverable, complete sorting interaction (click any header, not just the three currently exposed
via the dropdown), while explicitly preserving the server-rendered architecture, data, and
navigation as-is.

## 2. Prior art already in this repository

This is a **partial-implementation gap**, not a greenfield build. Concretely:

- A sorting utility already exists: `public/sort.js:8-21` (`sortRepos(repos, key, direction)`)
  with a hardcoded accessor map `SORT_ACCESSORS` (`public/sort.js:2-6`) covering only `stars`
  (numeric), `updatedAt` (date, parsed via `new Date(...).getTime()`), and `size` (numeric). It
  has no generic type-tag concept (numeric/date/string), no currency/comma/percent stripping, and
  no case-insensitive string comparator — there is no string column support at all today.
- A sort UI already exists, but as a `<select>` + direction-toggle button
  (`public/dashboard.html:31-39`), not clickable column headers. There is no per-header click
  handler, no active-column visual indicator (arrow/highlight), and no "click again to reverse,
  click a different header to replace" interaction model in `public/dashboard.js`.
- Existing automated tests for the current sort utility: `test/sort.test.ts:1-53`, covering only
  the three existing keys (`stars`, `updatedAt`, `size`) and non-mutation/invalid-key behavior.
  There are no tests for a string/case-insensitive comparator, for stripped-formatting numeric
  comparison (commas/currency/percent), or for empty/null/missing-value handling, because the
  current implementation does not support those cases.
- There is only **one** data table in the entire app: `#repo-table` in `public/dashboard.html:41-67`,
  with 20 `<th>` columns (`public/dashboard.html:44-63`). There is no second page or second table
  to extend elsewhere in `public/` or `src/`. "Every dashboard page" / "every data table" in the
  feature description therefore resolves, in this codebase, to this single page and single table.
- The existing stylesheet (`public/styles.css`) already uses a restrained, mostly-neutral palette
  (e.g. body text `#1b1f23` on `#f6f8fa`/`#fff`, label text `#57606a` on white) but has not been
  audited for WCAG AA contrast as part of this repository's history — no accessibility
  documentation or contrast audit exists in `README.md` or elsewhere in the tree.

**Scope implication**: this feature is a rework/extension of existing code, not new construction.
The gap to close is: (a) generalize `sort.js` from a 3-key hardcoded map to a generic,
type-aware, per-column comparator usable by every `<th>` in the table; (b) replace the
dropdown+button sort control with clickable `<th>` headers carrying visual sort-state indicators;
(c) restyle `styles.css` (and any inline markup needed for the new header affordances) to a
modernized, WCAG AA-compliant palette; (d) add tests for the new per-type comparators and edge
cases, while keeping `test/sort.test.ts`'s existing cases passing (either preserved as-is against a
backward-compatible API, or migrated to exercise the same scenarios against the new API).

## 3. Acceptance criteria

### Visual modernization
1. `public/index.html` (login) and `public/dashboard.html` (authenticated dashboard) both load
   using an updated stylesheet with consistent spacing, typography, and color palette, with no
   change to the text content, fields, or data displayed on either page.
2. All text/background color pairs used in the updated design (body text, labels, banners, button
   text, table header/cell text, the active-sort indicator) meet WCAG AA contrast ratios (4.5:1 for
   normal text, 3:1 for large text ≥18pt/14pt-bold and for UI component boundaries).
3. The set of pages (`/`, `/dashboard.html`), the navigation elements (top bar title, logout
   button/form), and the information architecture (summary stats section, controls, table, empty
   state) remain structurally unchanged — only CSS/visual presentation and the sort-control markup
   (per criteria 6–11 below) differ from the current version.
4. No repository field currently rendered in `public/dashboard.js:41-64` (name, owner, description,
   visibility, primary language, languages, stars, forks, watchers, open issues, open PRs, size,
   default branch, license, archived, disabled, created/updated/pushed/last-commit dates) is added,
   removed, or renamed as a result of this change.
5. No API request/response shape changes: `GET /api/repos` (`src/routes/api.ts`) continues to
   return the same payload shape consumed by `public/dashboard.js`, and no new query parameters are
   introduced for sorting.

### Clickable, type-aware column sorting
6. Every `<th>` in the repo table (all 20 columns in `public/dashboard.html:44-63`) is clickable and
   triggers a client-side re-sort of the currently rendered rows by that column; no network
   request (e.g. to `/api/repos` or any other endpoint) fires as a result of a sort click.
7. Clicking the same column header a second time reverses the current sort direction
   (ascending ↔ descending) for that column.
8. Clicking a different column header while a sort is active discards the prior column's sort
   state and sorts by the newly clicked column instead (single-column sort only — no secondary/
   tie-break column is added).
9. Numeric columns (e.g. Stars, Forks, Watchers, Open issues, Open PRs, Size) sort in correct
   numeric order, not lexical string order (e.g. 2 sorts before 10). If a numeric column's
   displayed text includes thousands separators, a currency symbol, or a percent sign, those
   characters are stripped only for the purpose of comparison — the rendered cell text is
   unchanged.
10. Date columns (Created, Updated, Last push, Last commit) sort in correct chronological order by
    parsed date value, not by the displayed string's lexical order, regardless of the exact display
    format shown in the cell.
11. String columns (Name, Owner, Description, Visibility, Primary language, Languages, Default
    branch, License, Archived, Disabled) sort case-insensitively (e.g. "apple" and "Banana" compare
    as "apple" < "banana", not by ASCII case ordering).
12. The active sort column's header is visually distinguishable from unsorted headers (e.g. a
    directional arrow glyph and/or distinct styling), and the direction (ascending vs. descending)
    is distinguishable from the header's visual state alone.
13. On initial page load (and on any subsequent navigation/reload of the dashboard), the table
    renders in its original default order (the order rows arrive from `GET /api/repos`) with no
    column marked as actively sorted, until the user clicks a header.
14. Rapidly clicking the same header multiple times in succession leaves the table in a
    consistent, correct state matching an odd/even click count (odd = direction flipped once from
    default per click parity; even = back to the state before the click streak) with no stuck
    intermediate or corrupted row order.
15. Rows with empty/null/missing values in the sorted column are handled without throwing an
    exception and without silently dropping rows from the table (e.g. consistently sorted to one
    end, exact placement is an implementation choice but must be deterministic and non-crashing).
16. All pre-existing automated tests continue to pass (`npm test`), and new automated tests are
    added covering: numeric sort (plain and formatted/stripped values), date sort (including
    differing display formats), case-insensitive string sort, and at least one empty/null/missing-
    value edge case per type family exercised.

## 4. Scope boundaries — explicitly NOT part of this feature

- No changes to the data model, the `GET /api/repos` response payload, or any query parameters —
  sorting must not add, remove, or reshape any field, and must not trigger new server requests.
- No changes to the OAuth login/authentication flow (`src/auth/oauth.ts`, `src/auth/session.ts`,
  `src/auth/middleware.ts`) or session handling.
- No introduction of a frontend framework (React, Vue, etc.) or a build/bundle step for the
  frontend — the dashboard remains server-rendered HTML with plain CSS and vanilla JS, targeting
  modern evergreen browsers only (no legacy/IE-class compatibility work).
- No restructuring of pages, routes, or navigation — the set of pages (`/`, `/dashboard.html`) and
  the top-level navigation (top bar, logout) stay exactly as they are; this is a visual
  restyle plus a sort-interaction change, not an information-architecture change.
- No multi-column/secondary sort (e.g. sort by Owner then Stars) — single active column only.
- No persistence of sort state across page reloads, navigation, or in any client/server storage
  (cookies, localStorage, query string, session) — every fresh load/navigation starts unsorted in
  default row order.
- No new backend sorting logic — sorting is exclusively a client-side concern operating on rows
  already present in the DOM/response; the server continues to return rows in its existing order.
- No changes to rate-limit handling, the empty-state message, or any other dashboard behavior
  outside styling and sorting, as established in `specs/github-audit-dashboard/spec.md`.

## 5. Edge cases to account for

- A sorted column contains empty/null/missing values interspersed with valid values (e.g. a repo
  with no `lastCommitDate`, rendered as "Unavailable" per `public/dashboard.js:62`).
- Date values that are inconsistent or ambiguous in raw form must still compare correctly as
  parsed dates, not as display strings (the current `formatDate` in `public/dashboard.js:8-13`
  already normalizes invalid dates to "—" for display; sort comparison must handle the underlying
  ISO value, not the formatted "—").
- A numeric column whose displayed text includes commas, a currency symbol, or a percent sign must
  still sort by the correct underlying numeric magnitude.
- Zero rows (`public/dashboard.html:69` empty state) and exactly one row both sort without error
  (trivially, with no visible reordering needed).
- Rapid repeated clicks on one header must not desync the visual indicator from the actual row
  order.
- Sorting the full table (sized for accounts with up to several hundred repositories per
  `specs/github-audit-dashboard/spec.md` criteria 9–10) must not introduce noticeable UI lag given
  the client-side-only, in-memory array sort.
- Narrow/mobile viewports with the table's 20 columns must keep sortable headers usable (e.g. via
  existing/introduced horizontal scroll or responsive layout), without requiring changes to which
  columns exist.

## Prior art and evidence

```json
{
  "prior_art": {
    "found": true,
    "refs": [
      "public/sort.js:2-21",
      "public/dashboard.html:31-39",
      "public/dashboard.html:41-67",
      "public/dashboard.js:148-160",
      "test/sort.test.ts:1-53",
      "public/styles.css",
      "src/app.ts:27-34"
    ],
    "assessment": "A dropdown-and-button sort control already sorts the single repo table by 3 of its 20 columns via a hardcoded accessor map in public/sort.js, with matching tests in test/sort.test.ts; this feature generalizes that into per-column clickable-header sorting across all columns with type-aware (numeric/date/case-insensitive-string) comparison and an active-column indicator, plus a visual restyle of the existing two pages — it is an extension of existing code, not a net-new feature."
  },
  "unverified_claims": [
    { "claim": "The existing color palette in public/styles.css does not currently meet WCAG AA contrast in all cases", "why": "Determining exact contrast ratios requires computing rendered color values against backgrounds (and possibly browser rendering), which is not verifiable by static file reading alone; this spec does not assert current non-compliance, only that no contrast audit exists in the repo and that AA compliance is required going forward." }
  ]
}
```
