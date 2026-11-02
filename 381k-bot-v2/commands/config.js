const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const store = require('../utils/store');
const botConfig = require('../config');
const { GROUPS, KEYS, embed, isAdmin, parseId } = require('../utils/util');
const { EPHEMERAL, deny, text } = require('../utils/reply');

// /config is the one and only config command.
// view   - everything that is saved, grouped
// set    - one channel, category or role
// ranks  - staff rank ladder, highest first
// demote - roles a member can be demoted to (helper, mod, ...)

function mention(kind, id) {
  if (!id) return '`not set`';
  return kind === 'role' ? `<@&${id}>` : `<#${id}>`;
}

function roleList(ids, numbered = false) {
  if (!ids || !ids.length) return '`not set`';
  return ids.map((id, n) => (numbered ? `**${n + 1}.** <@&${id}>` : `<@&${id}>`)).join('\n');
}

function parseRoles(i, input) {
  const ids = [...String(input).matchAll(/\d{15,22}/g)].map(m => m[0]);
  return [...new Set(ids)].filter(id => i.guild.roles.cache.has(id));
}

async function configView(i) {
  const cfg = store.guild(i.guild.id).cfg;
  const e = embed(i.guild).setTitle('⚙️ Configuration');

  let total = 0;
  let filled = 0;
  for (const group of GROUPS) {
    const lines = group.keys.map(([key, label]) => {
      total += 1;
      if (cfg[key]) filled += 1;
      return `▸ **${label}** ${mention(group.kind, cfg[key])}`;
    });
    e.addFields({ name: group.title, value: lines.join('\n') });
  }

  e.addFields(
    { name: '🏅 Staff Ranks (highest first)', value: roleList(cfg.staff_ranks, true), inline: true },
    { name: '⬇️ Demotion Roles', value: roleList(cfg.demote_roles), inline: true },
    {
      name: '📝 Staff Applications',
      value: [
        `▸ **Review channel** ${mention('channel', botConfig.staffApplication.reviewChannelId)}`,
        `▸ **Time limit** ${botConfig.staffApplication.timeLimitHours}h`,
        `▸ **Reapply wait** ${botConfig.staffApplication.reapplyDays}d`
      ].join('\n')
    }
  );

  e.setDescription(`**${filled}/${total}** IDs set. Use \`/config set\` to change one.`);
  return i.reply({ embeds: [e], flags: EPHEMERAL });
}

async function configSet(i) {
  const key = i.options.getString('key');
  const value = i.options.getString('id');
  const cfg = store.guild(i.guild.id).cfg;
  if (!KEYS[key]) return text(i, 'Unknown key. Pick one from the list.');
  const group = GROUPS.find(g => g.keys.some(([k]) => k === key));

  if (value.trim().toLowerCase() === 'none') {
    delete cfg[key];
    store.save();
    return text(i, `✅ ${KEYS[key]} cleared.`);
  }

  const id = parseId(value);
  if (!id) return text(i, 'That is not a valid ID.');

  if (group.kind === 'role') {
    if (!i.guild.roles.cache.has(id)) return text(i, 'That role does not exist in this server.');
  } else {
    const channel = i.guild.channels.cache.get(id);
    if (!channel) return text(i, 'That channel does not exist in this server.');
    if (group.kind === 'category' && channel.type !== ChannelType.GuildCategory) {
      return text(i, 'That ID is not a category.');
    }
    if (group.kind === 'channel' && !channel.isTextBased()) return text(i, 'That ID is not a text channel.');
  }

  cfg[key] = id;
  store.save();
  return text(i, `✅ ${KEYS[key]} set to ${mention(group.kind, id)}.`);
}

async function configRanks(i) {
  const valid = parseRoles(i, i.options.getString('roles'));
  if (!valid.length) return text(i, 'No valid roles were found.');
  store.guild(i.guild.id).cfg.staff_ranks = valid;
  store.save();
  return text(i, `✅ Staff ranks saved, highest first:\n${roleList(valid, true)}`);
}

async function configDemote(i) {
  const input = i.options.getString('roles');
  const cfg = store.guild(i.guild.id).cfg;
  if (input.trim().toLowerCase() === 'none') {
    delete cfg.demote_roles;
    store.save();
    return text(i, '✅ Demotion roles cleared.');
  }
  const valid = parseRoles(i, input);
  if (!valid.length) return text(i, 'No valid roles were found.');
  cfg.demote_roles = valid;
  store.save();
  return text(i, `✅ Demotion roles saved:\n${roleList(valid)}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Change channel, category and role IDs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('view').setDescription('View every saved ID'))
    .addSubcommand(s =>
      s
        .setName('set')
        .setDescription('Set a channel, category or role')
        .addStringOption(o => o.setName('key').setDescription('What to change').setRequired(true).setAutocomplete(true))
        .addStringOption(o => o.setName('id').setDescription('ID or mention, or none to clear').setRequired(true))
    )
    .addSubcommand(s =>
      s
        .setName('ranks')
        .setDescription('Set staff ranks, highest first')
        .addStringOption(o => o.setName('roles').setDescription('Role IDs or mentions, highest first').setRequired(true))
    )
    .addSubcommand(s =>
      s
        .setName('demote')
        .setDescription('Set the roles members can be demoted to')
        .addStringOption(o => o.setName('roles').setDescription('Role IDs or mentions, or none to clear').setRequired(true))
    ),

  async execute(i) {
    if (!i.guild) return;
    if (!isAdmin(i.member)) return deny(i);
    const sub = i.options.getSubcommand();
    if (sub === 'view') return configView(i);
    if (sub === 'set') return configSet(i);
    if (sub === 'ranks') return configRanks(i);
    if (sub === 'demote') return configDemote(i);
  },

  async autocomplete(i) {
    if (!i.guild || !isAdmin(i.member)) return i.respond([]);
    const focused = i.options.getFocused().toLowerCase();
    const out = Object.entries(KEYS)
      .filter(([key, label]) => key.includes(focused) || label.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(([value, name]) => ({ name: name.slice(0, 100), value }));
    return i.respond(out);
  }
};
