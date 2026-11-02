const { SlashCommandBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isStaff, COLOR } = require('../utils/util');
const { lockChannel } = require('../utils/lockdown');

// /lock [channel] - lock a channel for @everyone. Posts "## #channel has been locked by @user".
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to lock (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDMPermission(false),

  async execute(interaction) {
    const allowed = isStaff(interaction.member) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
    if (!allowed) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;

    let result;
    try {
      result = await lockChannel(channel, interaction.user);
    } catch (err) {
      console.error('/lock failed:', err);
      return interaction.reply({
        content: `I couldn't change permissions in ${channel}. I need **Manage Channels** and **Manage Roles**, and my role has to be able to see that channel.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (result.already) {
      return interaction.reply({ content: `${channel} is already locked.`, flags: MessageFlags.Ephemeral });
    }

    // ${channel} renders as the clickable #channel, not the word "channel".
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setDescription(`## 🔒 ${channel} has been locked by ${interaction.user}`);

    // Replying to the interaction works even in a channel the bot can't type in.
    if (channel.id === interaction.channelId) {
      return interaction.reply({ embeds: [embed] });
    }

    await channel.send({ embeds: [embed] }).catch(() => {});
    return interaction.reply({ content: `${channel} has been locked.`, flags: MessageFlags.Ephemeral });
  },
};
