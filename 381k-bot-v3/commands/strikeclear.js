const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('../utils/store');
const { isManager } = require('../utils/util');
const { deny, text } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikeclear')
    .setDescription('Clear all strikes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const user = i.options.getUser('user');
    store.guild(i.guild.id).strikes[user.id] = [];
    store.save();
    return text(i, `All strikes cleared for ${user}.`);
  }
};
