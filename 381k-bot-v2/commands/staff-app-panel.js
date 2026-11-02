const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isStaff } = require('../utils/util');
const { panelPayload } = require('../utils/staffApp');

// /staff-app-panel — posts the blue "Staff Application" button in this channel.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-app-panel')
    .setDescription('Post the Staff Application button in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    await interaction.channel.send(panelPayload());
    return interaction.reply({ content: 'Staff application panel posted.', flags: MessageFlags.Ephemeral });
  },
};
