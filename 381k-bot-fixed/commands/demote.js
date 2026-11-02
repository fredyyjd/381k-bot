const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const staff = require('../utils/staff');
const { isManager } = require('../utils/util');
const { EPHEMERAL, deny, text } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote member and reset strikes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const member = i.options.getMember('user');
    if (!member) return text(i, 'That member is not in this server.');
    await i.deferReply({ flags: EPHEMERAL });
    const result = await staff.demoteMember(i.guild, member, i.user, i.options.getString('reason'));
    if (result.error) return i.editReply(result.error);
    return i.editReply(`Demoted ${member} from ${result.from} to ${result.to}. Strikes were reset.`);
  }
};
