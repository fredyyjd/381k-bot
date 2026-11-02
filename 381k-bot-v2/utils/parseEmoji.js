// Slash-command text options don't expand custom emoji: typing :name: stays
// ":name:". This swaps in the server's real emoji tag when one matches, so
// /embed text renders properly. Unmatched shortcodes are left as they are.
function resolveEmojiShortcodes(guild, text) {
  if (!text || !guild) return text;
  return text.replace(/:(\w+):/g, (full, name) => {
    const emoji = guild.emojis.cache.find((e) => e.name === name);
    return emoji ? emoji.toString() : full;
  });
}

module.exports = { resolveEmojiShortcodes };
