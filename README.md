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

## License

MIT License
