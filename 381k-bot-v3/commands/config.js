const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder
} = require('discord.js');
const store = require('../utils/store');
const botConfig = require('../config');
const { GROUPS, keyInfo, embed, isAdmin } = require('../utils/util');
const { EPHEMERAL, deny } = require('../utils/reply');

// /config is the only config command. It opens a panel: pick what to change,
// then pick the channel or role from the menu. Nothing to type.

// Lists of roles instead of a single id.
const MULTI = {
  ranks: { cfgKey: 'staff_ranks', title: '🏅 Staff Ranks', max: 10, note: 'Pick every staff rank. They are ordered by the server role list, highest first.' },
  demote: { cfgKey: 'demote_roles', title: '⬇️ Demotion Roles', max: 10, note: 'Pick the roles a member can be demoted to, like helper or mod.' }
};

// Staff application values fall back to config.js until you pick one here.
const FALLBACK = {
  staffapp_review_channel: 'reviewChannelId',
  staffapp_ping_role: 'pingRoleId',
  staffapp_accepted_role: 'acceptedRoleId'
};

const CHANNEL_TYPES = {
  channel: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
  category: [ChannelType.GuildCategory]
};

function current(cfg, key) {
  return cfg[key] || (FALLBACK[key] ? botConfig.staffApplication[FALLBACK[key]] : '') || '';
}

function mention(kind, id) {
  if (!id) return '`not set`';
  return kind === 'role' ? `<@&${id}>` : `<#${id}>`;
}

function roleList(ids, numbered = false) {
  if (!ids || !ids.length) return '`not set`';
  return ids.map((id, n) => (numbered ? `**${n + 1}.** <@&${id}>` : `<@&${id}>`)).join('\n');
}

const splitTitle = title => {
  const [emoji, ...rest] = title.split(' ');
  return { emoji, name: rest.join(' ') };
};

const backButton = (customId, label = 'Back') =>
  new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Secondary);

// ---------- pages ----------

function home(guild, notice) {
  const cfg = store.guild(guild.id).cfg;
  const e = embed(guild).setTitle('⚙️ Configuration');

  let total = 0;
  let filled = 0;
  for (const group of GROUPS) {
    const lines = group.keys.map(([key, label, kind]) => {
      total += 1;
      const value = current(cfg, key);
      if (value) filled += 1;
      return `▸ **${label}** ${mention(kind || group.kind, value)}`;
    });
    e.addFields({ name: group.title, value: lines.join('\n') });
  }
  e.addFields(
    { name: MULTI.ranks.title, value: roleList(cfg.staff_ranks, true), inline: true },
    { name: MULTI.demote.title, value: roleList(cfg.demote_roles), inline: true }
  );
  e.setDescription(`${notice ? `${notice}\n` : ''}**${filled}/${total}** IDs set. Pick what to change below.`);

  const menu = new StringSelectMenuBuilder().setCustomId('cfg:group').setPlaceholder('What do you want to change?');
  for (const group of GROUPS) {
    const { emoji, name } = splitTitle(group.title);
    menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(name).setValue(group.id).setEmoji(emoji));
  }
  for (const [id, m] of Object.entries(MULTI)) {
    const { emoji, name } = splitTitle(m.title);
    menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(name).setValue(id).setEmoji(emoji));
  }
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(menu)] };
}

function groupPage(guild, groupId, notice) {
  const group = GROUPS.find(g => g.id === groupId);
  const cfg = store.guild(guild.id).cfg;
  const lines = group.keys.map(([key, label, kind]) => `▸ **${label}** ${mention(kind || group.kind, current(cfg, key))}`);
  const e = embed(guild)
    .setTitle(group.title)
    .setDescription(`${notice ? `${notice}\n\n` : ''}${lines.join('\n')}\n\nPick one to change.`);

  const menu = new StringSelectMenuBuilder().setCustomId(`cfg:key:${group.id}`).setPlaceholder('Pick a setting');
  for (const [key, label, kind] of group.keys) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(key)
        .setDescription(current(cfg, key) ? 'Set' : 'Not set')
    );
  }
  return {
    embeds: [e],
    components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(backButton('cfg:home'))]
  };
}

function keyPage(guild, key) {
  const { group, label, kind } = keyInfo(key);
  const cfg = store.guild(guild.id).cfg;
  const e = embed(guild)
    .setTitle(`${splitTitle(group.title).emoji} ${label}`)
    .setDescription(`Right now: ${mention(kind, current(cfg, key))}\n\nPick the new ${kind === 'role' ? 'role' : kind} below.`);

  const picker =
    kind === 'role'
      ? new RoleSelectMenuBuilder().setCustomId(`cfg:val:${key}`).setPlaceholder(`Pick a role`)
      : new ChannelSelectMenuBuilder()
          .setCustomId(`cfg:val:${key}`)
          .setPlaceholder(`Pick a ${kind}`)
          .setChannelTypes(...CHANNEL_TYPES[kind]);
  const buttons = new ActionRowBuilder().addComponents(
    backButton(`cfg:back:${group.id}`),
    new ButtonBuilder().setCustomId(`cfg:clear:${key}`).setLabel('Clear').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(picker), buttons] };
}

function multiPage(guild, id) {
  const m = MULTI[id];
  const cfg = store.guild(guild.id).cfg;
  const e = embed(guild)
    .setTitle(m.title)
    .setDescription(`${m.note}\n\nRight now:\n${roleList(cfg[m.cfgKey], id === 'ranks')}`);
  const picker = new RoleSelectMenuBuilder()
    .setCustomId(`cfg:multi:${id}`)
    .setPlaceholder('Pick the roles')
    .setMinValues(1)
    .setMaxValues(m.max);
  const buttons = new ActionRowBuilder().addComponents(
    backButton('cfg:home'),
    new ButtonBuilder().setCustomId(`cfg:clear:${id}`).setLabel('Clear').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(picker), buttons] };
}

// ---------- clicks ----------

async function route(i) {
  if (!i.guild) return;
  if (!isAdmin(i.member)) return deny(i);
  const [, action, arg] = i.customId.split(':');
  const guild = i.guild;
  const cfg = store.guild(guild.id).cfg;

  if (action === 'home') return i.update(home(guild));
  if (action === 'back') return i.update(groupPage(guild, arg));

  if (action === 'group') {
    const id = i.values[0];
    return i.update(MULTI[id] ? multiPage(guild, id) : groupPage(guild, id));
  }

  if (action === 'key') {
    const key = i.values[0];
    if (!keyInfo(key)) return i.update(home(guild));
    return i.update(keyPage(guild, key));
  }

  if (action === 'val') {
    const info = keyInfo(arg);
    if (!info) return i.update(home(guild));
    cfg[arg] = i.values[0];
    store.save();
    return i.update(groupPage(guild, info.group.id, `✅ **${info.label}** set to ${mention(info.kind, i.values[0])}.`));
  }

  if (action === 'multi') {
    const m = MULTI[arg];
    if (!m) return i.update(home(guild));
    // Highest role in the server list comes first.
    const roles = i.values
      .map(id => guild.roles.cache.get(id))
      .filter(r => r && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.id);
    if (!roles.length) return i.update(multiPage(guild, arg));
    cfg[m.cfgKey] = roles;
    store.save();
    return i.update(home(guild, `✅ **${splitTitle(m.title).name}** saved.`));
  }

  if (action === 'clear') {
    const m = MULTI[arg];
    if (m) {
      delete cfg[m.cfgKey];
      store.save();
      return i.update(home(guild, `✅ **${splitTitle(m.title).name}** cleared.`));
    }
    const info = keyInfo(arg);
    if (!info) return i.update(home(guild));
    delete cfg[arg];
    store.save();
    return i.update(groupPage(guild, info.group.id, `✅ **${info.label}** cleared.`));
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Change channels, roles and categories')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(i) {
    if (!i.guild) return;
    if (!isAdmin(i.member)) return deny(i);
    return i.reply({ ...home(i.guild), flags: EPHEMERAL });
  },

  route
};
