const store = require('./store');
const { embed } = require('./util');

const COOLDOWN = 60000;

function need(level) {
  return Math.max(100, level * 100);
}

function entryFor(g, id) {
  if (!g.levels[id]) g.levels[id] = { level: 0, xp: 0, total: 0, last: 0 };
  return g.levels[id];
}

function sorted(g) {
  return Object.entries(g.levels).sort((a, b) => b[1].total - a[1].total);
}

function rankOf(g, id) {
  const index = sorted(g).findIndex(([userId]) => userId === id);
  return index === -1 ? 0 : index + 1;
}

async function announce(message, before, entry) {
  const guild = message.guild;
  const g = store.guild(guild.id);
  const cfg = g.cfg;
  const e = embed(guild)
    .setTitle('Level Up!')
    .setDescription(`${message.author}\nLevel: ${before} \u279c ${entry.level}`)
    .addFields(
      { name: 'Current Rank', value: `#${rankOf(g, message.author.id)}` },
      { name: 'Progress', value: `${entry.xp}/${need(entry.level)} XP until Level ${entry.level + 1}` }
    );
  if (cfg.levels_channel) {
    e.addFields({ name: 'Make sure to check out:', value: `<#${cfg.levels_channel}>` });
  }
  const target = (cfg.levelup_channel && guild.channels.cache.get(cfg.levelup_channel)) || message.channel;
  await target.send({ embeds: [e] }).catch(() => {});
}

async function onMessage(message) {
  if (!message.guild || message.author.bot) return;
  const g = store.guild(message.guild.id);
  if (g.tickets[message.channelId]) return;
  const entry = entryFor(g, message.author.id);
  const now = Date.now();
  if (now - entry.last < COOLDOWN) return;
  entry.last = now;
  const gain = 15 + Math.floor(Math.random() * 11);
  const before = entry.level;
  entry.xp += gain;
  entry.total += gain;
  while (entry.xp >= need(entry.level)) {
    entry.xp -= need(entry.level);
    entry.level += 1;
  }
  store.save();
  if (entry.level > before) await announce(message, before, entry);
}

async function leaderboard(i) {
  const g = store.guild(i.guild.id);
  const user = i.options.getUser('user');

  if (user) {
    const entry = g.levels[user.id];
    const e = embed(i.guild).setTitle(user.username).setThumbnail(user.displayAvatarURL({ size: 128 }));
    if (!entry) return i.reply({ embeds: [e.setDescription('This member has no XP yet.')] });
    e.addFields(
      { name: 'Level', value: `${entry.level}`, inline: true },
      { name: 'Rank', value: `#${rankOf(g, user.id)}`, inline: true },
      { name: 'Total XP', value: `${entry.total}`, inline: true },
      { name: 'Progress', value: `${entry.xp}/${need(entry.level)} XP until Level ${entry.level + 1}` }
    );
    return i.reply({ embeds: [e] });
  }

  const rows = sorted(g).slice(0, 10);
  const text = rows.length
    ? rows.map(([id, v], n) => `${n + 1}. <@${id}> - Level ${v.level}, ${v.total} XP`).join('\n')
    : 'No entries yet.';
  return i.reply({ embeds: [embed(i.guild).setTitle('Level Leaderboard').setDescription(text)] });
}

module.exports = { onMessage, leaderboard };
