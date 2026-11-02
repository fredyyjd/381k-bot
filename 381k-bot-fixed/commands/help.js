const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../utils/help');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('View all bot commands'),

  async execute(i) {
    if (!i.guild) return;
    return i.reply({ embeds: [helpEmbed(i.guild)] });
  }
};
