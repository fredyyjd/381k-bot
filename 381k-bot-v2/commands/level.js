const { SlashCommandBuilder } = require('discord.js');
const levels = require('../utils/levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Levels and XP')
    .addSubcommand(s =>
      s
        .setName('lb')
        .setDescription('Level leaderboard or one member')
        .addUserOption(o => o.setName('user').setDescription('Member to look up').setRequired(false))
    ),

  async execute(i) {
    if (!i.guild) return;
    if (i.options.getSubcommand() === 'lb') return levels.leaderboard(i);
  }
};
