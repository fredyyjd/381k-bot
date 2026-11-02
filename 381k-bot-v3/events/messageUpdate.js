const { Events } = require('discord.js');
const store = require('../utils/store');
const { embed, send, shorten } = require('../utils/util');

module.exports = {
  name: Events.MessageUpdate,
  async execute(before, after) {
    if (!after.guild || after.author?.bot) return;
    if (before.partial || after.partial) return;
    if (before.content === after.content) return;
    const cfg = store.guild(after.guild.id).cfg;
    if (after.channelId === cfg.log_channel) return;
    const e = embed(after.guild)
      .setTitle('Message Edited')
      .addFields(
        { name: 'Author', value: `${after.author}`, inline: true },
        { name: 'Channel', value: `${after.channel} [Jump](${after.url})`, inline: true },
        { name: 'Before', value: shorten(before.content || 'No text content', 1000) },
        { name: 'After', value: shorten(after.content || 'No text content', 1000) }
      );
    await send(after.guild, 'log_channel', { embeds: [e] });
  }
};
