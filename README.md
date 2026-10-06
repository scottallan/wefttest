# GitHub Audit Dashboard

A web application that lets a user sign in with GitHub OAuth and view an audit dashboard
of every repository they can access (public/private, owned/collaborator), with aggregate
statistics, sorting, and graceful GitHub API rate-limit handling.

## Setup

1. Create a GitHub OAuth App at https://github.com/settings/developers with the
   authorization callback URL set to `http://localhost:3000/auth/callback` (or your
   deployed URL).
2. Copy `.env.example` to `.env` and fill in `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   and a random `SESSION_SECRET`.
3. Install dependencies and run:

   ```
   npm install
   npm run dev
   ```

4. Visit `http://localhost:3000`.

## Testing

```
npm test
```

## Operational notes

- `GET /healthz` returns `200 {"status":"ok"}` without requiring authentication.
- Access tokens live only in the server-side session (http-only, signed cookie); they
  are never persisted to disk/DB or exposed to client-side JavaScript.
- Each dashboard load re-fetches live from the GitHub REST API; nothing is cached
  between sessions.
