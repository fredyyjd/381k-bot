const { PermissionFlagsBits } = require('discord.js');
const store = require('./store');
const { embed, isManager, isMod, isStaff, parseId, shorten } = require('./util');
const tickets = require('./tickets');
const apps = require('./apps');
const ads = require('./ads');
const roles = require('./roles');

const PREFIX = '!';

function parseDuration(text) {
  const match = String(text || '').match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Math.min(parseInt(match[1], 10) * unit[match[2].toLowerCase()], 28 * 86400000);
}

function describe(ms) {
  if (ms % 86400000 === 0) return `${ms / 86400000} day${ms === 86400000 ? '' : 's'}`;
  if (ms % 3600000 === 0) return `${ms / 3600000} hour${ms === 3600000 ? '' : 's'}`;
  if (ms % 60000 === 0) return `${ms / 60000} minute${ms === 60000 ? '' : 's'}`;
  return `${Math.round(ms / 1000)} seconds`;
}

async function reply(message, text) {
  return message.channel.send({ embeds: [embed(message.guild).setDescription(text)] });
}

async function handle(message) {
  if (!message.guild || message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase().replace(/pannel/g, 'panel').replace('spawener', 'spawner');
  const member = message.member;
  if (!member) return;

  const panel = async build => {
    if (!isManager(member)) return reply(message, 'You do not have permission to use this command.');
    await message.channel.send(build(message.guild));
    message.delete().catch(() => {});
  };

  if (command === 'ticketpanel') return panel(tickets.ticketPanel);
  if (command === 'setupbuilding') return panel(tickets.buildingPanel);
  if (command === 'middlemanpanel') return panel(tickets.middlemanPanel);
  if (command === 'applicationpanel') return panel(apps.panel);
  if (command === 'spawnerpanel') return panel(tickets.spawnerPanel);
  if (command === 'adpanel') return panel(ads.panel);
  if (command === 'reactroles') return panel(roles.panel);

  if (command === 'review' && (args[0] || '').toLowerCase() === 'complete') {
    const ticket = store.guild(message.guild.id).tickets[message.channel.id];
    if (!ticket) return reply(message, 'This command only works inside a ticket.');
    if (!tickets.canManage(member, ticket.type)) return reply(message, 'You do not have permission to use this command.');
    await reply(message, 'Review complete. This channel will be closed in 5 seconds.');
    return tickets.closeTicket(message.channel, message.author, 'Review Completed');
  }

  if (command === 'recap') {
    if (!isStaff(member)) return reply(message, 'You do not have permission to use this command.');
    return tickets.recap(message);
  }

  if (command === 'purge') {
    if (!isMod(member, PermissionFlagsBits.ManageMessages)) {
      return reply(message, 'You do not have permission to use this command.');
    }
    const amount = parseInt(args[0], 10);
    if (Number.isNaN(amount) || amount < 1 || amount > 99) return reply(message, 'Usage: !purge <1-99>');
    const deleted = await message.channel.bulkDelete(amount + 1, true).catch(() => null);
    if (!deleted) return reply(message, 'I could not delete those messages.');
    const note = await reply(message, `Deleted ${Math.max(deleted.size - 1, 0)} messages.`);
    setTimeout(() => note.delete().catch(() => {}), 3000);
    return;
  }

  if (command === 'to') {
    if (!isMod(member, PermissionFlagsBits.ModerateMembers)) {
      return reply(message, 'You do not have permission to use this command.');
    }
    const target = message.mentions.members.first() || (await message.guild.members.fetch(parseId(args[0]) || '0').catch(() => null));
    if (!target) return reply(message, 'Usage: !to @user [time] [reason]');
    if (!target.moderatable) return reply(message, 'I cannot timeout that member.');
    let rest = args.slice(1);
    const duration = parseDuration(rest[0]);
    if (duration) rest = rest.slice(1);
    const length = duration || 3600000;
    const reason = rest.join(' ') || 'No reason provided';
    await target.timeout(length, `${message.author.tag}: ${reason}`).catch(() => {});
    return message.channel.send({
      embeds: [
        embed(message.guild)
          .setTitle('Member Timed Out')
          .addFields(
            { name: 'Member', value: `${target}`, inline: true },
            { name: 'Duration', value: describe(length), inline: true },
            { name: 'Moderator', value: `${message.author}`, inline: true },
            { name: 'Reason', value: shorten(reason) }
          )
      ]
    });
  }

  if (command === 'ban') {
    if (!isMod(member, PermissionFlagsBits.BanMembers)) {
      return reply(message, 'You do not have permission to use this command.');
    }
    const id = message.mentions.users.first()?.id || parseId(args[0]);
    if (!id) return reply(message, 'Usage: !ban @user [reason]');
    const target = await message.guild.members.fetch(id).catch(() => null);
    if (target && !target.bannable) return reply(message, 'I cannot ban that member.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    const done = await message.guild.members.ban(id, { reason: `${message.author.tag}: ${reason}` }).catch(() => null);
    if (!done) return reply(message, 'I could not ban that user.');
    return message.channel.send({
      embeds: [
        embed(message.guild)
          .setTitle('Member Banned')
          .addFields(
            { name: 'User', value: `<@${id}>`, inline: true },
            { name: 'Moderator', value: `${message.author}`, inline: true },
            { name: 'Reason', value: shorten(reason) }
          )
      ]
    });
  }
}

module.exports = { handle };
