const { SlashCommandBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isStaff } = require('../utils/util');
const { unlockChannel } = require('../utils/lockdown');

// /unlock [channel] - unlock a channel for @everyone. Posts "## #channel has been unlocked by @user".
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to unlock (defaults to this channel)')
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
      result = await unlockChannel(channel, interaction.user);
    } catch (err) {
      console.error('/unlock failed:', err);
      return interaction.reply({
        content: `I couldn't change permissions in ${channel}. I need **Manage Channels** and **Manage Roles**, and my role has to be able to see that channel.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (result.already) {
      return interaction.reply({ content: `${channel} isn't locked.`, flags: MessageFlags.Ephemeral });
    }

    // ${channel} renders as the clickable #channel, not the word "channel".
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`## ${channel} has been unlocked by ${interaction.user}`);

    // Replying to the interaction works even in a channel the bot can't type in.
    if (channel.id === interaction.channelId) {
      return interaction.reply({ embeds: [embed] });
    }

    await channel.send({ embeds: [embed] }).catch(() => {});
    return interaction.reply({ content: `${channel} has been unlocked.`, flags: MessageFlags.Ephemeral });
  },
};
