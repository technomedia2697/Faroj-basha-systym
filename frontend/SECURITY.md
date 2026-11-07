# Security Configuration

## Secrets and deployment configuration

Keep server-only settings in the project-root `.env` for local work and in Vercel's protected Environment Variables for deployments:

Required at runtime:
- `MONGODB_URI`
- `JWT_SECRET` (at least 32 bytes)

Optional/setup-only variables are documented in `.env.example`: `JWT_EXPIRE`, `FRONTEND_URL`, `DELIVERY_FEE_DEFAULT`, `NODE_ENV`, `PORT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`. Admin setup uses `ADMIN_PASSWORD` only for `npm run seed-admin`; remove it after initialization.

Never put credentials in `VITE_*` variables, client-side source, documentation, or source control. Local environment files are ignored by Git. Use separate database credentials and secrets for development and production.

## Authentication and authorization

- Passwords are hashed with bcrypt before storage.
- API requests use HS256 signed JWT bearer tokens; the signing secret is validated as at least 32 bytes and has no fallback.
- API routes require a valid token unless intentionally public (health check and login).
- Public account creation is disabled. The registration API requires an administrator token and only creates staff accounts.
- Production creation and status changes require the administrator role.
- Login attempts are limited to 10 per 15-minute window per application instance. This in-memory limit is best-effort in serverless deployments, not a global cap.
- Helmet adds security headers to API responses; Vercel applies a Content Security Policy, HSTS, and related headers to deployed routes. The CSP permits the app's Google Fonts stylesheet and font files.
- New and changed passwords must be at least 12 characters and no more than 72 UTF-8 bytes (bcrypt's input limit).
- Provision the initial administrator with the private `npm run seed-admin` command; there is no public initialization endpoint.
- The client stores its token in browser `localStorage`, so a successful script-injection/XSS could read it. Receipt printing escapes user-controlled HTML; continue avoiding untrusted HTML rendering and consider an HttpOnly-cookie session migration if public-facing content is introduced.

## Database and API

- Use MongoDB Atlas TLS connections and a least-privilege application database user.
- Restrict Atlas network access to approved deployment sources where feasible.
- Do not use production data for integration tests.
- Serverless MongoDB connections are reused within warm function instances, but platform scaling and database limits should be monitored.
- The API does not fall back to a local or embedded database. Database operations return a generic 503 if Atlas cannot be reached or `MONGODB_URI` is missing.
- Order creation and inventory deductions rely on MongoDB transactions, available on Atlas/replica sets; do not enable a non-transactional fallback in production.
- Order submissions accept an `Idempotency-Key`; a unique database index protects against concurrent repeats.
- Vercel and application errors should be monitored without logging secrets, passwords, bearer tokens, or database connection strings.
- Configure a custom `FRONTEND_URL` for an external/custom frontend origin.

## Dependency maintenance

Run `npm audit` from `frontend/`, review direct and transitive issues, and upgrade deliberately. Do not use `npm audit fix --force` without a compatibility review and full validation. Keep the lockfile committed.

## Backups and incident response

- Enable MongoDB Atlas backups and test restore procedures in an isolated environment.
- If a secret is exposed, revoke/rotate it immediately, review database and deployment access, and invalidate sessions by rotating `JWT_SECRET`.
- Preserve relevant Vercel and Atlas audit logs for incident review.

## Security review status

Earlier review identified unauthenticated staff registration and weak role checks on production mutations. Registration is administrator-only, production mutations are administrator-only, and order status operations are limited to administrators and staff. API errors no longer return internal exception messages. The Vercel CSP and receipt HTML escaping address browser-side injection exposure.

The dependency audit is recorded separately in `QA_REPORT.md`; a clean dependency audit and live production deployment must be verified before claiming deployment security readiness.
