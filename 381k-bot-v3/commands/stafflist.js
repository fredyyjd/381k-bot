const { SlashCommandBuilder } = require('discord.js');
const staff = require('../utils/staff');

module.exports = {
  data: new SlashCommandBuilder().setName('stafflist').setDescription('Staff list by highest rank'),

  async execute(i) {
    if (!i.guild) return;
    return staff.stafflist(i);
  }
};
