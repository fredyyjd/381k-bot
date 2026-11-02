const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('./store');

const COLOR = 0x2b2d31;

const KEYS = {
  welcome_channel: 'Welcome channel',
  log_channel: 'Message and anti raid logs channel',
  transcript_channel: 'Transcript channel',
  application_channel: 'Application review channel',
  changelog_channel: 'Promotion changelog channel',
  activity_channel: 'Activity check channel',
  partner_channel: 'Partner submission channel',
  schematic_channel: 'Schematic submission channel',
  levelup_channel: 'Level up message channel',
  levels_channel: 'Levels info channel',
  ticket_category: 'Ticket category',
  middleman_category: 'Middleman ticket category',
  building_category: 'Building ticket category',
  spawner_category: 'Spawner ticket category',
  ad_category: 'Paid ad ticket category',
  staff_role: 'Staff role',
  mod_role: 'Mod commands role',
  coowner_role: 'Co Owner role',
  support_role: 'Ticket ping role',
  middleman_role: 'Middleman ping role',
  builder_role: 'Builder ping role',
  support_staff_role: 'Support tickets staff role',
  claim_staff_role: 'Giveaway claim tickets staff role',
  middleman_staff_role: 'Middleman tickets staff role',
  digout_staff_role: 'Digout tickets staff role',
  base_staff_role: 'Base, regear and gamble tickets staff role',
  spawner_staff_role: 'Spawner tickets staff role',
  ad_staff_role: 'Paid ad tickets staff role',
  schematic_ping_role: 'Schematic ping role',
  announcement_ping_role: 'Announcement ping role',
  partner_ping_role: 'Partner ping role',
  gambling_ping_role: 'Gambling ping role',
  giveaway_ping_role: 'Giveaway ping role',
  spawner_ping_role: 'Spawner ping role',
  stream_ping_role: 'Stream ping role',
  marker_ping_role: 'Marker ping role'
};

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
