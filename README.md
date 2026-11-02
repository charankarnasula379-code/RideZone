# RideZone — Vehicle Rental Booking System

RideZone is a full-stack vehicle-rental demo built with:

- **Frontend:** HTML, CSS, and browser JavaScript in `public/`
- **Backend:** Node.js and Express in `server.js`
- **Database:** MySQL, accessed through `mysql2`
- **Authentication:** bcrypt password hashes and JWT tokens
- **Database setup:** versioned SQL migrations in `database/migrations/`

The Express server serves the frontend and `/api/*` endpoints from the same origin. Do not deploy the `public/` folder by itself when you need login, bookings, admin actions, or database access.

## Requirements

- Node.js 20 or newer
- A MySQL 8-compatible database
- A database/schema already created by your MySQL provider

## Run locally

1. Copy `.env.example` to `.env`.
2. Set the private MySQL connection values in `.env`. For local development, `DB_HOST` is usually `localhost`.
3. Generate a private JWT secret with the command in the environment section below. Fill every required variable; do not leave `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `JWT_SECRET` blank.
4. Create the database once in MySQL, for example:

   ```sql
   CREATE DATABASE ridezone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

5. Install packages:

   ```bash
   npm ci
   ```

6. Start the application:

   ```bash
   npm start
   ```

7. Open `http://localhost:3001`.

On first startup, the server applies the SQL files in `database/migrations/`, creates the required tables, and synchronizes the sample vehicle catalogue. It connects to the database named by `DB_NAME`; it does not create the database itself.

**Use the migration runner as the source of truth.** `database/schema.sql` is retained as a schema reference; do not import it and then run the migrations against the same empty database, because the snapshot includes columns introduced by later migrations.

## First administrator

The application does **not** create a public default administrator account.

Choose one method:

- Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` (at least 12 characters) in the private environment configuration before the first startup; or
- Run `npm run create-admin` locally and follow the prompts.

Do not use a default or shared password. Do not place the real `.env` file or credentials in GitHub.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | HTTP port; the host normally supplies this |
| `DB_HOST` | Yes | MySQL server hostname |
| `DB_PORT` | No | Defaults to `3306` |
| `DB_NAME` | Yes | Existing MySQL database/schema |
| `DB_USER` | Yes | MySQL application user |
| `DB_PASSWORD` | Yes for protected DBs | MySQL application password |
| `DB_SSL` | No | Set `true` for hosted MySQL connections using TLS |
| `DB_SSL_CA` | No | PEM certificate authority text for MySQL TLS verification when the provider requires it |
| `DB_CONNECTION_LIMIT` | No | Defaults to `10` |
| `JWT_SECRET` | Yes | Unique random secret; never reuse a sample |
| `ADMIN_NAME` | Optional | First administrator name |
| `ADMIN_EMAIL` | Optional | First administrator email |
| `ADMIN_PASSWORD` | Optional | First administrator password; minimum 12 characters |

Generate a new JWT secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the required values as **private environment variables in your hosting provider**. Only `.env.example` belongs in Git. Never paste database passwords or the JWT secret into a public repository.

## Deploying online with Vercel

This repository includes `vercel.json` for the existing Express application. Vercel detects the root `server.js` application and runs it as a serverless Express function. The `public/` directory is deployed as static assets.

1. Open [Vercel New Project](https://vercel.com/new).
2. Import `charankarnasula379-code/RideZone` from GitHub.
3. Keep the Root Directory set to the repository root. Vercel should detect Express.
4. Use Node.js 20 or newer. The repository requests Node.js 20+ in `package.json`.
5. Add the required private environment variables in Vercel Project Settings → Environment Variables:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `DB_SSL=true` for hosted MySQL using TLS
   - `DB_SSL_CA` when your MySQL provider supplies a CA certificate
   - `JWT_SECRET` (generate a unique random secret)
   - `DB_CONNECTION_LIMIT=2` initially to limit database connections across serverless instances
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` to provision the first administrator (password must be at least 12 characters)
6. Create the MySQL database/schema named in `DB_NAME` with your database provider before the first deployment.
7. Deploy. On cold start, RideZone applies pending migrations from `database/migrations/`.

Do not paste credentials into GitHub or commit a real `.env` file. Configure them only in Vercel's private environment variable settings. Redeploy after adding or changing environment variables.

### Vercel limitations to understand

- Vercel runs this Express app as a serverless function, not as one permanently running Node process. Function instances can start, stop, and scale independently.
- Vercel's Hobby plan is intended for personal, non-commercial use and includes monthly usage limits.
- Vercel's deployment filesystem is read-only. RideZone uses `/tmp/ridezone-uploads` for uploads on Vercel so the upload endpoint can write, but these files are temporary and can disappear between instances or restarts. Use persistent object storage (for example, Cloudinary or Vercel Blob) before depending on admin image uploads.
- Keep uploaded images and other persistent data out of local function storage. Vehicle images already committed under `public/` are deployed as static assets.
- The external MySQL database is still required; Vercel does not create or host the current MySQL database for this project.
- The in-memory rate limiter is local to an individual function instance and is not a shared global rate limiter.

## Database hosting

Aiven currently offers a free MySQL tier with 1 GB storage, 1 GB RAM, and a 76-connection limit. Free services may be powered off after prolonged inactivity and are not covered by Aiven's 99.99% SLA. Check the provider's current terms before relying on it. The MySQL provider's host, port, database name, username, password, and CA certificate must be configured privately in Vercel.

## Health check

After deployment, open:

- `GET /api/health`

A healthy service responds with `{"status":"ok","database":"connected"}`. If MySQL is unavailable, it responds with HTTP `503`.

## Useful commands

```bash
npm start
npm run db:test
npm run create-admin
npm test
npm run test:qa
```

The test suite is intended for a test environment. Configure a separate test database and test accounts before running tests that create or modify records.

## Important limitations before real production use

- **Payments are demo-only.** The payment screen is labelled as a demo and does not verify a real payment-gateway transaction.
- **Uploaded files are stored on the server filesystem.** Many cloud hosts use temporary filesystems. Add a persistent disk or external object storage before relying on user/profile/vehicle uploads.
- Use a separate database user with only the privileges the application requires. Do not connect the app using the MySQL `root` account.
- Review and change any existing demo administrator account in your database before making the application public.
- Back up the database before applying schema changes to an existing installation.

## Project structure

```text
RideZone/
├── database/
│   ├── migrations/       # Applied in filename order at startup
│   ├── seeds/            # Admin creation and fleet sync utilities
│   ├── schema.sql        # Schema reference
│   └── test_connection.js
├── public/               # Frontend pages, scripts, styles, and assets
├── tests/                # Regression, security, and verification checks
├── uploads/              # Runtime upload directory (not committed)
├── server.js             # Express API and static frontend server
├── package.json
├── package-lock.json
└── .env.example
```
