const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('../utils/store');
const { isManager } = require('../utils/util');
const { deny, text } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Staff settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(group =>
      group
        .setName('role')
        .setDescription('Staff roles')
        .addSubcommand(s =>
          s
            .setName('select')
            .setDescription('Ticket ping role selector')
            .addRoleOption(o => o.setName('role').setDescription('Role to ping on new tickets').setRequired(true))
        )
    ),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const g = store.guild(i.guild.id);
    const role = i.options.getRole('role');
    g.cfg.support_role = role.id;
    store.save();
    return text(i, `Tickets will now ping ${role}.`);
  }
};
