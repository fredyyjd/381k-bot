const { SlashCommandBuilder, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const { isStaff } = require('../utils/util');
const { resolveEmojiShortcodes } = require('../utils/parseEmoji');

// /embed title: description: — posts a custom embed (staff only).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Post a custom embed')
    .addStringOption((o) => o.setName('title').setDescription('Embed title').setMaxLength(256))
    .addStringOption((o) => o.setName('description').setDescription('Embed description').setMaxLength(4000))
    .addStringOption((o) => o.setName('color').setDescription('Hex color, e.g. #5865f2'))
    .addStringOption((o) => o.setName('image').setDescription('Large image URL'))
    .addStringOption((o) => o.setName('thumbnail').setDescription('Small thumbnail image URL'))
    .addStringOption((o) => o.setName('footer').setDescription('Footer text').setMaxLength(2048))
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to post in (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const guild = interaction.guild;
    const title = resolveEmojiShortcodes(guild, interaction.options.getString('title'));
    // "\n" typed in the slash box becomes a real new line.
    const description = resolveEmojiShortcodes(guild, interaction.options.getString('description'))?.replace(/\\n/g, '\n');
    const colorInput = interaction.options.getString('color');
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = resolveEmojiShortcodes(guild, interaction.options.getString('footer'));
    const target = interaction.options.getChannel('channel') || interaction.channel;

    if (!title && !description && !image && !thumbnail) {
      return interaction.reply({
        content: 'Give at least a title, description, image or thumbnail. An empty embed cannot be sent.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let color = 0x5865f2;
    if (colorInput) {
      const parsed = parseInt(colorInput.replace('#', ''), 16);
      if (Number.isNaN(parsed)) {
        return interaction.reply({
          content: `"${colorInput}" isn't a valid hex color. Try something like #5865f2.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      color = parsed;
    }

    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (footer) embed.setFooter({ text: footer });

    try {
      await target.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send /embed:', err);
      return interaction.reply({
        content: `I couldn't post that embed. Check my permissions in ${target} and the image links.\n\`\`\`${err.message}\`\`\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ content: `Embed posted in ${target}.`, flags: MessageFlags.Ephemeral });
  },
};
