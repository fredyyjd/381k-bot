const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { store, canManage, endGiveaway } = require('../utils/giveaways');

// /gend <message_id> — ends a running giveaway right now and picks winners.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway now (staff only)')
    .addStringOption((o) =>
      o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!canManage(interaction)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const id = interaction.options.getString('message_id').trim();
    const g = store.get(id);
    if (!g || g.guildId !== interaction.guild.id) {
      return interaction.reply({ content: 'No giveaway found with that message ID.', flags: MessageFlags.Ephemeral });
    }
    if (g.ended) {
      return interaction.reply({ content: 'That giveaway has already ended.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await endGiveaway(interaction.client, id, { early: true });
    return interaction.editReply({ content: 'Giveaway ended.' });
  },
};
