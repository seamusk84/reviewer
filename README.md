
# Ireland Estate Reviews — Starter

This is a super-simple Next.js project that contains the Cascading **County → Town → Estate** search with typeahead and a basic "Add estate" suggestion API.

## What you need
- A free GitHub account
- A free Vercel account

## Run it locally (optional)
1. Install Node.js 18+ from nodejs.org.
2. In a terminal:
   ```bash
   npm install
   npm run dev
   ```
3. Visit http://localhost:3000

## Deploy to Vercel (recommended)
1. Create a GitHub repo and push these files (or upload the ZIP directly in GitHub).
2. Go to vercel.com → **New Project** → **Import** your repo → **Deploy**.
3. You’ll get a public URL. Done.

## CSV data
- `public/data/estates.csv` has example rows with **county,town,estate**.
- On the homepage, click **Upload CSV** and select a file in the same format to replace the dataset.

## Suggestions API
- The “Don’t see yours? Add it” modal **POSTs** to `/api/suggestions`.
- In this starter it just logs to the server console.
- On Vercel, you can view logs in the project → **Functions** → **Logs**.
- Later, point it to a real database (e.g., Vercel Postgres, Firebase, Supabase, or Airtable).

## Files to change later
- `app/components/CascadingSearch.tsx`: the widget logic/UI.
- `app/page.tsx`: the homepage that renders it.
- `public/data/estates.csv`: seed data.
