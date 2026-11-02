const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const store = require('./store');
const { embed } = require('./util');

const EPHEMERAL = MessageFlags.Ephemeral;

const ROLES = [
  ['schematic', 'Schematic ping'],
  ['announcement', 'Announcement ping'],
  ['partner', 'Partner ping'],
  ['gambling', 'Gambling ping'],
  ['giveaway', 'Giveaway ping'],
  ['spawner', 'Spawner ping'],
  ['stream', 'Stream ping'],
  ['marker', 'Marker ping']
];

function panel(guild) {
  const e = embed(guild)
    .setTitle('Ping Roles')
    .setDescription('Click a button below to add or remove a ping role.')
    .setFooter({ text: 'Click again to remove the role.' });
  const rows = [];
  for (let n = 0; n < ROLES.length; n += 4) {
    rows.push(
      new ActionRowBuilder().addComponents(
        ROLES.slice(n, n + 4).map(([key, label]) =>
          new ButtonBuilder().setCustomId(`rr:${key}`).setLabel(label).setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return { embeds: [e], components: rows };
}

async function route(i) {
  if (!i.isButton()) return;
  const key = i.customId.split(':')[1];
  const entry = ROLES.find(r => r[0] === key);
  if (!entry) return;
  const roleId = store.guild(i.guild.id).cfg[`${key}_ping_role`];
  const role = roleId && i.guild.roles.cache.get(roleId);
  if (!role) return i.reply({ content: 'This role has not been set up yet.', flags: EPHEMERAL });
  if (!role.editable) return i.reply({ content: 'I cannot manage that role. Move my role above it.', flags: EPHEMERAL });
  if (i.member.roles.cache.has(role.id)) {
    await i.member.roles.remove(role);
    return i.reply({ content: `Removed ${role.name}.`, flags: EPHEMERAL });
  }
  await i.member.roles.add(role);
  return i.reply({ content: `Added ${role.name}.`, flags: EPHEMERAL });
}

module.exports = { panel, route };
