const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const store = require('../utils/store');
const { KEYS, embed, isAdmin, parseId } = require('../utils/util');
const { EPHEMERAL, deny, text } = require('../utils/reply');

// /config and /configids are the same command under two names.
function build(name) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Change channel, category and role IDs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('view').setDescription('View the current configuration'))
    .addSubcommand(s =>
      s
        .setName('set')
        .setDescription('Set a channel, category or role ID')
        .addStringOption(o => o.setName('key').setDescription('What to change').setRequired(true).setAutocomplete(true))
        .addStringOption(o => o.setName('id').setDescription('ID or mention, or none to clear').setRequired(true))
    )
    .addSubcommand(s =>
      s
        .setName('ranks')
        .setDescription('Set staff rank roles, highest first')
        .addStringOption(o => o.setName('roles').setDescription('Role IDs or mentions, highest first').setRequired(true))
    );
}

function configLine(key, id) {
  if (!id) return 'Not set';
  return key.endsWith('_role') ? `<@&${id}>` : `<#${id}>`;
}

async function configView(i) {
  const cfg = store.guild(i.guild.id).cfg;
  const lines = Object.entries(KEYS).map(([key, label]) => `${label}: ${configLine(key, cfg[key])}`);
  const ranks = (cfg.staff_ranks || []).map(id => `<@&${id}>`).join(', ') || 'Not set';
  lines.push(`Staff ranks, highest first: ${ranks}`);
  const e = embed(i.guild).setTitle('Configuration').setDescription(lines.join('\n'));
  return i.reply({ embeds: [e], flags: EPHEMERAL });
}

async function configSet(i) {
  const key = i.options.getString('key');
  const value = i.options.getString('id');
  const cfg = store.guild(i.guild.id).cfg;
  if (!KEYS[key]) return text(i, 'Unknown key. Pick one from the list.');

  if (value.trim().toLowerCase() === 'none') {
    delete cfg[key];
    store.save();
    return text(i, `${KEYS[key]} cleared.`);
  }

  const id = parseId(value);
  if (!id) return text(i, 'That is not a valid ID.');

  if (key.endsWith('_role')) {
    if (!i.guild.roles.cache.has(id)) return text(i, 'That role does not exist in this server.');
  } else {
    const channel = i.guild.channels.cache.get(id);
    if (!channel) return text(i, 'That channel does not exist in this server.');
    if (key.endsWith('_category') && channel.type !== ChannelType.GuildCategory) {
      return text(i, 'That ID is not a category.');
    }
    if (key.endsWith('_channel') && !channel.isTextBased()) return text(i, 'That ID is not a text channel.');
  }

  cfg[key] = id;
  store.save();
  return text(i, `${KEYS[key]} set to ${configLine(key, id)}.`);
}

async function configRanks(i) {
  const ids = [...i.options.getString('roles').matchAll(/\d{15,22}/g)].map(m => m[0]);
  const valid = [...new Set(ids)].filter(id => i.guild.roles.cache.has(id));
  if (!valid.length) return text(i, 'No valid roles were found.');
  store.guild(i.guild.id).cfg.staff_ranks = valid;
  store.save();
  return text(i, `Staff ranks saved: ${valid.map(id => `<@&${id}>`).join(', ')}`);
}

module.exports = {
  build,
  data: build('config'),

  async execute(i) {
    if (!i.guild) return;
    if (!isAdmin(i.member)) return deny(i);
    const sub = i.options.getSubcommand();
    if (sub === 'view') return configView(i);
    if (sub === 'set') return configSet(i);
    if (sub === 'ranks') return configRanks(i);
  },

  async autocomplete(i) {
    if (!i.guild || !isAdmin(i.member)) return i.respond([]);
    const focused = i.options.getFocused().toLowerCase();
    const out = Object.entries(KEYS)
      .filter(([key, label]) => key.includes(focused) || label.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(([value, name]) => ({ name, value }));
    return i.respond(out);
  }
};
