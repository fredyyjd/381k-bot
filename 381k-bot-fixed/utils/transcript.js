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

function escape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function build(channel) {
  const messages = await fetchAll(channel);
  const rows = messages
    .map(m => {
      const stamp = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      const files = [...m.attachments.values()]
        .map(a => `<a href="${escape(a.url)}">${escape(a.name)}</a>`)
        .join(' ');
      const embeds = m.embeds
        .map(e => escape([e.title, e.description].filter(Boolean).join(' - ')))
        .filter(Boolean)
        .join('<br>');
      return `<div class="m"><img src="${m.author.displayAvatarURL({ extension: 'png', size: 64 })}"><div><b>${escape(m.author.tag)}</b> <span>${stamp} UTC</span><p>${escape(m.content)}</p>${embeds ? `<p class="e">${embeds}</p>` : ''}${files ? `<p>${files}</p>` : ''}</div></div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(channel.name)}</title>
<style>
body{background:#313338;color:#dbdee1;font-family:Arial,sans-serif;margin:0;padding:24px}
h1{font-size:20px;margin:0 0 20px}
.m{display:flex;gap:12px;margin-bottom:14px}
.m img{width:40px;height:40px;border-radius:50%}
.m span{color:#949ba4;font-size:12px;margin-left:6px}
.m p{margin:2px 0;white-space:pre-wrap;word-break:break-word}
.e{border-left:4px solid #4e5058;padding-left:8px;color:#b5bac1}
a{color:#00a8fc}
</style></head><body>
<h1>${escape(channel.guild.name)} | #${escape(channel.name)}</h1>
${rows}
</body></html>`;

  return {
    file: new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `transcript-${channel.name}.html` }),
    messages
  };
}

module.exports = { build, fetchAll };
