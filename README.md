# TrioByte Portal — Deploy & Local Setup

Quick guide to make this repository deployable to Vercel and run locally.

**Prerequisites**
- Node.js (v18+ recommended)
- npm
- A Vercel account (for production hosting)

**Environment variables**
- The app uses Supabase. Provide these variables in Vercel Project Settings (Environment Variables) and in a local `.env` file (copy from `.env.example`):
  - `VITE_SUPABASE_URL` — your Supabase project URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
  - `SUPABASE_URL` — (optional) same as VITE_SUPABASE_URL for server-side usage
  - `SUPABASE_PUBLISHABLE_KEY` — (optional) for server-side usage

Note: Vite will replace `import.meta.env.VITE_*` variables at build time. For client-side usage, always set the `VITE_` prefixed variables in Vercel.

**Local development**
1. Copy `.env.example` → `.env` and fill values.
2. Install dependencies:
```bash
npm install
```
3. Start dev server:
```bash
npm run dev
```

**Build & Preview locally**
```bash
npm run build
npm run preview
```

**Vercel deployment (recommended)**
1. Push your repo to GitHub.
2. In Vercel, click "New Project" → import your repository.
3. Ensure the detected framework is `vite`.
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables to Vercel Project Settings (use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at minimum).
5. Deploy — Vercel will run `npm install` and `npm run build` automatically.

**Vercel CLI (alternative)**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**If you hit module resolution errors on Vercel**
- This project uses the `@` path alias mapped to `./src`. We added an explicit alias in `vite.config.ts`. If Vercel still fails, ensure your `vite.config.ts` contains:
```js
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```

**Notes**
- `.vercelignore` already excludes `.env` from the repo; always set secrets in Vercel UI.
- If you use SSH instead of HTTPS for Git remotes, add your SSH key to GitHub and Vercel as needed.

If you want, I can also add a GitHub Actions workflow to run `npm run build` on push and report failures.
