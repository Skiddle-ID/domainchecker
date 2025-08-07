// Scheduled Worker for Discord batch sending
import { initializeDbClient } from './db'
import { sendDiscordWebhookBatch } from './webhook'

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: any) {
    const db = initializeDbClient(env)
    const webhookUrl = env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('DISCORD_WEBHOOK_URL not set, skipping Discord batch send.')
      return
    }

    // Fetch all unsent batches
    let batches
    try {
      const result = await db.execute({
        sql: 'SELECT id, created_at, ip, results_json FROM pending_webhook WHERE sent = 0 ORDER BY created_at ASC',
        args: []
      })
      batches = result.rows
    } catch (err) {
      console.error('Failed to fetch pending webhook batches:', err)
      return
    }
    if (!batches || batches.length === 0) {
      console.log('No pending webhook batches to send.')
      return
    }

    // Compile all results
    let allResults: any[] = []
    let summary = {
      totalBatches: batches.length,
      totalDomains: 0,
      blocked: 0,
      notBlocked: 0,
      errors: 0
    }
    let lines: string[] = []
    // Utility to safely convert any value to string
    function toSafeString(val: unknown): string {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'bigint') return val.toString();
      if (val instanceof ArrayBuffer) return new TextDecoder().decode(val);
      return String(val);
    }
    for (const batch of batches) {
      const created_at = toSafeString(batch.created_at);
      const ip = toSafeString(batch.ip);
      const { meta, results } = JSON.parse(batch.results_json ?? '{}');
      summary.totalDomains += meta?.total || 0;
      summary.blocked += meta?.blocked || 0;
      summary.notBlocked += meta?.notBlocked || 0;
      summary.errors += meta?.errors || 0;
      for (const r of results || []) {
        lines.push([
          toSafeString(created_at),
          toSafeString(ip),
          toSafeString(r.originalUrl),
          toSafeString(r.status),
          r.blocked ? 'BLOCKED' : r.error ? 'ERROR' : 'NOT_BLOCKED'
        ].join(','));
      }
    }

    // Prepare text file content
    const fileContent = [
      'timestamp,ip,domain,status,flag',
      ...lines
    ].join('\n')

    // Prepare Discord embed summary
    const embed = {
      title: 'Domain Check Batch Summary',
      description: `Batches: ${summary.totalBatches}, Total Domains: ${summary.totalDomains}`,
      fields: [
        { name: 'Blocked', value: String(summary.blocked), inline: true },
        { name: 'Not Blocked', value: String(summary.notBlocked), inline: true },
        { name: 'Errors', value: String(summary.errors), inline: true }
      ],
      color: summary.errors > 0 ? 0xEAB308 : (summary.blocked > 0 ? 0xEF4444 : 0x22C55E),
      timestamp: new Date().toISOString()
    }

    // Send to Discord
    const form = new FormData()
    form.append('payload_json', JSON.stringify({
      embeds: [embed],
      content: `Batch domain check result for ${summary.totalDomains} domains in ${summary.totalBatches} batches. See attachment for details.`
    }))
    form.append('file', new Blob([fileContent], { type: 'text/csv' }), 'domain-batch.csv')
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        body: form
      })
    } catch (err) {
      console.error('Failed to send Discord webhook batch:', err)
      return
    }

    // Mark all batches as sent
    try {
      const ids = batches.map(b => `'${b.id}'`).join(',')
      await db.execute({
        sql: `UPDATE pending_webhook SET sent = 1 WHERE id IN (${ids})`,
        args: []
      })
      console.log(`Marked ${batches.length} batches as sent.`)
    } catch (err) {
      console.error('Failed to mark batches as sent:', err)
    }
  }
}
