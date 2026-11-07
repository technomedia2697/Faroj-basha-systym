# Faroj Basha — Client Handover

## Delivered

The application includes authenticated restaurant operations screens for:

- Dashboard and stock alerts
- Orders and cashier order workflow
- Ingredients and categories
- Products and recipes
- Production and ingredient consumption
- Stock movements
- Operational reports and spreadsheet/CSV export
- User profile and application settings

Froug Basha remains the product and restaurant brand.

**Developed by Hexa Plus**  
**Software Engineering & Technical Lead: Eng. Angelo Rezq**

## Access and first administrator

There are no shared or preconfigured production credentials. The restaurant owner or assigned administrator should provision the first account using the private `seed-admin` maintenance command against the intended database:

1. Copy `.env.example` to `.env`; configure `MONGODB_URI`, a unique `JWT_SECRET` (at least 32 bytes), `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` (12-72 UTF-8 bytes).
2. From `frontend/`, run `npm run seed-admin`.
3. Store the administrator credentials in the client's approved password manager and remove `ADMIN_PASSWORD` from `.env` and Vercel after initialization.
4. Sign in at the deployed application URL.

New administrator and staff passwords must be at least 12 characters.

Only an authenticated administrator can create staff accounts through the registration API. Do not send passwords in email, chat, source control, or this handover document.

## Hosting and account ownership

The client should own or control:

- The Vercel project and associated domain
- The MongoDB Atlas organization, project, cluster, and database user
- DNS/domain registrar access
- A password manager containing operational administrator credentials

Set Vercel's Root Directory to `frontend`. Configure `MONGODB_URI` and `JWT_SECRET` before deploying. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are needed only while provisioning the first admin. Set `FRONTEND_URL` when the browser frontend is on a custom or separate origin not covered by the Vercel deployment URL.

## Backups and recovery

- Enable Atlas automated backups appropriate to the client's recovery objectives.
- Restrict database access to the application and authorized operators.
- Document the Atlas restore procedure and periodically verify it in a separate environment.
- Never test destructive operations against production data.
- Retain Vercel deployment history and document who can roll back a release.

## Maintenance

- Review dependency updates and `npm audit` regularly; run the documented test and build commands before releases.
- Rotate `JWT_SECRET` after suspected exposure. This invalidates active JWT sessions.
- Rotate administrator credentials through the application's password management procedure.
- Review Atlas users, Vercel team members, and domain access periodically.
- Use a separate development database for QA.

## Known limitations and client actions

- MongoDB persistence and business workflows require a configured database and have not been verified against an isolated database in this environment.
- No Vercel deployment was performed during handover preparation. Code/configuration readiness is separate from a live deployment verification.
- Cashier orders refresh every 5 seconds while the page is visible and on focus/reconnect, with automatic retries after transient failures. This is near-real-time polling, not a WebSocket/push connection.
- Order creation uses a client idempotency key and a database uniqueness constraint to avoid duplicate orders on repeat submissions. Atlas (or another MongoDB replica set) is required for transactional inventory deductions.
- There is no dedicated Expenses module in the current application; its existing operational screens cover orders/sales, products, ingredients, stock, production, and reports.
- The client must supply production-owned Vercel and MongoDB Atlas credentials and approve the initial administrator identity.
