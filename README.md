# Domain Block Checker

A fast and efficient domain block checker built with Cloudflare Workers. Check multiple domains simultaneously and get instant results about their blocking status.

Live demo: [https://nawalacheck.skiddle.id](https://nawalacheck.skiddle.id)

## Features

- ✨ Check multiple domains simultaneously
- 🚀 Real-time results with batch processing
- 📊 Global statistics tracking
- ⚡ Rate limiting for API protection
- 📱 Responsive design with Tailwind CSS
- 🔄 Auto-refreshing statistics page

## Tech Stack

- [Hono](https://hono.dev/) - Ultrafast web framework for Cloudflare Workers
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Cloudflare KV](https://www.cloudflare.com/products/workers-kv/) - Key-value storage
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- TypeScript - Type-safe JavaScript

## Rate Limiting

- Maximum 1000 domains per request
- 10-minute cooldown window
- Automatic reset after window expiration
- Persistent tracking using Cloudflare KV

## Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Skiddle-ID/domainchecker.git
   cd domainchecker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create KV namespaces:
   ```bash
   wrangler kv:namespace create "rate-limit-store"
   wrangler kv:namespace create "stats-store"
   wrangler kv:namespace create "rate-limit-store" --preview
   wrangler kv:namespace create "stats-store" --preview
   ```

4. Update `wrangler.toml` with your KV namespace IDs

5. Run development server:
   ```bash
   npm run dev
   ```

## Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy to Cloudflare Workers:
   ```bash
   wrangler deploy
   ```

## Environment Variables

Configure these in your `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_STORE"
id = "your-rate-limit-store-id"
preview_id = "your-preview-id"

[[kv_namespaces]]
binding = "STATS_STORE"
id = "your-stats-store-id"
preview_id = "your-preview-id"
```

## API Endpoints

- `GET /` - Main domain checker interface
- `GET /stats` - Global statistics dashboard
- `GET /stats/data` - Statistics API endpoint
- `POST /check` - Domain check API endpoint

### Check Domains API

```bash
curl -X POST https://nawalacheck.skiddle.id/check \
  -H "Content-Type: application/json" \
  -d '{"domains":["example.com","example.org"]}'
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

Created by [Skiddle ID](https://github.com/Skiddle-ID)
