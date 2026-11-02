const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('../utils/store');
const { embed, isManager, shorten } = require('../utils/util');
const { EPHEMERAL, deny } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikelist')
    .setDescription('View strikes of a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),

  async execute(i) {
    if (!i.guild) return;
    if (!isManager(i.member)) return deny(i);
    const user = i.options.getUser('user');
    const list = (store.guild(i.guild.id).strikes[user.id] || []).sort((a, b) => a.number - b.number);
    const e = embed(i.guild).setTitle(`Strikes for ${user.username}`);
    if (!list.length) e.setDescription('No strikes.');
    for (const s of list) {
      e.addFields({
        name: `Strike ${s.number}`,
        value: shorten(`${s.reason}\nBy <@${s.by}> <t:${Math.floor(s.at / 1000)}:R>`, 1000)
      });
    }
    return i.reply({ embeds: [e], flags: EPHEMERAL });
  }
};
