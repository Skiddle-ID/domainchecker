import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { checkRateLimit, getStats, incrementStats, initializeTables } from './db'
import { indexHtml, statsHtml } from './templates'

type Env = {
  DATABASE_URL: string
  DATABASE_AUTH_TOKEN?: string
  dev?: {
    DATABASE_URL: string
    DATABASE_AUTH_TOKEN: string
  }
}

const app = new Hono<{ Bindings: Env }>()

// Constants
const API_ENDPOINT = 'https://check.skiddle.id'
const RATE_LIMIT = {
  MAX_DOMAINS: 1000,
  WINDOW_MINUTES: 10
}
const MAX_DOMAINS_PER_REQUEST = 100

// Helper to get environment variables
function getEnvVars(env: Env) {
  return {
    DATABASE_URL: env.dev?.DATABASE_URL || env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: env.dev?.DATABASE_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN
  }
}

// Initialize database
app.use('*', async (c, next) => {
  try {
    await initializeTables(getEnvVars(c.env))
    await next()
  } catch (error) {
    console.error('Database initialization error:', error)
    // For API endpoints, return error response
    if (c.req.path === '/check' || c.req.path === '/stats/data') {
      return c.json({ 
        error: 'Database error', 
        details: error.message
      }, 500)
    }
    // For other routes (HTML pages), continue without database
    await next()
  }
})

// Middleware
app.use('*', logger())
app.use('*', cors())

// Stats middleware
app.use('*', async (c, next) => {
  if (c.req.method === 'POST' && c.req.path === '/check') {
    try {
      await incrementStats(getEnvVars(c.env), { requests: 1 })
    } catch (error) {
      console.error('Failed to increment stats:', error)
      // Continue even if stats update fails
    }
  }
  await next()
})

// Routes
app.get('/', (c) => {
  return c.html(indexHtml)
})

app.get('/stats', (c) => {
  return c.html(statsHtml)
})

app.get('/stats/data', async (c) => {
  try {
    const stats = await getStats(getEnvVars(c.env))
    return c.json({
      totalRequests: stats.total_requests,
      totalDomainsChecked: stats.total_domains_checked,
      blockedDomains: stats.blocked_domains,
      notBlockedDomains: stats.not_blocked_domains,
      errorDomains: stats.error_domains,
      lastReset: stats.last_reset,
      uniqueUsers: JSON.parse(stats.unique_users)
    })
  } catch (error) {
    console.error('Failed to get stats:', error)
    return c.json({ 
      error: 'Failed to get stats',
      details: error.message
    }, 500)
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
  } catch (error) {
    console.error('Error processing request:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

async function checkBatch(domains: string[]) {
  try {
    const url = new URL(API_ENDPOINT)
    url.searchParams.append('domains', domains.join(','))
    url.searchParams.append('json', 'true')

    const response = await fetch(url.toString(), {
      method: 'GET'
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid API response format')
    }

    return domains.map(domain => {
      try {
        const result = data[domain]
        if (!result || typeof result !== 'object') {
          return {
            originalUrl: domain,
            status: 'Error: Invalid response',
            blocked: false,
            error: true
          }
        }
        return {
          originalUrl: domain,
          status: result.blocked ? 'Blocked' : 'Not Blocked',
          blocked: result.blocked,
          error: false
        }
      } catch (err) {
        console.error(`Error processing domain ${domain}:`, err)
        return {
          originalUrl: domain,
          status: 'Error: Processing failed',
          blocked: false,
          error: true
        }
      }
    })
  } catch (error) {
    console.error('Error checking batch:', error)
    return domains.map(domain => ({
      originalUrl: domain,
      status: 'Error: API request failed',
      blocked: false,
      error: true
    }))
  }
}

// Handle 404
app.notFound((c) => {
  return c.json({
    message: 'Not Found',
    status: 404
  }, 404)
})

// Error handling
app.onError((err, c) => {
  console.error(`${err}`)
  return c.json({
    message: 'Internal Server Error',
    status: 500
  }, 500)
})

export default app