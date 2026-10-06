# Configurable Listen Port via Environment Variable

## What is being built and why

The HTTP server's listen port must be controlled by a `PORT` environment variable instead
of (or in addition to) a hardcoded value, so operators can run the app on different ports
across environments (local dev, CI, staging, production/PaaS) without editing source code.
When `PORT` is absent, the app must keep working out of the box with a sensible default.
When `PORT` is present but not a usable port number, the app must refuse to start and say
why, rather than silently falling back to a default or binding somewhere unexpected — a
wrong silent bind is a harder failure to diagnose than a crash with a clear message.

### Prior art already in this repository (see evidence below)

The repository **already implements most of this feature**:

- `src/config.ts:28` reads `process.env.PORT`, converts it with `Number(...)`, and falls
  back to `3000` via `|| 3000`. This already centralizes port resolution in the config
  module alongside `githubClientId`, `githubClientSecret`, `sessionSecret`, etc.
  (`src/config.ts:9-18`), satisfying the "read through the existing centralized config
  module" requirement.
- `src/server.ts:7-12` calls `loadConfig()`, passes `config.port` to `app.listen(...)`, and
  logs `` `GitHub audit dashboard listening on port ${config.port}` `` in the listen
  callback — satisfying the "log which port it is listening on" requirement.
- `.env.example:11` already documents `PORT=3000` alongside `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET`.
- `src/routes/healthz.ts:3-9` defines `GET /healthz` returning `200 {"status":"ok"}`, and
  `test/healthz.test.ts:5-18` already exercises it (though not yet parameterized over a
  custom `PORT`).

**What this feature actually needs to add is the remaining gap**, not a from-scratch
implementation:

1. **Fail-fast validation of an invalid `PORT`.** Today, `Number(process.env.PORT) || 3000`
   (`src/config.ts:28`) silently falls back to `3000` for non-numeric values (e.g.
   `PORT=abc` → `NaN || 3000` → `3000`) and for `PORT=0` (`0 || 3000` → `3000`), and
   silently *accepts* out-of-range or negative values with no bounds check at all (e.g.
   `PORT=70000` → `70000`, `PORT=-5` → `-5`, both passed straight to `app.listen`). None of
   these match the required behavior of a clear, fail-fast startup error for non-numeric,
   `<=0`, or `>65535` values.
2. **README documentation of `PORT`.** `README.md` currently tells the user to copy
   `.env.example` and fill in `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and
   `SESSION_SECRET` (`README.md:9-13`), and separately documents the default port only
   implicitly via the callback URL/`http://localhost:3000` (`README.md:9-21`). `PORT` is
   not mentioned in `README.md` at all.
3. **Test coverage for the above.** No test file in `test/` targets `src/config.ts`'s port
   resolution/validation logic, and `test/healthz.test.ts` does not exercise a custom
   `PORT` value end-to-end.

This spec scopes the feature to closing that gap while leaving the already-correct parts
(centralized reading, default fallback value of `3000`, startup logging) intact.

## Acceptance criteria

1. **Valid custom port.** Starting the app with `PORT=8080` set causes the HTTP server to
   listen on port 8080. A `GET /healthz` request against port 8080 returns HTTP 200 with
   JSON body `{"status":"ok"}`.
2. **Unset falls back to default.** Starting the app with `PORT` unset (or set to an empty
   string) causes the server to listen on the documented default port, `3000`, with no
   startup error.
3. **Non-numeric value fails fast.** Starting the app with `PORT=abc` causes the process to
   exit before the server binds to any port, with an error message that names `PORT` as the
   problem (e.g. identifies the invalid value and that it must be a valid port number). It
   must not fall back to the default and must not bind to any port.
4. **Zero or negative value fails fast.** Starting the app with `PORT=0` or `PORT=-5` causes
   the same fail-fast behavior as (3): a descriptive error naming `PORT`, no binding, no
   silent fallback to the default.
5. **Out-of-range value fails fast.** Starting the app with `PORT=70000` (or any value
   `> 65535`) causes the same fail-fast behavior as (3).
6. **Centralized resolution.** Port resolution and validation happen inside `src/config.ts`
   (the existing `loadConfig`/`Config` module used for `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, etc.), not read or validated ad hoc at the
   `app.listen` call site or elsewhere.
7. **Startup logging.** When the server starts successfully, it logs (e.g. to stdout) a
   message that includes the resolved port number.
8. **Documentation.** `PORT` is documented in the same place(s) `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` are documented — at minimum in `README.md`'s
   setup instructions, and it continues to appear in `.env.example` with its default value.
9. **No unrelated behavior change.** Host/interface binding, TLS/HTTPS configuration, and
   all other application behavior are unchanged; only port resolution/validation and its
   documentation are affected.

## Scope boundaries (non-goals)

- No change to which host/interface the server binds to (e.g. `0.0.0.0` vs `localhost`) —
  host binding is out of scope.
- No HTTPS/TLS configuration changes.
- No change to application behavior other than resolving and validating the listen port and
  documenting it.
- No change to the default port value (remains `3000`) unless required to fix the
  fail-fast validation gap described above.
- No general overhaul of `src/config.ts`'s validation framework for other environment
  variables — only `PORT` validation is in scope.
- No changes to deployment/infrastructure configuration (e.g. Dockerfiles, process
  managers) beyond what's needed for the app itself to honor `PORT`.

## Prior art and evidence

```json
{
  "prior_art": {
    "found": true,
    "refs": ["src/config.ts:28", "src/server.ts:7-12", ".env.example:11", "src/routes/healthz.ts:3-9", "test/healthz.test.ts:5-18", "README.md:9-13"],
    "assessment": "The app already reads PORT through the centralized config module with a working default of 3000 and logs the resolved port on startup; the remaining gap is fail-fast validation for non-numeric/out-of-range/<=0 PORT values (currently silently falls back or accepts bad values), README documentation of PORT, and test coverage for both."
  },
  "unverified_claims": []
}
```
