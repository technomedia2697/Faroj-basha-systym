# Faroj Basha Restaurant Management System

Internal restaurant operations software for managing orders, products, ingredients, recipes, production, stock movements, and reports.

**Developed by Hexa Plus**  
**Software Engineering & Technical Lead: Eng. Angelo Rezq**

## Technology and architecture

- React 18, Vite, Tailwind CSS, React Router, and React Query
- Express API hosted as a Vercel Serverless Function
- MongoDB Atlas with Mongoose
- JWT authentication and bcrypt password hashing

`frontend` is the project root and the intended Vercel Root Directory. The Express application and MongoDB models are in `server/src`; `api/[...path].js` connects to MongoDB and forwards `/api/*` requests to Express. In local development, the same Express application runs on port 5000 alongside Vite.

## Directory structure

```text
frontend/
├── api/                 Vercel serverless API entry point
├── public/              Restaurant logos and static assets
├── server/
│   ├── src/
│   │   ├── middleware/  Authentication and authorization
│   │   ├── models/      Mongoose schemas
│   │   ├── routes/      Express API routes
│   │   └── scripts/     Initial administrator setup
├── src/                 React application
├── test/                API security smoke tests
├── vercel.json          Vercel build and SPA routing
└── package.json         Unified frontend and API dependencies
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB for local operation, or MongoDB Atlas for deployment

## Local development

1. From this directory, install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `MONGODB_URI` to a development database and `JWT_SECRET` to a unique random value of at least 32 bytes. Never use production data for local or test work.
3. Start the frontend and API:

   ```bash
   npm run dev
   ```

   Vite serves the frontend at `http://localhost:3000`; Express serves the API at `http://localhost:5000`.

Useful commands, all run from `frontend/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Run Vite and the local Express API together |
| `npm run dev:frontend` | Run only Vite (useful when the API is hosted elsewhere) |
| `npm run dev:api` | Run only the local Express API |
| `npm test` | Run isolated API authorization smoke tests |
| `npm run build` | Create the production frontend build |
| `npm start` | Build and run the local API with Vite's production preview |
| `npm run seed-admin` | Create the initial administrator in the configured database |

`npm start` and `npm run dev` require a reachable development MongoDB configured in the project-root `.env`. The seed script additionally requires `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

## Environment variables

Set variables in the project-root `.env` locally and in the Vercel project's Environment Variables for deployment.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string; use a dedicated database user and URL-encode credentials |
| `JWT_SECRET` | Yes | Unique signing secret, at least 32 bytes; never expose it to Vite/client variables |
| `ADMIN_EMAIL` | First admin setup only | Email for the initial administrator |
| `ADMIN_PASSWORD` | First admin setup only | Unique password, 12-72 UTF-8 bytes |
| `ADMIN_NAME` | No | Initial administrator display name |
| `JWT_EXPIRE` | No | Token lifetime; defaults to `24h` |
| `FRONTEND_URL` | Only for an external/custom frontend origin | Exact origin allowed by CORS, e.g. `https://app.example.com` |
| `DELIVERY_FEE_DEFAULT` | No | Default delivery charge; defaults to `0` |
| `NODE_ENV` | Local only | Set to `development`; Vercel configures production automatically |
| `PORT` | Local only | Express port; defaults to `5000` |

All variables and descriptions are maintained in `.env.example`. The application uses same-origin `/api` URLs in deployment. Do not put server secrets in `VITE_*` variables; Vite exposes those values to browsers.

## Database and administrator setup

Use a dedicated development database for local testing and MongoDB Atlas for production. Configure Atlas Network Access and a least-privilege database user. The connection is reused between serverless invocations where the platform instance remains warm.

For the first administrator, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MONGODB_URI`, and `JWT_SECRET` in `.env`, then run:

```bash
npm run seed-admin
```

This is a local maintenance command, not an HTTP endpoint. After the administrator exists, remove the initial password from the runtime environment if it is no longer needed. Public registration is disabled; only an authenticated administrator can create staff accounts through the registration API.

## Vercel deployment

1. Import the project and set **Root Directory** to `frontend`.
2. Configure `MONGODB_URI` and `JWT_SECRET` in Vercel. Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` only when provisioning the initial administrator; do not keep the initial password set after provisioning.
3. Ensure the Atlas database user, network access, and backups are configured.
4. Deploy. Vercel runs `npm run build`, publishes `dist`, serves SPA routes from `index.html`, and routes API function requests through `api/[...path].js`.
5. Verify `/api/health` for liveness and `/api/ready` for MongoDB connectivity, then sign in with the administrator account provisioned in the database.

The repository is configured for deployment, but a deployment is not considered verified until it has been published and its API and database have been tested against the deployment.

## Troubleshooting

- **API returns 503:** Verify Vercel's `MONGODB_URI`, Atlas access rules, and database credentials. `/api/health` does not require the database; `/api/ready` does.
- **Atlas connection is rejected:** Add the current local IP address, and Vercel's outbound access as needed, in Atlas **Network Access / IP Access List**. Keep the database user restricted to the required database and URL-encode credentials in `MONGODB_URI`.
- **JWT errors:** Confirm `JWT_SECRET` is present and consistent across the deployment's functions.
- **Local API will not start:** Confirm the project-root `.env` exists, both required secrets are set, and the configured development MongoDB is reachable.
- **Direct page refresh returns 404:** Confirm the Vercel Root Directory is `frontend` and `vercel.json` is present.
- **Administrator cannot sign in:** Verify the user exists in the configured database and that the deployment uses the intended database.

See [CLIENT_HANDOVER.md](./CLIENT_HANDOVER.md) for client operations guidance and [SECURITY.md](./SECURITY.md) for security configuration.
