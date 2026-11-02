const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('./store');

// Every embed the bot sends uses this yellow.
const COLOR = 0xffd43b;

// Config keys, grouped so /config view stays organized.
// Each entry is [key, label]. The key is what gets saved in data/data.json.
const GROUPS = [
  {
    id: 'channels',
    title: '📍 Channels',
    kind: 'channel',
    keys: [
      ['welcome_channel', 'Welcome'],
      ['log_channel', 'Message and anti raid logs'],
      ['transcript_channel', 'Transcripts'],
      ['application_channel', 'Application review'],
      ['changelog_channel', 'Promotion changelog'],
      ['activity_channel', 'Activity checks'],
      ['partner_channel', 'Partner submissions'],
      ['schematic_channel', 'Schematic submissions'],
      ['levelup_channel', 'Level up messages'],
      ['levels_channel', 'Levels info']
    ]
  },
  {
    id: 'categories',
    title: '📁 Categories',
    kind: 'category',
    keys: [
      ['ticket_category', 'Tickets'],
      ['middleman_category', 'Middleman tickets'],
      ['building_category', 'Building tickets'],
      ['spawner_category', 'Spawner tickets'],
      ['ad_category', 'Paid ad tickets']
    ]
  },
  {
    id: 'staff',
    title: '🛡️ Staff Roles',
    kind: 'role',
    keys: [
      ['staff_role', 'Staff'],
      ['mod_role', 'Mod commands'],
      ['coowner_role', 'Co Owner']
    ]
  },
  {
    id: 'ticketstaff',
    title: '🎫 Ticket Staff Roles',
    kind: 'role',
    keys: [
      ['support_staff_role', 'Support'],
      ['claim_staff_role', 'Giveaway claims'],
      ['middleman_staff_role', 'Middleman'],
      ['digout_staff_role', 'Digout'],
      ['base_staff_role', 'Base, regear and gamble'],
      ['spawner_staff_role', 'Spawner'],
      ['ad_staff_role', 'Paid ads']
    ]
  },
  {
    id: 'pings',
    title: '🔔 Ping Roles',
    kind: 'role',
    keys: [
      ['support_role', 'Ticket ping'],
      ['middleman_role', 'Middleman ping'],
      ['builder_role', 'Builder ping'],
      ['schematic_ping_role', 'Schematic'],
      ['announcement_ping_role', 'Announcement'],
      ['partner_ping_role', 'Partner'],
      ['gambling_ping_role', 'Gambling'],
      ['giveaway_ping_role', 'Giveaway'],
      ['spawner_ping_role', 'Spawner'],
      ['stream_ping_role', 'Stream'],
      ['marker_ping_role', 'Marker']
    ]
  }
];

// key -> label, used by /config set and its autocomplete.
const KEYS = Object.fromEntries(
  GROUPS.flatMap(g => g.keys.map(([key, label]) => [key, `${g.title.replace(/^\S+\s/, '')}: ${label}`]))
);

function embed(guild) {
  return new EmbedBuilder().setColor(COLOR).setFooter({ text: guild.name });
}

function pad(n) {
  return String(n).padStart(4, '0');
}

function utcStamp(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  return `${d} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${h}:${m} UTC`;
}

function ticketFooter(number, label = 'Ticket') {
  return `${label} ${pad(number)} | ${utcStamp()}`;
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) || member.id === member.guild.ownerId;
}

function isManager(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function staffRoleIds(guild) {
  const cfg = store.guild(guild.id).cfg;
  return [cfg.staff_role, cfg.mod_role, ...(cfg.staff_ranks || [])].filter(Boolean);
}

function isStaff(member) {
  return isManager(member) || staffRoleIds(member.guild).some(id => member.roles.cache.has(id));
}

function isMod(member, permission) {
  const cfg = store.guild(member.guild.id).cfg;
  if (isManager(member)) return true;
  if (cfg.mod_role && member.roles.cache.has(cfg.mod_role)) return true;
  return permission ? member.permissions.has(permission) : false;
}

function parseId(text) {
  const match = String(text || '').match(/\d{15,22}/);
  return match ? match[0] : null;
}

function parseMoney(text) {
  const match = String(text || '')
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d+)?)\s*([kmbt]?)/i);
  if (!match) return NaN;
  const scale = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  return parseFloat(match[1]) * scale[match[2].toLowerCase()];
}

function slug(text, max = 24) {
  const out = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return out || 'ticket';
}

async function getChannel(guild, key) {
  const id = store.guild(guild.id).cfg[key];
  if (!id) return null;
  return guild.channels.cache.get(id) || (await guild.channels.fetch(id).catch(() => null));
}

async function send(guild, key, payload) {
  const channel = await getChannel(guild, key);
  if (!channel || !channel.isTextBased()) return null;
  return channel.send(payload).catch(() => null);
}

function shorten(text, max = 1000) {
  const value = String(text || '');
  return value.length > max ? value.slice(0, max - 3) + '...' : value;
}

module.exports = {
  COLOR,
  GROUPS,
  KEYS,
  embed,
  pad,
  utcStamp,
  ticketFooter,
  isAdmin,
  isManager,
  isMod,
  isStaff,
  staffRoleIds,
  parseId,
  parseMoney,
  slug,
  getChannel,
  send,
  shorten
};
