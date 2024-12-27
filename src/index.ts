import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Context } from 'hono'

type Bindings = {
  RATE_LIMIT_STORE: KVNamespace
  STATS_STORE: KVNamespace
}

type RateLimitData = {
  count: number
  timestamp: number
}

type StatsData = {
  totalRequests: number
  totalDomainsChecked: number
  uniqueUsers: string[]
  blockedDomains: number
  notBlockedDomains: number
  errorDomains: number
  lastReset: number
}

const app = new Hono<{ Bindings: Bindings }>()

// Constants
const API_ENDPOINT = 'https://check.skiddle.id'
const BATCH_SIZE = 30
const RATE_LIMIT = {
  MAX_DOMAINS: 1000,
  WINDOW_MINUTES: 10
}

// In-memory cache
let statsCache: StatsData | null = null
let rateLimitCache: { [key: string]: RateLimitData } = {}

// Middleware
app.use('*', logger())
app.use('*', cors())

// Initialize stats if not exists
async function initializeStats(c: Context<Bindings>): Promise<StatsData> {
  if (statsCache) {
    return statsCache
  }
  const stats = await c.env.STATS_STORE.get('global_stats')
  if (!stats) {
    const initialStats: StatsData = {
      totalRequests: 0,
      totalDomainsChecked: 0,
      uniqueUsers: [],
      blockedDomains: 0,
      notBlockedDomains: 0,
      errorDomains: 0,
      lastReset: Date.now()
    }
    await c.env.STATS_STORE.put('global_stats', JSON.stringify(initialStats))
    statsCache = initialStats
    return initialStats
  }
  statsCache = JSON.parse(stats)
  return statsCache
}

// Stats middleware
app.use('*', async (c, next) => {
  if (c.req.method === 'POST' && c.req.path === '/check') {
    const stats = await initializeStats(c)
    stats.totalRequests++
    statsCache = stats
  }
  await next()
})

// Periodically write stats to KV store
setInterval(async () => {
  if (statsCache) {
    await c.env.STATS_STORE.put('global_stats', JSON.stringify(statsCache))
  }
}, 60000) // Every 60 seconds

// Rate limiting middleware
async function checkRateLimit(c: Context<Bindings>, ip: string, domainCount: number): Promise<{ allowed: boolean, remaining: number, resetTime?: Date }> {
  const key = `rate_limit:${ip}`
  const now = Date.now()
  const windowStart = now - (RATE_LIMIT.WINDOW_MINUTES * 60 * 1000)

  let usage: RateLimitData | null = rateLimitCache[key] || null
  
  if (!usage || usage.timestamp < windowStart) {
    usage = {
      count: domainCount,
      timestamp: now
    }
    rateLimitCache[key] = usage
    await c.env.RATE_LIMIT_STORE.put(key, JSON.stringify(usage), {
      expirationTtl: RATE_LIMIT.WINDOW_MINUTES * 60 // TTL in seconds
    })
    return {
      allowed: domainCount <= RATE_LIMIT.MAX_DOMAINS,
      remaining: RATE_LIMIT.MAX_DOMAINS - domainCount,
      resetTime: new Date(now + (RATE_LIMIT.WINDOW_MINUTES * 60 * 1000))
    }
  }

  const totalCount = usage.count + domainCount
  if (totalCount > RATE_LIMIT.MAX_DOMAINS) {
    const resetTime = new Date(usage.timestamp + (RATE_LIMIT.WINDOW_MINUTES * 60 * 1000))
    return {
      allowed: false,
      remaining: RATE_LIMIT.MAX_DOMAINS - usage.count,
      resetTime
    }
  }

  usage = {
    count: totalCount,
    timestamp: usage.timestamp
  }
  rateLimitCache[key] = usage
  await c.env.RATE_LIMIT_STORE.put(key, JSON.stringify(usage), {
    expirationTtl: RATE_LIMIT.WINDOW_MINUTES * 60 // TTL in seconds
  })

  return {
    allowed: true,
    remaining: RATE_LIMIT.MAX_DOMAINS - totalCount,
    resetTime: new Date(usage.timestamp + (RATE_LIMIT.WINDOW_MINUTES * 60 * 1000))
  }
}

const statsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Domain Checker Statistics - Check Domain Block Status | Skiddle ID</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="View real-time statistics of domain block checking. Track total checks, unique users, and blocked domain statistics. A free tool by Skiddle ID to check domain block status.">
    <meta name="keywords" content="domain checker stats, domain block statistics, website blocking checker, domain status tracker, Skiddle ID tools">
    <meta name="author" content="Skiddle ID">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Domain Checker Statistics - Check Domain Block Status | Skiddle ID">
    <meta property="og:description" content="View real-time statistics of domain block checking. Track total checks, unique users, and blocked domain statistics.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://check.skiddle.id/stats">
    <meta property="og:site_name" content="Domain Checker by Skiddle ID">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Domain Checker Statistics - Domain Block Status">
    <meta name="twitter:description" content="View real-time statistics of domain block checking. Track total checks, unique users, and blocked domain statistics.">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://check.skiddle.id/stats">
    
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Domain Checker Statistics",
      "applicationCategory": "WebTool",
      "operatingSystem": "Any",
      "description": "View real-time statistics of domain block checking. Track total checks, unique users, and blocked domain statistics.",
      "url": "https://check.skiddle.id/stats",
      "provider": {
        "@type": "Organization",
        "name": "Skiddle ID",
        "url": "https://github.com/Skiddle-ID"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
    </script>
</head>
<body class="bg-gray-100 min-h-screen flex flex-col">
    <div class="container mx-auto px-4 py-8 flex-grow">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">Domain Checker Statistics</h1>
            <a href="/" class="text-indigo-600 hover:text-indigo-800">Back to Checker</a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Usage Statistics</h2>
                <div class="space-y-4" id="usageStats">
                    Loading...
                </div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Domain Statistics</h2>
                <div class="space-y-4" id="domainStats">
                    Loading...
                </div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">System Information</h2>
                <div class="space-y-4" id="systemStats">
                    Loading...
                </div>
            </div>
        </div>
        <div class="text-center mt-8">
            <a href="https://github.com/sponsors/arcestia" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/badge/Sponsor-30363D?style=for-the-badge&logo=GitHub-Sponsors&logoColor=#white" alt="Sponsor or Donate">
            </a>
        </div>
    </div>
    <footer class="bg-white shadow-md mt-8">
        <div class="container mx-auto px-4 py-4">
            <p class="text-center text-gray-600">
                Domain Checker by 
                <a href="https://github.com/Skiddle-ID/checkdomain/" target="_blank" rel="noopener noreferrer" 
                   class="text-indigo-600 hover:text-indigo-800 font-medium">Skiddle ID</a>
            </p>
        </div>
    </footer>
    <script>
        async function loadStats() {
            try {
                const response = await fetch('/stats/data');
                const stats = await response.json();
                
                // Update usage stats
                document.getElementById('usageStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Total Requests:</span>
                        <span class="font-medium">\${stats.totalRequests}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Unique Users:</span>
                        <span class="font-medium">\${stats.uniqueUsers}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Total Domains Checked:</span>
                        <span class="font-medium">\${stats.totalDomainsChecked}</span>
                    </div>
                \`;

                // Update domain stats
                document.getElementById('domainStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Blocked Domains:</span>
                        <span class="font-medium text-red-600">\${stats.blockedDomains}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Not Blocked Domains:</span>
                        <span class="font-medium text-green-600">\${stats.notBlockedDomains}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Errors:</span>
                        <span class="font-medium text-yellow-600">\${stats.errorDomains}</span>
                    </div>
                \`;

                // Update system stats
                document.getElementById('systemStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Stats Since:</span>
                        <span class="font-medium">\${new Date(stats.lastReset).toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Rate Limit:</span>
                        <span class="font-medium">\${stats.rateLimit.max} per \${stats.rateLimit.window} min</span>
                    </div>
                \`;
            } catch (error) {
                console.error('Error loading stats:', error);
                document.getElementById('usageStats').innerHTML = '<p class="text-red-600">Error loading statistics</p>';
                document.getElementById('domainStats').innerHTML = '<p class="text-red-600">Error loading statistics</p>';
                document.getElementById('systemStats').innerHTML = '<p class="text-red-600">Error loading statistics</p>';
            }
        }

        // Load stats immediately and refresh every 30 seconds
        loadStats();
        setInterval(loadStats, 30000);
    </script>
</body>
</html>`

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Free Domain Block Checker - Check Multiple Domains | Skiddle ID</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="Free tool to check if domains are blocked. Check multiple domains at once, get instant results, and track blocking status. Simple, fast, and reliable domain checker by Skiddle ID.">
    <meta name="keywords" content="domain checker, website block checker, domain block status, multiple domain check, Skiddle ID tools">
    <meta name="author" content="Skiddle ID">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Free Domain Block Checker - Check Multiple Domains | Skiddle ID">
    <meta property="og:description" content="Free tool to check if domains are blocked. Check multiple domains at once and get instant results.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://check.skiddle.id">
    <meta property="og:site_name" content="Domain Checker by Skiddle ID">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Free Domain Block Checker - Check Multiple Domains">
    <meta name="twitter:description" content="Free tool to check if domains are blocked. Check multiple domains at once and get instant results.">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://check.skiddle.id">
    
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Domain Block Checker",
      "applicationCategory": "WebTool",
      "operatingSystem": "Any",
      "description": "Free tool to check if domains are blocked. Check multiple domains at once, get instant results, and track blocking status.",
      "url": "https://check.skiddle.id",
      "provider": {
        "@type": "Organization",
        "name": "Skiddle ID",
        "url": "https://github.com/Skiddle-ID"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "featureList": [
        "Check multiple domains simultaneously",
        "Instant results",
        "Track blocking status",
        "Real-time statistics",
        "Free to use"
      ]
    }
    </script>
</head>
<body class="bg-gray-100 min-h-screen flex flex-col">
    <div class="container mx-auto px-4 py-8 flex-grow">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">Domain Checker</h1>
            <a href="/stats" class="text-indigo-600 hover:text-indigo-800">View Statistics</a>
        </div>
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div class="mb-4 text-sm text-gray-600">
                Rate limit: ${RATE_LIMIT.MAX_DOMAINS} domains per ${RATE_LIMIT.WINDOW_MINUTES} minutes
            </div>
            <form id="checkForm" class="space-y-4">
                <div>
                    <label for="domains" class="block text-sm font-medium text-gray-700 mb-2">Enter domains (one per line):</label>
                    <textarea id="domains" name="domains" rows="10" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="example.com&#10;example.net&#10;example.org"></textarea>
                </div>
                <button type="submit" 
                    class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    Check Domains
                </button>
            </form>
            <div id="results" class="mt-8 hidden">
                <h2 class="text-xl font-semibold mb-4">Results</h2>
                <div id="summary" class="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-medium text-gray-900 mb-2">Summary</h3>
                    <div id="summaryContent" class="grid grid-cols-2 gap-4 text-sm"></div>
                </div>
                <div id="resultsContent" class="space-y-2"></div>
            </div>
        </div>
    </div>
    <footer class="bg-white shadow-md mt-8">
        <div class="container mx-auto px-4 py-4">
            <p class="text-center text-gray-600">
                Domain Checker by 
                <a href="https://github.com/Skiddle-ID/checkdomain/" target="_blank" rel="noopener noreferrer" 
                   class="text-indigo-600 hover:text-indigo-800 font-medium">Skiddle ID</a>
            </p>
        </div>
    </footer>
    <script>
        function formatDateTime(date) {
            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            };
            return new Date(date).toLocaleString(undefined, options);
        }

        document.getElementById('checkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const domains = document.getElementById('domains').value;
            const resultsDiv = document.getElementById('results');
            const resultsContent = document.getElementById('resultsContent');
            const summaryContent = document.getElementById('summaryContent');
            
            resultsDiv.classList.remove('hidden');
            resultsContent.innerHTML = '<p class="text-center">Checking domains...</p>';
            summaryContent.innerHTML = '';
            
            try {
                const response = await fetch('/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ domains: domains.split('\\n').map(d => d.trim()).filter(d => d) })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    if (errorData.rateLimitExceeded && errorData.resetTime) {
                        throw new Error(\`Rate limit exceeded. You have \${errorData.remaining} domains remaining. Rate limit will reset at \${formatDateTime(errorData.resetTime)}\`);
                    }
                    throw new Error(errorData.error || 'Failed to check domains');
                }

                const results = await response.json();
                if (results.error) {
                    throw new Error(results.error);
                }

                // Calculate statistics
                const stats = {
                    total: results.domains.length,
                    blocked: results.domains.filter(d => d.status === 'Blocked').length,
                    notBlocked: results.domains.filter(d => d.status === 'Not Blocked').length,
                    errors: results.domains.filter(d => d.status.startsWith('Error')).length
                };

                // Update summary
                summaryContent.innerHTML = \`
                    <div class="bg-blue-100 text-blue-800 p-2 rounded">
                        <span class="font-medium">Total Domains:</span> \${stats.total}
                    </div>
                    <div class="bg-red-100 text-red-800 p-2 rounded">
                        <span class="font-medium">Blocked:</span> \${stats.blocked}
                    </div>
                    <div class="bg-green-100 text-green-800 p-2 rounded">
                        <span class="font-medium">Not Blocked:</span> \${stats.notBlocked}
                    </div>
                    <div class="bg-yellow-100 text-yellow-800 p-2 rounded">
                        <span class="font-medium">Errors:</span> \${stats.errors}
                    </div>
                \`;
                
                resultsContent.innerHTML = results.domains.map(function(result) {
                    return '<div class="flex justify-between items-center p-3 bg-gray-50 rounded">' +
                           '<span class="font-medium">' + result.originalUrl + '</span>' +
                           '<span class="px-3 py-1 rounded ' + 
                           (result.status === 'Blocked' ? 'bg-red-100 text-red-800' : 
                            result.status === 'Not Blocked' ? 'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800') +
                           '">' + result.status + '</span>' +
                           '</div>';
                }).join('');

                if (results.remaining !== undefined) {
                    resultsContent.innerHTML += '<div class="mt-4 text-sm text-gray-600">' +
                                              'Remaining domains for this window: ' + results.remaining;
                    if (results.resetTime) {
                        resultsContent.innerHTML += '<br>Rate limit resets at: ' + formatDateTime(results.resetTime);
                    }
                    resultsContent.innerHTML += '</div>';
                }
            } catch (error) {
                resultsContent.innerHTML = '<p class="text-red-600">' + (error.message || 'Error checking domains. Please try again.') + '</p>';
                summaryContent.innerHTML = '';
            }
        });
    </script>
</body>
</html>`

// Routes
app.get('/', (c) => {
  return c.html(indexHtml)
})

app.get('/stats', (c) => {
  return c.html(statsHtml)
})

app.get('/stats/data', async (c) => {
  const stats = await initializeStats(c)
  return c.json({
    totalRequests: stats.totalRequests,
    totalDomainsChecked: stats.totalDomainsChecked,
    uniqueUsers: stats.uniqueUsers.length,
    blockedDomains: stats.blockedDomains,
    notBlockedDomains: stats.notBlockedDomains,
    errorDomains: stats.errorDomains,
    lastReset: stats.lastReset,
    rateLimit: {
      max: RATE_LIMIT.MAX_DOMAINS,
      window: RATE_LIMIT.WINDOW_MINUTES
    }
  })
})

// API Routes
app.post('/check', async (c: Context<Bindings>) => {
  try {
    const body = await c.req.json()
    const domains = body.domains as string[]
    
    if (!domains || !Array.isArray(domains)) {
      return c.json({ error: 'Invalid domains format' }, 400)
    }

    if (domains.length === 0) {
      return c.json({ error: 'No domains provided' }, 400)
    }

    // Get client IP
    const ip = c.req.header('cf-connecting-ip') || 
               c.req.header('x-forwarded-for') || 
               'unknown'

    // Update stats
    const stats = await initializeStats(c)
    if (!stats.uniqueUsers.includes(ip)) {
      stats.uniqueUsers.push(ip)
    }
    stats.totalDomainsChecked += domains.length

    // Check rate limit
    const { allowed, remaining, resetTime } = await checkRateLimit(c, ip, domains.length)
    
    if (!allowed) {
      return c.json({
        error: 'Rate limit exceeded',
        rateLimitExceeded: true,
        remaining,
        resetTime
      }, 429)
    }

    const results = []

    // Process domains in batches
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE)
      const batchResults = await checkBatch(batch)
      results.push(...batchResults)
    }

    // Update domain stats
    results.forEach(result => {
      if (result.status === 'Blocked') stats.blockedDomains++
      else if (result.status === 'Not Blocked') stats.notBlockedDomains++
      else stats.errorDomains++
    })

    // Save updated stats
    statsCache = stats

    return c.json({
      domains: results,
      remaining,
      resetTime
    })
  } catch (error) {
    console.error('Error processing domains:', error)
    return c.json({ error: 'Failed to process domains' }, 500)
  }
})

async function checkBatch(domains: string[]) {
  try {
    // Build URL with domains parameter and json=true
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
    
    // Check if data has the expected structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid API response format')
    }

    return domains.map(domain => {
      try {
        const result = data[domain]
        if (!result || typeof result !== 'object') {
          return {
            originalUrl: domain,
            status: 'Error: Invalid response'
          }
        }
        return {
          originalUrl: domain,
          status: result.blocked ? 'Blocked' : 'Not Blocked'
        }
      } catch (err) {
        console.error(`Error processing domain ${domain}:`, err)
        return {
          originalUrl: domain,
          status: 'Error: Processing failed'
        }
      }
    })
  } catch (error) {
    console.error('Error checking batch:', error)
    return domains.map(domain => ({
      originalUrl: domain,
      status: 'Error: API request failed'
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
