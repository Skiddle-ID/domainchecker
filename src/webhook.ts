// Utility to send messages to Discord webhook
// Usage: await sendDiscordWebhook(text, webhookUrl)

// Enhanced webhook: send embed if <=5 domains, else text file
export interface DomainResult {
  originalUrl: string;
  status: string;
  blocked: boolean;
  error: boolean;
}

export interface BatchMeta {
  ip: string;
  total: number;
  blocked: number;
  notBlocked: number;
  errors: number;
}

export async function sendDiscordWebhookBatch(
  results: DomainResult[],
  meta: BatchMeta,
  webhookUrl: string
): Promise<void> {
  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL not set, skipping Discord notification.')
    return
  }

  // Always send summary/meta as embed
  const embed = {
    title: 'Domain Check Batch Result',
    description: `Requested by IP: ${meta.ip}`,
    footer: {
      text: `Total: ${meta.total}, Blocked: ${meta.blocked}, Not Blocked: ${meta.notBlocked}, Errors: ${meta.errors}`
    },
    color: meta.errors > 0 ? 0xEAB308 : (meta.blocked > 0 ? 0xEF4444 : 0x22C55E)
  };

  if (results.length <= 5) {
    // Add results to embed fields
    (embed as any).fields = results.map(r => ({
      name: r.originalUrl,
      value: r.status,
      inline: false
    }));
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      })
    } catch (err) {
      console.error('Failed to send Discord webhook embed:', err)
    }
  } else {
    // Send as text file attachment, embed only summary/meta
    const summary = results.map(r => `${r.originalUrl}: ${r.status}`).join('\n');
    const form = new FormData();
    form.append('payload_json', JSON.stringify({
      embeds: [embed],
      content: `Domain check result for ${meta.total} domains. See attachment for details.`
    }));
    form.append('file', new Blob([summary], { type: 'text/plain' }), 'domain-check.txt');
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        body: form
      });
    } catch (err) {
      console.error('Failed to send Discord webhook file:', err);
    }
  }
}

