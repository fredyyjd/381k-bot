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
    .addStringOption(o => o.setName('role').setDescription('Role to demote to').setAutocomplete(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const member = i.options.getMember('user');
    if (!member) return text(i, 'That member is not in this server.');

    const roleId = i.options.getString('role');
    if (roleId && !staff.demoteRoles(i.guild).includes(roleId)) {
      return text(i, 'Pick one of the demotion roles from the list. Admins set them with /config demote.');
    }

    await i.deferReply({ flags: EPHEMERAL });
    const result = await staff.demoteMember(i.guild, member, i.user, i.options.getString('reason'), false, roleId);
    if (result.error) return i.editReply(result.error);
    return i.editReply(`⬇️ Demoted ${member} from ${result.from} to ${result.to}. Strikes were reset.`);
  },

  async autocomplete(i) {
    if (!i.guild || !isManager(i.member)) return i.respond([]);
    const focused = i.options.getFocused().toLowerCase();
    const out = staff
      .demoteRoles(i.guild)
      .map(id => i.guild.roles.cache.get(id))
      .filter(role => role && role.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(role => ({ name: role.name.slice(0, 100), value: role.id }));
    return i.respond(out);
  }
};
