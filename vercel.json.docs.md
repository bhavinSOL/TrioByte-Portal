# Vercel Deployment Configuration

This project is configured for Vercel deployment. Here's what's set up:

## Configuration Files

### `vercel.json`
- **buildCommand**: `npm run build` - Uses Vite to build the project
- **outputDirectory**: `dist` - Static files are output to the `dist` folder
- **framework**: `vite` - Configured for Vite framework
- **devCommand**: `npm run dev` - Development server command for preview deployments
- **cleanUrls**: `true` - Removes `.html` extension from URLs
- **headers**: Security headers and caching rules for assets

### `.vercelignore`
Excludes unnecessary files from being uploaded to Vercel, reducing deployment size and time.

## Environment Variables

Set these in your Vercel project settings:

1. `VITE_SUPABASE_URL` - Your Supabase project URL
2. `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase publishable key
3. `VITE_SUPABASE_PROJECT_ID` - Your Supabase project ID

Reference: `.env.example` for all required environment variables

## Deployment Steps

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Vercel will automatically detect the Vite configuration
4. Push to your main branch to trigger deployment

## Features

- ✅ Single Page Application (SPA) routing with TanStack Router
- ✅ Vite build optimization
- ✅ Client-side routing with rewrite to `/index.html`
- ✅ Security headers configured
- ✅ Optimized asset caching
- ✅ Environment variables support

## Local Testing

Before deploying:

```bash
npm run build
npm run preview
```

This builds and previews your site locally as it will appear on Vercel.
