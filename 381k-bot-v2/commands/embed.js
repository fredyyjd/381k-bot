const { SlashCommandBuilder, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const { isStaff, COLOR } = require('../utils/util');
const { resolveEmojiShortcodes } = require('../utils/parseEmoji');

// /embed type: title: description: - posts an embed (yellow by default) or plain text.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Post an embed or plain text')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Embed or plain text (default embed)')
        .addChoices({ name: 'Embed', value: 'embed' }, { name: 'Plain text', value: 'plaintext' })
    )
    .addStringOption((o) => o.setName('title').setDescription('Title').setMaxLength(256))
    .addStringOption((o) => o.setName('description').setDescription('Main text').setMaxLength(4000))
    .addStringOption((o) => o.setName('color').setDescription('Hex color, default yellow'))
    .addStringOption((o) => o.setName('image').setDescription('Large image URL'))
    .addStringOption((o) => o.setName('thumbnail').setDescription('Small image URL'))
    .addStringOption((o) => o.setName('footer').setDescription('Footer text').setMaxLength(2048))
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post (default here)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const guild = interaction.guild;
    const type = interaction.options.getString('type') || 'embed';
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
        content: 'Give at least a title, description or image. An empty message cannot be sent.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let payload;
    if (type === 'plaintext') {
      // Plain text: title (if any) on the first line, then the description, then the image link.
      const content = [title, description, image].filter(Boolean).join('\n').slice(0, 2000);
      payload = { content };
    } else {
      let color = COLOR;
      if (colorInput) {
        const parsed = parseInt(colorInput.replace('#', ''), 16);
        if (Number.isNaN(parsed)) {
          return interaction.reply({
            content: `"${colorInput}" isn't a valid hex color. Try something like #ffd43b.`,
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
      payload = { embeds: [embed] };
    }

    try {
      await target.send(payload);
    } catch (err) {
      console.error('Failed to send /embed:', err);
      return interaction.reply({
        content: `I couldn't post that. Check my permissions in ${target} and the image links.\n\`\`\`${err.message}\`\`\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ content: `✅ Posted in ${target}.`, flags: MessageFlags.Ephemeral });
  },
};
