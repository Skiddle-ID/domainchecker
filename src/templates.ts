export const statsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Domain Checker Statistics - Check Domain Block Status | Skiddle ID</title>
    <meta name="description" content="View real-time statistics of domain block checking. Track total checks, unique users, and blocked domain statistics.">
    <script src="https://cdn.tailwindcss.com"></script>
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
    </div>
    <script>
        function formatNumber(num) {
            return num !== undefined ? num.toLocaleString() : '0';
        }

        function formatDate(timestamp) {
            if (!timestamp) return 'Not available';
            try {
                return new Date(timestamp).toLocaleString();
            } catch (error) {
                return 'Invalid date';
            }
        }

        async function loadStats() {
            try {
                const response = await fetch('/stats/data');
                if (!response.ok) {
                    throw new Error('Failed to fetch stats');
                }
                const stats = await response.json();
                
                if (stats.error) {
                    throw new Error(stats.error);
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
                \`;

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
                \`;

                document.getElementById('systemStats').innerHTML = \`
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Stats Since:</span>
                        <span class="font-medium">\${formatDate(stats.lastReset)}</span>
                    </div>
                \`;
            } catch (error) {
                console.error('Error loading stats:', error);
                const errorMessage = \`
                    <div class="p-4 bg-red-50 text-red-600 rounded-md">
                        <p class="font-medium">Error loading statistics</p>
                        <p class="text-sm mt-1">\${error.message}</p>
                    </div>
                \`;
                document.getElementById('usageStats').innerHTML = errorMessage;
                document.getElementById('domainStats').innerHTML = errorMessage;
                document.getElementById('systemStats').innerHTML = errorMessage;
            }
        }

        loadStats();
        setInterval(loadStats, 30000);
    </script>
</body>
</html>`;

export const indexHtml = `<!DOCTYPE html>
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
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div class="mb-4 text-sm text-gray-600">
                Rate limit: 1000 domains per 10 minutes
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
    <script>
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
                    throw new Error(errorData.error || 'Failed to check domains');
                }

                const results = await response.json();
                
                const stats = {
                    total: results.results.length,
                    blocked: results.results.filter(d => d.status === 'Blocked').length,
                    notBlocked: results.results.filter(d => d.status === 'Not Blocked').length,
                    errors: results.results.filter(d => d.status.startsWith('Error')).length
                };

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
                
                resultsContent.innerHTML = results.results.map(function(result) {
                    return \`<div class="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span class="font-medium">\${result.originalUrl}</span>
                        <span class="px-3 py-1 rounded \${
                            result.status === 'Blocked' ? 'bg-red-100 text-red-800' : 
                            result.status === 'Not Blocked' ? 'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800'
                        }">\${result.status}</span>
                    </div>\`;
                }).join('');

                if (results.remaining !== undefined) {
                    resultsContent.innerHTML += \`<div class="mt-4 text-sm text-gray-600">
                        Remaining domains for this window: \${results.remaining}
                        \${results.resetTime ? '<br>Rate limit resets at: ' + new Date(results.resetTime).toLocaleString() : ''}
                    </div>\`;
                }
            } catch (error) {
                resultsContent.innerHTML = '<p class="text-red-600">' + (error.message || 'Error checking domains. Please try again.') + '</p>';
                summaryContent.innerHTML = '';
            }
        });
    </script>
</body>
</html>`;
