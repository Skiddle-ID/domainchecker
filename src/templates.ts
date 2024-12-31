export const statsHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Domain Checker Statistics - Check Domain Block Status | Skiddle ID</title>
    <meta name="description" content="View real-time statistics of domain block checking. Track total checks, unique users, and blocked domain statistics.">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100 min-h-screen flex flex-col">
    <div class="container mx-auto px-4 py-8 flex-grow">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">Domain Checker Statistics</h1>
            <a href="/" class="text-indigo-600 hover:text-indigo-800">Back to Checker</a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Usage Statistics</h2>
                <div class="space-y-4" id="usageStats">Loading...</div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Domain Statistics</h2>
                <div class="space-y-4" id="domainStats">Loading...</div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">System Information</h2>
                <div class="space-y-4" id="systemStats">Loading...</div>
            </div>
        </div>
        
        <!-- Daily Stats Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Daily Domain Checks</h2>
                <canvas id="dailyChecksChart"></canvas>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4">Daily Results Distribution</h2>
                <canvas id="dailyResultsChart"></canvas>
            </div>
        </div>
    </div>
    <script>
        function formatNumber(num) {
            return num !== undefined ? num.toLocaleString() : '0'
        }

        function formatDate(timestamp) {
            if (!timestamp) return 'Not available'
            try {
                return new Date(timestamp).toLocaleString()
            } catch (error) {
                return 'Invalid date'
            }
        }

        let dailyChecksChartInstance = null;
        let dailyResultsChartInstance = null;

        function createDailyChecksChart(data) {
            const ctx = document.getElementById('dailyChecksChart').getContext('2d')
            
            // Destroy existing chart if it exists
            if (dailyChecksChartInstance) {
                dailyChecksChartInstance.destroy();
            }
            
            dailyChecksChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => d.date),
                    datasets: [{
                        label: 'Total Domains Checked',
                        data: data.map(d => d.totalDomainsChecked),
                        borderColor: 'rgb(79, 70, 229)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            })
        }

        function createDailyResultsChart(data) {
            const ctx = document.getElementById('dailyResultsChart').getContext('2d')
            
            // Destroy existing chart if it exists
            if (dailyResultsChartInstance) {
                dailyResultsChartInstance.destroy();
            }
            
            dailyResultsChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.date),
                    datasets: [
                        {
                            label: 'Blocked',
                            data: data.map(d => d.blockedDomains),
                            backgroundColor: 'rgba(239, 68, 68, 0.5)',
                            borderColor: 'rgb(239, 68, 68)',
                            borderWidth: 1
                        },
                        {
                            label: 'Not Blocked',
                            data: data.map(d => d.notBlockedDomains),
                            backgroundColor: 'rgba(34, 197, 94, 0.5)',
                            borderColor: 'rgb(34, 197, 94)',
                            borderWidth: 1
                        },
                        {
                            label: 'Errors',
                            data: data.map(d => d.errorDomains),
                            backgroundColor: 'rgba(234, 179, 8, 0.5)',
                            borderColor: 'rgb(234, 179, 8)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            stacked: true
                        },
                        x: {
                            stacked: true
                        }
                    }
                }
            })
        }

        async function loadStats() {
            try {
                const response = await fetch('/stats/data')
                if (!response.ok) {
                    throw new Error('Failed to fetch stats')
                }
                const stats = await response.json()
                
                if (stats.error) {
                    throw new Error(stats.error)
                }
                
                document.getElementById('usageStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Total Requests:</span>
                        <span class="font-medium">\${formatNumber(stats.totalRequests)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Total Domains Checked:</span>
                        <span class="font-medium">\${formatNumber(stats.totalDomainsChecked)}</span>
                    </div>
                \`

                document.getElementById('domainStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Blocked Domains:</span>
                        <span class="font-medium text-red-600">\${formatNumber(stats.blockedDomains)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Not Blocked Domains:</span>
                        <span class="font-medium text-green-600">\${formatNumber(stats.notBlockedDomains)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Errors:</span>
                        <span class="font-medium text-yellow-600">\${formatNumber(stats.errorDomains)}</span>
                    </div>
                \`

                document.getElementById('systemStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Stats Since:</span>
                        <span class="font-medium">\${formatDate(stats.lastReset)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Unique Users:</span>
                        <span class="font-medium">\${formatNumber(stats.uniqueUsers)}</span>
                    </div>
                \`

                // Create charts
                if (stats.dailyStats && stats.dailyStats.length > 0) {
                    createDailyChecksChart(stats.dailyStats)
                    createDailyResultsChart(stats.dailyStats)
                }
            } catch (error) {
                console.error('Error loading stats:', error)
                const errorMessage = \`
                    <div class="p-4 bg-red-50 text-red-600 rounded-md">
                        <p class="font-medium">Error loading statistics</p>
                        <p class="text-sm mt-1">\${error.message}</p>
                    </div>
                \`
                document.getElementById('usageStats').innerHTML = errorMessage
                document.getElementById('domainStats').innerHTML = errorMessage
                document.getElementById('systemStats').innerHTML = errorMessage
            }
        }

        // Load stats immediately and refresh every 30 seconds
        loadStats()
        setInterval(loadStats, 30000)
    </script>
</body>
</html>`;

export const indexHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Free Domain Block Checker - Check Multiple Domains | Skiddle ID</title>
    <meta name="description" content="Free tool to check if domains are blocked. Check multiple domains at once, get instant results, and track blocking status.">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex flex-col">
    <div class="container mx-auto px-4 py-8 flex-grow">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">Domain Checker</h1>
            <a href="/stats" class="text-indigo-600 hover:text-indigo-800">View Statistics</a>
        </div>
        <div class="bg-white rounded-lg shadow-md p-6">
            <form id="checkForm" class="space-y-4">
                <div>
                    <label for="domains" class="block text-sm font-medium text-gray-700 mb-2">Enter domains (one per line)</label>
                    <div class="text-sm text-gray-600 mb-2">Rate limit: 1000 domains per 10 minutes. Maximum 100 domains per request.</div>
                    <textarea id="domains" name="domains" rows="10" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="example.com&#10;example.net&#10;example.org"></textarea>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Check Domains</button>
            </form>
        </div>
        <div id="results" class="mt-8"></div>
    </div>
    <script>
        document.getElementById('checkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const domains = document.getElementById('domains').value;
            const resultsDiv = document.getElementById('results');
            
            // Show loading state
            resultsDiv.innerHTML = '<div class="animate-pulse bg-white rounded-lg shadow-md p-6"><div class="h-4 bg-gray-200 rounded w-3/4 mb-4"></div><div class="h-4 bg-gray-200 rounded"></div></div>';
            
            try {
                // Split domains and remove empty lines
                const domainList = domains.split('\\n')
                    .map(d => d.trim())
                    .filter(d => d.length > 0);
                
                const response = await fetch('/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ domains: domainList })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Update results
                let resultsHTML = '<div class="bg-white rounded-lg shadow-md p-6">';
                
                // Add summary
                const stats = {
                    total: data.results.length,
                    blocked: data.results.filter(r => r.blocked).length,
                    notBlocked: data.results.filter(r => !r.blocked && !r.error).length,
                    errors: data.results.filter(r => r.error).length
                };
                
                resultsHTML += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">';
                resultsHTML += \`
                    <div class="text-center">
                        <div class="text-sm text-gray-600">Total Domains</div>
                        <div class="text-xl font-semibold">\${stats.total}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm text-gray-600">Blocked</div>
                        <div class="text-xl font-semibold text-red-600">\${stats.blocked}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm text-gray-600">Not Blocked</div>
                        <div class="text-xl font-semibold text-green-600">\${stats.notBlocked}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm text-gray-600">Errors</div>
                        <div class="text-xl font-semibold text-yellow-600">\${stats.errors}</div>
                    </div>
                \`;
                resultsHTML += '</div>';
                
                // Add results table
                resultsHTML += '<div class="overflow-x-auto"><table class="min-w-full table-auto">';
                resultsHTML += '<thead><tr class="bg-gray-50"><th class="px-4 py-2 text-left">Domain</th><th class="px-4 py-2 text-left">Status</th></tr></thead>';
                resultsHTML += '<tbody>';
                
                data.results.forEach(result => {
                    const statusClass = result.error ? 'text-yellow-800 bg-yellow-100' : 
                                      result.blocked ? 'text-red-800 bg-red-100' : 
                                      'text-green-800 bg-green-100';
                    resultsHTML += \`
                        <tr>
                            <td class="border-t px-4 py-2">\${result.originalUrl}</td>
                            <td class="border-t px-4 py-2"><span class="px-2 py-1 rounded-full text-sm \${statusClass}">\${result.status}</span></td>
                        </tr>
                    \`;
                });
                
                resultsHTML += '</tbody></table></div>';
                
                // Add rate limit info
                if (data.remaining !== undefined) {
                    resultsHTML += \`
                        <div class="mt-4 text-sm text-gray-600">
                            Remaining checks for this window: \${data.remaining}<br>
                            Rate limit resets at: \${new Date(data.resetTime).toLocaleString()}
                        </div>
                    \`;
                }
                
                resultsHTML += '</div>';
                resultsDiv.innerHTML = resultsHTML;
                
            } catch (error) {
                resultsDiv.innerHTML = \`
                    <div class="bg-red-50 text-red-600 rounded-lg shadow-md p-6">
                        <div class="font-medium">Error checking domains</div>
                        <div class="mt-1">\${error.message}</div>
                    </div>
                \`;
            }
        });
    </script>
</body>
</html>`;
