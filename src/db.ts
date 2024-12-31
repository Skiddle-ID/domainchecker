import { createClient, Client } from '@libsql/client'

interface Stats {
  id: string
  total_requests: number
  total_domains_checked: number
  blocked_domains: number
  not_blocked_domains: number
  error_domains: number
  last_reset: number
  unique_users: string
}

interface DailyStats {
  date: string
  total_requests: number
  total_domains_checked: number
  blocked_domains: number
  not_blocked_domains: number
  error_domains: number
}

interface RateLimit {
  ip: string
  count: number
  timestamp: number
}

let client: Client | null = null

export function initializeDbClient(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }): Client {
  if (client) return client

  console.log('Initializing database client with:', {
    url: env.DATABASE_URL,
    hasAuthToken: !!env.DATABASE_AUTH_TOKEN
  })

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  if (!env.DATABASE_AUTH_TOKEN) {
    throw new Error('DATABASE_AUTH_TOKEN is required')
  }

  try {
    client = createClient({
      url: env.DATABASE_URL,
      authToken: env.DATABASE_AUTH_TOKEN
    })
    console.log('Database client created successfully')
    return client
  } catch (error: unknown) {
    console.error('Failed to initialize database client:', error instanceof Error ? error.message : error)
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Initialize tables
export async function initializeTables(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }) {
  console.log('Initializing tables...')
  const client = initializeDbClient(env)
  
  try {
    console.log('Creating stats table...')
    await client.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS stats (
          id TEXT PRIMARY KEY,
          total_requests INTEGER DEFAULT 0,
          total_domains_checked INTEGER DEFAULT 0,
          blocked_domains INTEGER DEFAULT 0,
          not_blocked_domains INTEGER DEFAULT 0,
          error_domains INTEGER DEFAULT 0,
          last_reset INTEGER,
          unique_users TEXT
        )
      `,
      args: []
    })
    console.log('Stats table created successfully')

    // Initialize default stats if not exists
    const statsResult = await client.execute({
      sql: 'SELECT id FROM stats WHERE id = "global"',
      args: []
    })
    if (!statsResult.rows[0]) {
      console.log('Initializing default stats...')
      const now = Date.now()
      await client.execute({
        sql: `
          INSERT INTO stats (
            id, total_requests, total_domains_checked, blocked_domains,
            not_blocked_domains, error_domains, last_reset, unique_users
          ) VALUES (
            "global", 0, 0, 0, 0, 0, ?, "[]"
          )
        `,
        args: [now]
      })
      console.log('Default stats initialized')
    }

    console.log('Creating rate_limits table...')
    await client.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS rate_limits (
          ip TEXT PRIMARY KEY,
          count INTEGER,
          timestamp INTEGER,
          UNIQUE(ip)
        )
      `,
      args: []
    })
    console.log('Rate limits table created successfully')

    console.log('Creating daily_stats table...')
    await client.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS daily_stats (
          date TEXT PRIMARY KEY,
          total_requests INTEGER DEFAULT 0,
          total_domains_checked INTEGER DEFAULT 0,
          blocked_domains INTEGER DEFAULT 0,
          not_blocked_domains INTEGER DEFAULT 0,
          error_domains INTEGER DEFAULT 0
        )
      `,
      args: []
    })
    console.log('Daily stats table created successfully')
  } catch (error: unknown) {
    console.error('Failed to initialize tables:', error instanceof Error ? error.message : error)
    throw error
  }
}

// Debug function to check rate_limits table
export async function checkRateLimitsTable(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }) {
  console.log('Checking rate_limits table...')
  const client = initializeDbClient(env)
  
  try {
    // Check if table exists
    const tableCheck = await client.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'`,
      args: []
    })
    console.log('Table exists check:', tableCheck.rows)

    if (tableCheck.rows.length > 0) {
      // Get all entries
      const entries = await client.execute({
        sql: 'SELECT * FROM rate_limits',
        args: []
      })
      console.log('Rate limits entries:', entries.rows)

      // Get count of unique IPs
      const uniqueCount = await client.execute({
        sql: 'SELECT COUNT(DISTINCT ip) as count FROM rate_limits',
        args: []
      })
      console.log('Unique IPs count:', uniqueCount.rows[0]?.count)
    } else {
      console.log('rate_limits table does not exist!')
    }
  } catch (error: unknown) {
    console.error('Error checking rate_limits table:', error instanceof Error ? error.message : error)
  }
}

// Stats functions
export async function getStats(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }): Promise<Stats> {
  console.log('Getting stats...')
  const client = initializeDbClient(env)
  
  const defaultStats: Stats = {
    id: 'global',
    total_requests: 0,
    total_domains_checked: 0,
    blocked_domains: 0,
    not_blocked_domains: 0,
    error_domains: 0,
    last_reset: Date.now(),
    unique_users: '0'
  }

  try {
    // First get unique users count
    const uniqueUsersResult = await client.execute({
      sql: 'SELECT COUNT(DISTINCT ip) as unique_count FROM rate_limits WHERE ip != "unknown"',
      args: []
    })
    const uniqueUsersCount = Number(uniqueUsersResult.rows[0]?.unique_count) || 0
    console.log('Unique users count:', uniqueUsersCount)

    // Then get stats
    const statsResult = await client.execute({
      sql: 'SELECT * FROM stats WHERE id = "global"',
      args: []
    })

    // If no stats or unique_users is empty, reset the stats table
    if (!statsResult.rows[0] || !statsResult.rows[0].unique_users) {
      console.log('Stats need to be reset')
      await resetStats(client, uniqueUsersCount)
      return {
        ...defaultStats,
        unique_users: String(uniqueUsersCount)
      }
    }

    // Update unique_users in stats table
    await client.execute({
      sql: 'UPDATE stats SET unique_users = ? WHERE id = "global"',
      args: [String(uniqueUsersCount)]
    })
    console.log('Updated unique_users in stats table')

    const row = statsResult.rows[0]
    console.log('Stats retrieved successfully:', row)
    
    // Return stats with current unique users count
    return {
      id: String(row.id) || defaultStats.id,
      total_requests: Number(row.total_requests) || defaultStats.total_requests,
      total_domains_checked: Number(row.total_domains_checked) || defaultStats.total_domains_checked,
      blocked_domains: Number(row.blocked_domains) || defaultStats.blocked_domains,
      not_blocked_domains: Number(row.not_blocked_domains) || defaultStats.not_blocked_domains,
      error_domains: Number(row.error_domains) || defaultStats.error_domains,
      last_reset: Number(row.last_reset) || defaultStats.last_reset,
      unique_users: String(uniqueUsersCount)
    }
  } catch (error: unknown) {
    console.error('Error getting stats:', error instanceof Error ? error.message : error)
    throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function resetStats(client: Client, uniqueUsersCount: number) {
  console.log('Resetting stats table...')
  const now = Date.now()
  
  try {
    await client.execute({
      sql: 'DROP TABLE IF EXISTS stats',
      args: []
    })
    
    await client.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS stats (
          id TEXT PRIMARY KEY,
          total_requests INTEGER DEFAULT 0,
          total_domains_checked INTEGER DEFAULT 0,
          blocked_domains INTEGER DEFAULT 0,
          not_blocked_domains INTEGER DEFAULT 0,
          error_domains INTEGER DEFAULT 0,
          last_reset INTEGER,
          unique_users TEXT
        )
      `,
      args: []
    })

    await client.execute({
      sql: `
        INSERT INTO stats (
          id, total_requests, total_domains_checked, blocked_domains,
          not_blocked_domains, error_domains, last_reset, unique_users
        ) VALUES (
          "global", 0, 0, 0, 0, 0, ?, ?
        )
      `,
      args: [now, String(uniqueUsersCount)]
    })
    console.log('Stats table reset successfully')
  } catch (error) {
    console.error('Error resetting stats:', error)
    throw error
  }
}

export async function getDailyStats(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }, days: number = 30): Promise<DailyStats[]> {
  console.log('Getting daily stats...')
  const client = initializeDbClient(env)
  
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM daily_stats 
        WHERE date >= date('now', '-${days} days') 
        ORDER BY date ASC
      `,
      args: []
    })

    return result.rows as DailyStats[]
  } catch (error: unknown) {
    console.error('Error getting daily stats:', error instanceof Error ? error.message : error)
    throw new Error(`Failed to get daily stats: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function incrementStats(
  env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string },
  stats: {
    requests?: number
    domainsChecked?: number
    blocked?: number
    notBlocked?: number
    errors?: number
  }
) {
  console.log('Incrementing stats with:', stats)
  const client = initializeDbClient(env)
  const updates = []
  const values: (number)[] = []

  if (stats.requests) {
    updates.push('total_requests = total_requests + ?')
    values.push(stats.requests)
  }

  if (stats.domainsChecked) {
    updates.push('total_domains_checked = total_domains_checked + ?')
    values.push(stats.domainsChecked)
  }

  if (stats.blocked) {
    updates.push('blocked_domains = blocked_domains + ?')
    values.push(stats.blocked)
  }

  if (stats.notBlocked) {
    updates.push('not_blocked_domains = not_blocked_domains + ?')
    values.push(stats.notBlocked)
  }

  if (stats.errors) {
    updates.push('error_domains = error_domains + ?')
    values.push(stats.errors)
  }

  if (updates.length > 0) {
    try {
      // First ensure the stats row exists
      const result = await client.execute({
        sql: 'SELECT id FROM stats WHERE id = "global"',
        args: []
      })
      if (!result.rows[0]) {
        console.log('Stats row does not exist, creating it...')
        const now = Date.now()
        await client.execute({
          sql: `
            INSERT INTO stats (
              id, total_requests, total_domains_checked, blocked_domains,
              not_blocked_domains, error_domains, last_reset, unique_users
            ) VALUES (
              "global", 0, 0, 0, 0, 0, ?, "[]"
            )
          `,
          args: [now]
        })
      }

      // Then update the stats
      await client.execute({
        sql: `UPDATE stats SET ${updates.join(', ')} WHERE id = "global"`,
        args: values
      })
      console.log('Stats incremented successfully')

      // Update daily stats
      const today = new Date().toISOString().split('T')[0]
      await client.execute({
        sql: `
          INSERT INTO daily_stats (
            date, total_requests, total_domains_checked, 
            blocked_domains, not_blocked_domains, error_domains
          ) 
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET
            total_requests = total_requests + excluded.total_requests,
            total_domains_checked = total_domains_checked + excluded.total_domains_checked,
            blocked_domains = blocked_domains + excluded.blocked_domains,
            not_blocked_domains = not_blocked_domains + excluded.not_blocked_domains,
            error_domains = error_domains + excluded.error_domains
        `,
        args: [
          today,
          stats.requests || 0,
          stats.domainsChecked || 0,
          stats.blocked || 0,
          stats.notBlocked || 0,
          stats.errors || 0
        ]
      })
      console.log('Daily stats updated successfully')
    } catch (error: unknown) {
      console.error('Error incrementing stats:', error instanceof Error ? error.message : error)
      throw new Error(`Failed to increment stats: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// Rate limit functions
export async function checkRateLimit(
  env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string },
  ip: string,
  domainCount: number,
  maxDomains: number,
  windowMinutes: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  console.log('Checking rate limit for IP:', ip)
  const client = initializeDbClient(env)
  const now = Date.now()
  const windowStart = now - (windowMinutes * 60 * 1000)

  try {
    // Get current usage
    const result = await client.execute({
      sql: 'SELECT count, timestamp FROM rate_limits WHERE ip = ?',
      args: [ip]
    })
    const usage = result.rows[0] as RateLimit | undefined

    if (!usage) {
      if (domainCount > maxDomains) {
        console.log('Rate limit exceeded for new IP')
        return {
          allowed: false,
          remaining: maxDomains,
          resetTime: now + (windowMinutes * 60 * 1000)
        }
      }

      await client.execute({
        sql: 'INSERT INTO rate_limits (ip, count, timestamp) VALUES (?, ?, ?)',
        args: [ip, domainCount, now]
      })
      console.log('Rate limit initialized successfully')

      return {
        allowed: true,
        remaining: maxDomains - domainCount,
        resetTime: now + (windowMinutes * 60 * 1000)
      }
    }

    // Check if the last request was more than window minutes ago
    if (Number(usage.timestamp) < windowStart) {
      // Reset count if window has elapsed
      if (domainCount > maxDomains) {
        console.log('Rate limit exceeded for new window')
        return {
          allowed: false,
          remaining: maxDomains,
          resetTime: now + (windowMinutes * 60 * 1000)
        }
      }

      await client.execute({
        sql: 'UPDATE rate_limits SET count = ?, timestamp = ? WHERE ip = ?',
        args: [domainCount, now, ip]
      })
      console.log('Rate limit reset for new window')

      return {
        allowed: true,
        remaining: maxDomains - domainCount,
        resetTime: now + (windowMinutes * 60 * 1000)
      }
    }

    const totalCount = Number(usage.count) + domainCount
    if (totalCount > maxDomains) {
      console.log('Rate limit exceeded for existing IP')
      return {
        allowed: false,
        remaining: maxDomains - Number(usage.count),
        resetTime: Number(usage.timestamp) + (windowMinutes * 60 * 1000)
      }
    }

    await client.execute({
      sql: 'UPDATE rate_limits SET count = ?, timestamp = ? WHERE ip = ?',
      args: [totalCount, now, ip]
    })
    console.log('Rate limit updated successfully')

    return {
      allowed: true,
      remaining: maxDomains - totalCount,
      resetTime: now + (windowMinutes * 60 * 1000)
    }
  } catch (error: unknown) {
    console.error('Error checking rate limit:', error instanceof Error ? error.message : error)
    // On error, allow the request but return a conservative remaining count
    return {
      allowed: true,
      remaining: maxDomains - domainCount,
      resetTime: now + (windowMinutes * 60 * 1000)
    }
  }
}
