import 'dotenv/config';
import app from '../server/app.js';

// Vercel serverless entry: this single function handles every /api/*
// request (see vercel.json rewrites) by delegating to the same Express
// app used for local dev and Render. The DB connection is established
// lazily per-request (server/app.js), cached across warm invocations
// (server/db.js) — there's no persistent process here to connect once at
// startup like server/index.js does.
export default app;
