import { createClient } from '@libsql/client'

let client: ReturnType<typeof createClient> | null = null

// We'll initialize the client in a function that takes the environment variables
export function initializeDbClient(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }) {
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
  } catch (error) {
    console.error('Failed to initialize database client:', error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
}

// Initialize tables
export async function initializeTables(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }) {
  console.log('Initializing tables...')
  const client = initializeDbClient(env)
  
  try {
    console.log('Creating stats table...')
    await client.execute(`
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
    `)
    console.log('Stats table created successfully')

    // Initialize default stats if not exists
    const statsResult = await client.execute('SELECT id FROM stats WHERE id = "global"')
    if (!statsResult.rows[0]) {
      console.log('Initializing default stats...')
      const now = Date.now()
      await client.execute(`
        INSERT INTO stats (
          id, total_requests, total_domains_checked, blocked_domains,
          not_blocked_domains, error_domains, last_reset, unique_users
        ) VALUES (
          "global", 0, 0, 0, 0, 0, ${now}, "[]"
        )
      `)
      console.log('Default stats initialized')
    }

    console.log('Creating rate_limits table...')
    await client.execute(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip TEXT PRIMARY KEY,
        count INTEGER,
        timestamp INTEGER,
        UNIQUE(ip)
      )
    `)
    console.log('Rate limits table created successfully')
  } catch (error) {
    console.error('Failed to initialize tables:', error)
    throw error
  }
}

// Stats functions
export async function getStats(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }) {
  console.log('Getting stats...')
  const client = initializeDbClient(env)
  
  const defaultStats = {
    id: 'global',
    total_requests: 0,
    total_domains_checked: 0,
    blocked_domains: 0,
    not_blocked_domains: 0,
    error_domains: 0,
    last_reset: Date.now(),
    unique_users: '[]'
  }

  try {
    const result = await client.execute('SELECT * FROM stats WHERE id = "global"')
    
    if (!result.rows[0]) {
      console.log('No stats found, initializing with default values...')
      const now = Date.now()
      await client.execute(`
        INSERT INTO stats (
          id, total_requests, total_domains_checked, blocked_domains,
          not_blocked_domains, error_domains, last_reset, unique_users
        ) VALUES (
          "global", 0, 0, 0, 0, 0, '${now}', '[]'
        )
      `)
      console.log('Default stats initialized successfully')
      return defaultStats
    }

    const stats = result.rows[0]
    console.log('Stats retrieved successfully:', stats)
    
    // Ensure all fields have valid values
    return {
      id: stats.id || defaultStats.id,
      total_requests: Number(stats.total_requests) || defaultStats.total_requests,
      total_domains_checked: Number(stats.total_domains_checked) || defaultStats.total_domains_checked,
      blocked_domains: Number(stats.blocked_domains) || defaultStats.blocked_domains,
      not_blocked_domains: Number(stats.not_blocked_domains) || defaultStats.not_blocked_domains,
      error_domains: Number(stats.error_domains) || defaultStats.error_domains,
      last_reset: Number(stats.last_reset) || defaultStats.last_reset,
      unique_users: stats.unique_users || defaultStats.unique_users
    }
  } catch (error) {
    console.error('Error getting stats:', error)
    throw new Error(`Failed to get stats: ${error.message}`)
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

  if (stats.requests) {
    updates.push(`total_requests = total_requests + ${stats.requests}`)
  }

  if (stats.domainsChecked) {
    updates.push(`total_domains_checked = total_domains_checked + ${stats.domainsChecked}`)
  }

  if (stats.blocked) {
    updates.push(`blocked_domains = blocked_domains + ${stats.blocked}`)
  }

  if (stats.notBlocked) {
    updates.push(`not_blocked_domains = not_blocked_domains + ${stats.notBlocked}`)
  }

  if (stats.errors) {
    updates.push(`error_domains = error_domains + ${stats.errors}`)
  }

  if (updates.length > 0) {
    try {
      // First ensure the stats row exists
      const result = await client.execute('SELECT id FROM stats WHERE id = "global"')
      if (!result.rows[0]) {
        console.log('Stats row does not exist, creating it...')
        const now = Date.now()
        await client.execute(`
          INSERT INTO stats (
            id, total_requests, total_domains_checked, blocked_domains,
            not_blocked_domains, error_domains, last_reset, unique_users
          ) VALUES (
            "global", 0, 0, 0, 0, 0, ${now}, "[]"
          )
        `)
      }

      // Then update the stats
      const updateQuery = `
        UPDATE stats 
        SET ${updates.join(', ')}
        WHERE id = "global"
      `
      console.log('Executing update query:', updateQuery)
      await client.execute(updateQuery)
      console.log('Stats incremented successfully')
    } catch (error) {
      console.error('Error incrementing stats:', error)
      throw new Error(`Failed to increment stats: ${error.message}`)
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
) {
  console.log('Checking rate limit for IP:', ip)
  const client = initializeDbClient(env)
  const now = Date.now()
  const windowStart = now - (windowMinutes * 60 * 1000)

  try {
    // Clean up old rate limits first
    await client.execute(`DELETE FROM rate_limits WHERE timestamp < ${windowStart}`)

    // Get current usage
    const result = await client.execute(`
      SELECT count, timestamp 
      FROM rate_limits 
      WHERE ip = "${ip}"
    `)
    const usage = result.rows[0]

    if (!usage) {
      if (domainCount > maxDomains) {
        console.log('Rate limit exceeded for new IP')
        return {
          allowed: false,
          remaining: maxDomains,
          resetTime: now + (windowMinutes * 60 * 1000)
        }
      }

      await client.execute(`
        INSERT INTO rate_limits (ip, count, timestamp) 
        VALUES ("${ip}", ${domainCount}, ${now})
      `)
      console.log('Rate limit initialized successfully')

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

    await client.execute(`
      UPDATE rate_limits 
      SET count = ${totalCount}, timestamp = ${now} 
      WHERE ip = "${ip}"
    `)
    console.log('Rate limit updated successfully')

    return {
      allowed: true,
      remaining: maxDomains - totalCount,
      resetTime: now + (windowMinutes * 60 * 1000)
    }
  } catch (error) {
    console.error('Error checking rate limit:', error)
    // On error, allow the request but return a conservative remaining count
    return {
      allowed: true,
      remaining: maxDomains - domainCount,
      resetTime: now + (windowMinutes * 60 * 1000)
    }
  }
}
