const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('../utils/store');
const { isManager } = require('../utils/util');
const { deny, text } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikeremove')
    .setDescription('Remove strike 1, 2 or 3')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption(o =>
      o
        .setName('strike')
        .setDescription('Strike number')
        .setRequired(true)
        .addChoices({ name: 'Strike 1', value: 1 }, { name: 'Strike 2', value: 2 }, { name: 'Strike 3', value: 3 })
    ),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const user = i.options.getUser('user');
    const number = i.options.getInteger('strike');
    const g = store.guild(i.guild.id);
    const list = g.strikes[user.id] || [];
    if (!list.some(s => s.number === number)) return text(i, `${user} does not have strike ${number}.`);
    g.strikes[user.id] = list.filter(s => s.number !== number);
    store.save();
    return text(i, `Strike ${number} removed from ${user}.`);
  }
};
