const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const store = require('./store');
const { embed, staffRoleIds, send, getChannel, shorten } = require('./util');

const EPHEMERAL = MessageFlags.Ephemeral;

function ladder(guild) {
  const ranks = store.guild(guild.id).cfg.staff_ranks || [];
  return ranks.filter(id => guild.roles.cache.has(id));
}

function demoteRoles(guild) {
  const ids = store.guild(guild.id).cfg.demote_roles || [];
  return ids.filter(id => guild.roles.cache.has(id));
}

function rankIndex(member, list) {
  for (let n = 0; n < list.length; n++) {
    if (member.roles.cache.has(list[n])) return n;
  }
  return -1;
}

function weekKey() {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day)).toISOString().slice(0, 10);
}

function schematic(g) {
  const key = weekKey();
  if (g.schematic.week !== key) {
    g.schematic = { week: key, points: {} };
    store.save();
  }
  return g.schematic.points;
}

function board(guild, title, map) {
  const rows = Object.entries(map)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const text = rows.length ? rows.map(([id, value], n) => `${n + 1}. <@${id}> - ${value}`).join('\n') : 'No entries yet.';
  return embed(guild).setTitle(title).setDescription(text);
}

async function syncNick(member) {
  if (member.user.bot) return;
  const list = ladder(member.guild);
  const index = rankIndex(member, list);
  const base = member.user.globalName || member.user.username;
  if (index === -1) {
    const old = member.nickname;
    if (old && old.endsWith(` | ${base}`)) await member.setNickname(null, 'Staff rank removed').catch(() => {});
    return;
  }
  const rank = member.guild.roles.cache.get(list[index]).name;
  const prefix = `${rank} | `;
  const nick = (prefix + base).slice(0, 32);
  if (member.nickname !== nick) await member.setNickname(nick, 'Staff rank sync').catch(() => {});
}

async function changelog(guild, title, fields) {
  const e = embed(guild).setTitle(title).addFields(fields);
  return send(guild, 'changelog_channel', { embeds: [e] });
}

async function promoteMember(guild, member, by, reason) {
  const list = ladder(guild);
  if (!list.length) return { error: 'Staff ranks are not set. Set staff ranks in /config first.' };
  const index = rankIndex(member, list);
  if (index === 0) return { error: 'This member already has the highest rank.' };
  const nextIndex = index === -1 ? list.length - 1 : index - 1;
  try {
    if (index !== -1) await member.roles.remove(list[index]);
    await member.roles.add(list[nextIndex]);
  } catch {
    return { error: 'I could not change that member roles. Check my role position.' };
  }
  const from = index === -1 ? 'None' : `<@&${list[index]}>`;
  const to = `<@&${list[nextIndex]}>`;
  await changelog(guild, '⬆️ Promotion', [
    { name: 'Member', value: `${member}`, inline: true },
    { name: 'Old Rank', value: from, inline: true },
    { name: 'New Rank', value: to, inline: true },
    { name: 'Promoted By', value: `${by}`, inline: true },
    { name: 'Reason', value: shorten(reason || 'No reason provided') }
  ]);
  await syncNick(await member.fetch());
  return { from, to };
}

async function demoteMember(guild, member, by, reason, auto = false, targetId = null) {
  const list = ladder(guild);
  if (!list.length) return { error: 'Staff ranks are not set. Set staff ranks in /config first.' };
  const index = rankIndex(member, list);
  if (index === -1) return { error: 'This member has no staff rank.' };

  // Picked a role from /config demote: drop every rank they hold and give that role.
  // No role picked (or an automatic demotion): move down one rank.
  let nextId = null;
  let remove = [list[index]];
  if (targetId) {
    const targetIndex = list.indexOf(targetId);
    if (targetIndex !== -1 && targetIndex <= index) {
      return { error: 'Pick a role below their current rank.' };
    }
    nextId = targetId;
    remove = list.filter(id => member.roles.cache.has(id) && id !== targetId);
  } else if (index !== list.length - 1) {
    nextId = list[index + 1];
  }

  try {
    await member.roles.remove(remove);
    if (nextId && !member.roles.cache.has(nextId)) await member.roles.add(nextId);
  } catch {
    return { error: 'I could not change that member roles. Check my role position.' };
  }
  store.guild(guild.id).strikes[member.id] = [];
  store.save();
  const from = `<@&${list[index]}>`;
  const to = nextId ? `<@&${nextId}>` : 'None';
  await changelog(guild, auto ? '⬇️ Automatic Demotion' : '⬇️ Demotion', [
    { name: 'Member', value: `${member}`, inline: true },
    { name: 'Old Rank', value: from, inline: true },
    { name: 'New Rank', value: to, inline: true },
    { name: 'Demoted By', value: `${by}`, inline: true },
    { name: 'Reason', value: shorten(reason || 'No reason provided') }
  ]);
  await syncNick(await member.fetch());
  return { from, to };
}

async function addStrike(guild, member, by, reason) {
  const g = store.guild(guild.id);
  const list = g.strikes[member.id] || [];
  let number = 1;
  while (list.some(s => s.number === number)) number += 1;
  if (number > 3) return { error: 'This member already has 3 strikes.' };
  list.push({ number, reason: reason || 'No reason provided', by: by.id, at: Date.now() });
  g.strikes[member.id] = list;
  store.save();
  let demoted = null;
  if (list.length >= 3) {
    demoted = await demoteMember(guild, member, by, '3 strikes reached', true);
  }
  return { number, demoted };
}

async function stafflist(i) {
  await i.deferReply();
  const guild = i.guild;
  const list = ladder(guild);
  if (!list.length) return i.editReply('Staff ranks are not set. Set staff ranks in /config first.');
  await guild.members.fetch().catch(() => {});
  const e = embed(guild).setTitle('📋 Staff List');
  for (const roleId of list) {
    const role = guild.roles.cache.get(roleId);
    const members = role.members.filter(m => rankIndex(m, list) === list.indexOf(roleId));
    const text = members.size ? members.map(m => `${m}`).join('\n') : 'Vacant';
    e.addFields({ name: role.name, value: shorten(text, 1000) });
  }
  return i.editReply({ embeds: [e] });
}

async function finishActivity(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  const g = store.guild(guildId);
  const a = g.activity;
  if (!guild || !a) return;
  g.activity = null;
  store.save();
  await guild.members.fetch().catch(() => {});
  const ids = staffRoleIds(guild);
  const staff = guild.members.cache.filter(m => !m.user.bot && ids.some(id => m.roles.cache.has(id)));
  const done = staff.filter(m => a.checked.includes(m.id));
  const missing = staff.filter(m => !a.checked.includes(m.id));
  const channel = await guild.channels.fetch(a.channelId).catch(() => null);
  if (!channel) return;
  const original = await channel.messages.fetch(a.messageId).catch(() => null);
  if (original) await original.edit({ components: [] }).catch(() => {});
  const e = embed(guild)
    .setTitle('✅ Activity Check Results')
    .addFields(
      { name: `Checked In (${done.size})`, value: shorten(done.size ? done.map(m => `${m}`).join('\n') : 'Nobody', 1000) },
      { name: `Missing (${missing.size})`, value: shorten(missing.size ? missing.map(m => `${m}`).join('\n') : 'Nobody', 1000) }
    );
  await channel.send({ embeds: [e] });
}

function scheduleActivity(client, guildId) {
  const a = store.guild(guildId).activity;
  if (!a) return;
  setTimeout(() => finishActivity(client, guildId).catch(() => {}), Math.max(a.endsAt - Date.now(), 1000));
}

async function startActivity(i) {
  const guild = i.guild;
  const g = store.guild(guild.id);
  if (g.activity) return i.reply({ content: 'An activity check is already running.', flags: EPHEMERAL });
  const channel = (await getChannel(guild, 'activity_channel')) || i.channel;
  const endsAt = Date.now() + 24 * 60 * 60 * 1000;
  const e = embed(guild)
    .setTitle('📣 Activity Check')
    .setDescription(`All staff must press the button below. This check ends <t:${Math.floor(endsAt / 1000)}:R>.`);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('act:check').setLabel('Check In').setStyle(ButtonStyle.Secondary)
  );
  const cfg = g.cfg;
  const content = cfg.staff_role ? `<@&${cfg.staff_role}>` : undefined;
  const sent = await channel.send({ content, embeds: [e], components: [row] });
  g.activity = { channelId: channel.id, messageId: sent.id, endsAt, checked: [] };
  store.save();
  scheduleActivity(i.client, guild.id);
  return i.reply({ content: `Activity check started in ${channel}.`, flags: EPHEMERAL });
}

async function routeActivity(i) {
  const g = store.guild(i.guild.id);
  const a = g.activity;
  if (!a) return i.reply({ content: 'This activity check has ended.', flags: EPHEMERAL });
  const ids = staffRoleIds(i.guild);
  if (!ids.some(id => i.member.roles.cache.has(id))) {
    return i.reply({ content: 'Only staff can check in.', flags: EPHEMERAL });
  }
  if (a.checked.includes(i.user.id)) return i.reply({ content: 'You already checked in.', flags: EPHEMERAL });
  a.checked.push(i.user.id);
  store.save();
  return i.reply({ content: 'You are checked in.', flags: EPHEMERAL });
}

module.exports = {
  ladder,
  demoteRoles,
  rankIndex,
  schematic,
  board,
  syncNick,
  promoteMember,
  demoteMember,
  addStrike,
  stafflist,
  startActivity,
  scheduleActivity,
  routeActivity
};
