const { SlashCommandBuilder } = require('discord.js');
const store = require('../utils/store');
const staff = require('../utils/staff');
const { isManager, isStaff } = require('../utils/util');
const { deny, text } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Partner leaderboard')
    .addSubcommand(s => s.setName('tracker').setDescription('Partner leaderboard'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset partner leaderboard')),

  async execute(i) {
    if (!i.guild) return;
    const sub = i.options.getSubcommand();
    const g = store.guild(i.guild.id);

    if (sub === 'tracker') {
      if (!isStaff(i.member)) return deny(i);
      return i.reply({ embeds: [staff.board(i.guild, 'Partner Leaderboard', g.partner)] });
    }

    if (sub === 'reset') {
      if (!isManager(i.member)) return deny(i);
      g.partner = {};
      store.save();
      return text(i, 'Partner leaderboard reset.');
    }
  }
};
