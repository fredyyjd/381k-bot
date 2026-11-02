const { Events } = require('discord.js');
const store = require('../utils/store');
const { embed, isStaff, send } = require('../utils/util');
const staff = require('../utils/staff');
const levels = require('../utils/levels');
const prefix = require('../utils/prefix');
const staffApp = require('../utils/staffApp');

const bursts = new Map();

const SPAM_LIMIT = 5;
const SPAM_WINDOW = 5000;
const MENTION_LIMIT = 6;

// Anti raid: mass mentions and message spam (staff are ignored).
async function guard(message) {
  if (message.author.bot || !message.member || isStaff(message.member)) return false;
  const guild = message.guild;

  if (message.mentions.users.size >= MENTION_LIMIT) {
    await message.delete().catch(() => {});
    if (message.member.moderatable) await message.member.timeout(3600000, 'Anti raid: mass mention').catch(() => {});
    await send(guild, 'log_channel', {
      embeds: [
        embed(guild)
          .setTitle('Mass Mention Blocked')
          .setDescription(`${message.author} mentioned ${message.mentions.users.size} users in ${message.channel} and was timed out for 1 hour.`)
      ]
    });
    return true;
  }

  const key = `${guild.id}:${message.author.id}`;
  const now = Date.now();
  const list = (bursts.get(key) || []).filter(m => now - m.time < SPAM_WINDOW);
  list.push({ time: now, id: message.id, channel: message.channelId });
  bursts.set(key, list);

  if (list.length >= SPAM_LIMIT) {
    bursts.set(key, []);
    const ids = list.filter(m => m.channel === message.channelId).map(m => m.id);
    await message.channel.bulkDelete(ids, true).catch(() => {});
    if (message.member.moderatable) await message.member.timeout(600000, 'Anti raid: spam').catch(() => {});
    await send(guild, 'log_channel', {
      embeds: [
        embed(guild)
          .setTitle('Spam Blocked')
          .setDescription(`${message.author} sent ${list.length} messages in ${SPAM_WINDOW / 1000} seconds in ${message.channel} and was timed out for 10 minutes.`)
      ]
    });
    return true;
  }
  return false;
}

// Partner invites and schematic uploads count for staff.
async function track(message) {
  if (message.author.bot || !message.member || !isStaff(message.member)) return;
  const g = store.guild(message.guild.id);
  const cfg = g.cfg;

  if (cfg.partner_channel === message.channelId && /discord\.gg\/|discord(?:app)?\.com\/invite\//i.test(message.content)) {
    g.partner[message.author.id] = (g.partner[message.author.id] || 0) + 1;
    store.save();
  }

  if (cfg.schematic_channel === message.channelId && message.attachments.size > 0) {
    const points = staff.schematic(g);
    points[message.author.id] = (points[message.author.id] || 0) + 1;
    store.save();
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    // DMs: answers to the staff application questions.
    if (!message.guild) return staffApp.handleDmMessage(message, client);

    if (await guard(message)) return;
    await track(message);
    await levels.onMessage(message);
    await prefix.handle(message);
  }
};
