const { SlashCommandBuilder } = require('discord.js');
const { embed } = require('../utils/util');
const { about } = require('../config');

module.exports = {
  data: new SlashCommandBuilder().setName('about').setDescription('About the bot'),

  async execute(i) {
    if (!i.guild) return;
    const e = embed(i.guild)
      .setTitle(`🟡 ${about.name}`)
      .addFields(
        { name: '🏷️ Name', value: about.name, inline: true },
        { name: '👑 Owner', value: about.owner, inline: true },
        { name: '📡 Ping', value: `${Math.round(i.client.ws.ping)} ms`, inline: true }
      );
    return i.reply({ embeds: [e] });
  }
};
