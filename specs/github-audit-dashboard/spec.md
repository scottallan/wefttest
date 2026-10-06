# GitHub Audit Dashboard with OAuth Login — Specification

## 1. What is being built and why

A web application that lets a user sign in with their GitHub account (via GitHub OAuth App web
flow) and view a dashboard that audits their full GitHub footprint: every repository they can
access — public and private, owned and collaborator — along with per-repo metadata and
account-wide aggregate statistics.

The motivation (per the feature description) is to give a GitHub user visibility into their
repository footprint without needing to manually page through the GitHub UI or API: how many
repos they touch, how many are public vs. private, how popular they are (stars/forks), what
languages dominate, and which repos are stale, archived, or disabled. The dashboard is a
read-only reporting surface — it performs no writes to GitHub and does not persist repository
data between sessions; each dashboard load re-fetches live from the GitHub REST API.

This is a net-new feature. The target repository (`wefttest`) currently contains only a
one-line placeholder `README.md` (see `README.md:1-3`: "# wefttest" / "Scratch repository
enrolled in Feature Agent.") and no application code, server, frontend, dependency manifest,
CI config, or tests of any kind. There is nothing to extend or integrate with — this spec
describes a feature built from scratch.

## 2. Scope boundaries — explicitly NOT part of this feature

- No write operations to GitHub repositories: no editing repo settings, no creating/editing
  issues or pull requests, no merging, no branch/webhook management.
- No organization administration: no team management, no org billing, no member/permission
  management.
- No billing or subscription functionality for this application itself.
- No historical trend tracking or time-series storage of repo stats across runs — every
  dashboard load is a fresh, live fetch from GitHub; no database or persistent cache of repo
  statistics between sessions.
- No persistent storage of raw OAuth access tokens outside the user's active session (e.g. no
  token stored in a database, file, or client-side localStorage/cookie readable by JS).
- No GraphQL-based implementation — the GitHub REST API is the specified integration surface.
- No support for GitHub Apps, fine-grained PAT flows, or SSO/SAML-gated orgs beyond what the
  standard OAuth web flow and REST API naturally support.
- No SLA on dashboard load time; "eventually loads" is acceptable even for large accounts, as
  long as pagination completes fully.

## 3. Acceptance criteria

Authentication
1. An unauthenticated visitor sees a "Login with GitHub" entry point that initiates the GitHub
   OAuth App web flow, requesting scopes sufficient to read public and private repository
   metadata (e.g. `repo`, `read:user`).
2. On a successful OAuth callback, the app exchanges the authorization code for an access token
   server-side and establishes a session; the raw access token is stored only in a secure,
   http-only session mechanism (e.g. an encrypted, http-only, secure session cookie or
   server-side session store keyed by an http-only cookie) — never in a token that is readable
   by client-side JavaScript, and never written to a persistent database or disk store beyond
   the session's lifetime.
3. After successful login, the user lands on the dashboard with an established session, with no
   additional manual step required.
4. A logout action clears the session (invalidates/removes the session cookie or server-side
   session record) such that a subsequent reload of the dashboard redirects the user back to the
   login flow rather than showing cached/stale dashboard content.
5. Any request to dashboard or repo-data routes/endpoints without a valid session is rejected and
   the requester is redirected to the login flow (no partial data leakage to unauthenticated
   requests).
6. An OAuth callback that represents a denied-consent or error response from GitHub (e.g. an
   `error` query parameter on the callback) is handled by showing the user a clear error/retry
   state, not a crash or an unhandled server exception.
7. If a session's underlying token is expired or revoked externally while the user is viewing the
   dashboard, the next API call that fails authentication (e.g. GitHub returns 401) results in the
   user being redirected to re-authenticate, not a silent failure or crash.

Repository data collection
8. After login, the app queries the GitHub REST API for all repositories the authenticated user
   can access — public and private, owned and collaborator — paginating through the entire
   result set (not just the first page).
9. Pagination completes fully for accounts with 100+ repositories without requiring any manual
   "load more" / "next page" action from the user, and the implementation must not silently cap
   results at a single page's size (e.g. GitHub's default/max page size).
10. Pagination is exercised correctly for large accounts (500+ repos spanning many pages) — i.e.
    the paging loop must follow continuation correctly (such as GitHub's `Link` header or
    equivalent) rather than assuming a fixed, small number of pages.
11. If a rate-limit response is encountered mid-pagination, the app does not crash or silently
    drop repos; it surfaces to the user that the result set is partial together with the
    remaining-limit/reset-time information (see criteria 16–17), rather than presenting a partial
    list as if it were complete.
12. An account with zero accessible repositories renders a dashboard showing an empty state (zero
    counts in aggregate stats, no repo rows) rather than an error.

Per-repo fields
13. Each listed repository displays, when available from the API: name, owner, description,
    visibility (public/private), primary language, full language breakdown (all languages used
    and their proportions — i.e., a second GitHub API call per repo beyond the repo-list
    response), stars, forks, watchers, open issues count, open pull requests count, repo size,
    default branch, license, archived flag, disabled flag, created date, updated date, last-push
    date, and last commit date.
14. No required field is silently omitted from the UI when the underlying GitHub API response
    contains a value for it.
15. Repos with no license, no description, or no detected primary language display those fields
    as explicitly empty/absent (e.g. "No license", "—", "None detected") rather than omitting the
    field, crashing, or showing a raw `null`/`undefined`.
16. If the per-repo language-breakdown call fails for a given repo, that repo still renders with
    all other fields populated and an explicit indicator that language-breakdown data is
    unavailable for it — a single failed language call does not abort the rest of the dashboard
    render or the other repos' data.
17. Archived and disabled repos are included in the list and correctly show their `archived` and
    `disabled` flags as true, rather than being filtered out or mislabeled.

Aggregate statistics
18. The dashboard displays aggregate summary stats: total repo count, public vs. private repo
    counts, total stars (sum across all listed repos), total forks (sum across all listed repos),
    and a language distribution (e.g. repo count or proportion per language across the account).
19. Aggregate numbers are mathematically consistent with the per-repo rows actually shown — e.g.
    total repo count equals the number of rendered repo rows, public + private counts sum to the
    total, and total stars/forks equal the sum of the corresponding per-repo values currently
    displayed.

Sorting
20. The dashboard supports sorting the repo list by at least: stars, last-updated date, and repo
    size.
21. Each of these three sort dimensions supports both ascending and descending order, and
    triggering a sort reorders the visible rows accordingly (verifiable by comparing adjacent
    rows' values against the selected sort key and direction).

Rate limiting
22. When a GitHub API response indicates the rate limit has been hit or is nearly exhausted (via
    the standard rate-limit response/headers), the app detects this condition and surfaces the
    remaining limit and reset time to the user in the UI, instead of failing silently, showing a
    generic error page, or crashing the request.

Operational
23. `GET /healthz` returns HTTP 200 with a JSON body `{"status":"ok"}` when called with no auth
    cookie or header present — this endpoint is reachable without authentication.
24. GitHub OAuth client id, client secret, and the session-signing/encryption secret are read from
    environment variables; none of these three values are hardcoded in source.

## 4. Prior art and evidence

```json
{
  "prior_art": {
    "found": false,
    "refs": []
  },
  "unverified_claims": []
}
```
