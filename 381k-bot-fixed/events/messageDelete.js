const { Events } = require('discord.js');
const store = require('../utils/store');
const { embed, send, shorten } = require('../utils/util');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;
    if (!message.author && !message.content) return;
    const cfg = store.guild(message.guild.id).cfg;
    if (message.channelId === cfg.log_channel) return;
    const e = embed(message.guild)
      .setTitle('Message Deleted')
      .addFields(
        { name: 'Author', value: message.author ? `${message.author}` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
        { name: 'Content', value: shorten(message.content || 'No text content', 1000) }
      );
    if (message.attachments?.size) {
      e.addFields({ name: 'Attachments', value: shorten([...message.attachments.values()].map(a => a.name).join('\n'), 1000) });
    }
    await send(message.guild, 'log_channel', { embeds: [e] });
  }
};
