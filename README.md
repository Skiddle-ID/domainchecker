# Domain Checker

A Cloudflare Workers application that checks if domains are blocked using the Skiddle ID API.

## Features

- Check multiple domains at once (up to 100 domains per request)
- Rate limiting (1000 domains per 10 minutes per IP)
- Real-time statistics tracking
- Beautiful UI with Tailwind CSS

## Tech Stack

- Cloudflare Workers
- Hono Framework
- Turso Database
- Tailwind CSS
- TypeScript

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run locally:
   ```bash
   npm run dev
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## API Endpoints

- `GET /` - Main page
- `GET /stats` - Statistics page
- `GET /stats/data` - JSON statistics
- `POST /check` - Check domains

---
<!-- License + Copyright -->
<p  align="center">
  <i>© <a href="https://skiddle.id">Skiddle ID</a> 2025</i><br>
  <i>Licensed under <a href="https://gist.github.com/arcestia/dc2bef037daf25773cb972b69d22be09">MIT</a></i>
</p>
