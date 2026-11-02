const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const staff = require('../utils/staff');
const { isManager } = require('../utils/util');
const { EPHEMERAL, deny, text } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikeadd')
    .setDescription('Add a strike')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const member = i.options.getMember('user');
    if (!member) return text(i, 'That member is not in this server.');
    await i.deferReply({ flags: EPHEMERAL });
    const result = await staff.addStrike(i.guild, member, i.user, i.options.getString('reason'));
    if (result.error) return i.editReply(result.error);
    let message = `Strike ${result.number} added to ${member}.`;
    if (result.demoted) {
      message += result.demoted.error
        ? ` Auto demotion failed: ${result.demoted.error}`
        : ` They reached 3 strikes and were demoted to ${result.demoted.to}.`;
    }
    return i.editReply(message);
  }
};
