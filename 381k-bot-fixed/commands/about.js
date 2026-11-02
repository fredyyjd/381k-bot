const os = require('os');
const { SlashCommandBuilder, version } = require('discord.js');
const { embed } = require('../utils/util');

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

module.exports = {
  data: new SlashCommandBuilder().setName('about').setDescription('Learn about the 381K bot'),

  async execute(i) {
    if (!i.guild) return;
    const client = i.client;
    const members = client.guilds.cache.reduce((n, g) => n + g.memberCount, 0);
    const e = embed(i.guild)
      .setTitle('381K Bot')
      .setDescription('Tickets, giveaway claims, applications and staff management for the 381K community.')
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Members', value: `${members}`, inline: true },
        { name: 'Ping', value: `${client.ws.ping} ms`, inline: true },
        { name: 'Uptime', value: formatUptime(process.uptime()), inline: true },
        { name: 'Node', value: process.version, inline: true },
        { name: 'discord.js', value: version, inline: true },
        { name: 'Memory', value: `${Math.round(process.memoryUsage().rss / 1048576)} MB of ${Math.round(os.totalmem() / 1073741824)} GB`, inline: true }
      );
    return i.reply({ embeds: [e] });
  }
};
