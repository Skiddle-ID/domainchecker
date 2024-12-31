import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { checkBatch } from './checker'
import { initializeTables, getStats, getDailyStats, incrementStats, checkRateLimit, checkRateLimitsTable } from './db'
import { indexHtml, statsHtml } from './templates'

type Bindings = {
  DATABASE_URL: string
  DATABASE_AUTH_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Constants
const RATE_LIMIT = {
  MAX_DOMAINS: 1000,
  WINDOW_MINUTES: 10
}

const MAX_DOMAINS_PER_REQUEST = 100

// Middleware
app.use('*', logger())
app.use('*', cors())

// Initialize database tables
app.all('*', async (c, next) => {
  try {
    await initializeTables(c.env)
  } catch (error: unknown) {
    console.error('Database initialization error:', error instanceof Error ? error.message : error)
  }
  await next()
})

// Routes
app.get('/', (c) => {
  return new Response(indexHtml, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  })
})

app.get('/stats', (c) => {
  return new Response(statsHtml, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  })
})

app.get('/stats/data', async (c) => {
  try {
    const [stats, dailyStats] = await Promise.all([
      getStats(c.env),
      getDailyStats(c.env, 30)  // Get last 30 days
    ])

    return c.json({
      totalRequests: stats.total_requests,
      totalDomainsChecked: stats.total_domains_checked,
      blockedDomains: stats.blocked_domains,
      notBlockedDomains: stats.not_blocked_domains,
      errorDomains: stats.error_domains,
      lastReset: stats.last_reset,
      uniqueUsers: Number(stats.unique_users),
      dailyStats: dailyStats.map(day => ({
        date: day.date,
        totalRequests: day.total_requests,
        totalDomainsChecked: day.total_domains_checked,
        blockedDomains: day.blocked_domains,
        notBlockedDomains: day.not_blocked_domains,
        errorDomains: day.error_domains
      }))
    })
  } catch (error: unknown) {
    console.error('Failed to get stats:', error instanceof Error ? error.message : error)
    return c.json({ error: 'Failed to get stats' }, 500)
  }
})

app.get('/debug/rate-limits', async (c) => {
  try {
    await checkRateLimitsTable(c.env)
    return c.json({ message: 'Check logs for rate_limits table details' })
  } catch (error: unknown) {
    console.error('Debug endpoint error:', error instanceof Error ? error.message : error)
    return c.json({ error: 'Failed to check rate_limits' }, 500)
  }
})

app.post('/check', async (c) => {
  const body = await c.req.json()
  const domains = body.domains || []
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'

  if (!Array.isArray(domains)) {
    return c.json({ error: 'Invalid request: domains must be an array' }, 400)
  }

  // Check total number of domains first
  if (domains.length > MAX_DOMAINS_PER_REQUEST) {
    return c.json({ error: `Maximum ${MAX_DOMAINS_PER_REQUEST} domains per request` }, 400)
  }

  try {
    // Check rate limit
    const rateLimit = await checkRateLimit(c.env, ip, domains.length, RATE_LIMIT.MAX_DOMAINS, RATE_LIMIT.WINDOW_MINUTES)
    if (!rateLimit.allowed) {
      return c.json({
        error: 'Rate limit exceeded',
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
      }, 429)
    }

    // Process domains in batches
    const results = []
    const batchSize = 30
    let processed = 0
    let blocked = 0
    let notBlocked = 0
    let errors = 0

    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize)
      const batchResults = await checkBatch(batch)
      
      for (const result of batchResults) {
        processed++
        if (result.error) {
          errors++
        } else if (result.blocked) {
          blocked++
        } else {
          notBlocked++
        }
      }
      
      results.push(...batchResults)
    }

    // Update stats
    await incrementStats(c.env, {
      requests: 1,
      domainsChecked: processed,
      blocked,
      notBlocked,
      errors
    })

    return c.json({ 
      results,
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime
    })
  } catch (error: unknown) {
    console.error('Error processing request:', error instanceof Error ? error.message : error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app