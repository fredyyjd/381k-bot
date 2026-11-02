const { AttachmentBuilder } = require('discord.js');

async function fetchAll(channel, limit = 5000) {
  const out = [];
  let before;
  while (out.length < limit) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    out.push(...batch.values());
    before = batch.last().id;
  }
  return out.reverse();
}

function stamp(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// Plain text transcript (.txt), one message per block.
async function build(channel) {
  const messages = await fetchAll(channel);
  const lines = [
    `${channel.guild.name} | #${channel.name}`,
    `Generated ${stamp(new Date())}`,
    `Messages: ${messages.length}`,
    '='.repeat(48),
    ''
  ];

  for (const m of messages) {
    lines.push(`[${stamp(m.createdAt)}] ${m.author.username} (${m.author.id})`);
    if (m.content) lines.push(...m.content.split('\n').map(l => `  ${l}`));
    for (const e of m.embeds) {
      const body = [e.title, e.description].filter(Boolean).join(' - ');
      if (body) lines.push(...`[Embed] ${body}`.split('\n').map(l => `  ${l}`));
    }
    for (const a of m.attachments.values()) lines.push(`  [File] ${a.name}: ${a.url}`);
    lines.push('');
  }

  return {
    file: new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `transcript-${channel.name}.txt` }),
    messages
  };
}

module.exports = { build, fetchAll };
