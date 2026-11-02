const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const staff = require('../utils/staff');
const { isManager } = require('../utils/util');
const { deny } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Activity checks')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('check').setDescription('Start a 24 hour activity check')),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    return staff.startActivity(i);
  }
};
