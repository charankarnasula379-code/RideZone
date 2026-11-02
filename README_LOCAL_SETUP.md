# Local setup

Use the main [README.md](README.md) for the full local and deployment instructions.

Quick start:
1. Copy `.env.example` to `.env` and set your MySQL credentials.
2. Create the `ridezone` database once in MySQL.
3. Run `npm ci`.
4. Run `npm start`.
5. Open `http://localhost:3001`.

The server runs migrations automatically. Create an administrator with `npm run create-admin`; there is no default admin password.
