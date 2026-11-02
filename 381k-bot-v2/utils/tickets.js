const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const store = require('./store');
const transcript = require('./transcript');
const { embed, ticketFooter, isManager, isStaff, parseId, slug, send, shorten } = require('./util');

const EPHEMERAL = MessageFlags.Ephemeral;
const Short = TextInputStyle.Short;
const Long = TextInputStyle.Paragraph;

const TYPES = {
  support: { label: 'General Support', category: 'ticket_category', staff: 'support_staff_role', ping: 'support_role' },
  claim: { label: 'Giveaway Claim', category: 'ticket_category', staff: 'claim_staff_role', ping: 'support_role' },
  middleman: { label: 'Middleman', category: 'middleman_category', staff: 'middleman_staff_role', ping: 'middleman_role' },
  digout: { label: 'Digout', category: 'building_category', staff: 'digout_staff_role', ping: 'builder_role' },
  base: { label: 'Base, Regear and Gamble', category: 'building_category', staff: 'base_staff_role', ping: 'builder_role' },
  spawner: { label: 'Spawner', category: 'spawner_category', staff: 'spawner_staff_role', ping: null },
  ad: { label: 'Paid Ad', category: 'ad_category', staff: 'ad_staff_role', ping: null }
};

const FIELDS = {
  support: [['help', 'What do you need help with?', Long]],
  claim: [
    ['amount', 'How much did you win?', Short],
    ['host', 'Who hosted it?', Short]
  ],
  middleman: [
    ['partner', 'Who are you trading with?', Short],
    ['trade', 'What is the trade?', Long]
  ],
  digout: [
    ['request', 'What do you need dug out?', Long],
    ['details', 'Location and size', Short]
  ],
  base: [
    ['kind', 'Base, regear or gamble?', Short],
    ['details', 'What do you need?', Long]
  ],
  spawner: [
    ['side', 'Are you buying or selling?', Short],
    ['details', 'Amount and price', Long]
  ]
};

function canManage(member, typeKey) {
  if (isManager(member)) return true;
  const cfg = store.guild(member.guild.id).cfg;
  const def = TYPES[typeKey];
  const roleId = def && cfg[def.staff];
  if (roleId) return member.roles.cache.has(roleId);
  return isStaff(member);
}

function ticketPanel(guild) {
  const e = embed(guild)
    .setTitle('Tickets')
    .addFields(
      { name: 'General Support', value: 'Pick this option if you would like to make a support ticket.' },
      { name: 'Giveaway Claim', value: 'Pick this option if you won a giveaway.' }
    )
    .setDescription(
      [
        '* Troll tickets will not be entertained and might result in a timeout',
        '* All proof must be given within the claim time to get your prize for the giveaway'
      ].join('\n')
    );
  const menu = new StringSelectMenuBuilder()
    .setCustomId('tk:select')
    .setPlaceholder('Select a ticket type')
    .addOptions(
      { label: 'General Support', value: 'support', description: 'Open a support ticket' },
      { label: 'Giveaway Claim', value: 'claim', description: 'Claim a giveaway prize' }
    );
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(menu)] };
}

function buildingPanel(guild) {
  const e = embed(guild)
    .setTitle('Building Services')
    .addFields(
      { name: 'PRICES', value: 'Will be discussed in the ticket.' },
      { name: 'MINING', value: '$1000 * XYZ' },
      {
        name: 'REFUND',
        value:
          'We offer a 3 day 75% refund policy on base being raided. If you ask for a direct refund it will only be 85% of the money back.'
      },
      {
        name: 'NOTES',
        value: [
          '* Do not pay anyone except `smooth282`',
          '* Any customizations must be made with the builder, not staff',
          '* Do not pay before your builder starts the command'
        ].join('\n')
      }
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:open:digout').setLabel('Digout').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tk:open:base').setLabel('Base / Regear / Gamble').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [e], components: [row] };
}

function middlemanPanel(guild) {
  const cfg = store.guild(guild.id).cfg;
  const mm = cfg.middleman_role && guild.roles.cache.has(cfg.middleman_role) ? `<@&${cfg.middleman_role}>` : 'a middleman';
  const co = cfg.coowner_role && guild.roles.cache.has(cfg.coowner_role) ? `<@&${cfg.coowner_role}>` : 'a co owner';
  const e = embed(guild)
    .setTitle('Middleman Services')
    .setDescription(
      [
        '**Do you need a trusted middleman for your trade?**',
        'We offer a cheap, simple, easy middleman service that helps you complete your trade safely!',
        '',
        '**How it works:**',
        '* The middleman will tpa to the first person with the spawners/base and take them, then the buyer will pay the middleman the money and receive the item. The middleman will then deliver the money to the first person.',
        '* Note: We take a 5% fee during these trades',
        `* Only do this with ${mm} or ${co}`
      ].join('\n')
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:open:middleman').setLabel('Request Middleman').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [e], components: [row] };
}

function spawnerPanel(guild) {
  const e = embed(guild).setTitle('Spawner Tickets').setDescription('Press the button below to buy or sell skellies.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:open:spawner').setLabel('Sell/Buy').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [e], components: [row] };
}

function modalFor(type) {
  const modal = new ModalBuilder().setCustomId(`tk:modal:${type}`).setTitle(TYPES[type].label.slice(0, 45));
  for (const [id, label, style] of FIELDS[type]) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true).setMaxLength(style === Long ? 1000 : 100)
      )
    );
  }
  return modal;
}

function controls(claimed) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tk:claim')
      .setLabel(claimed ? 'Claimed' : 'Claim')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(claimed)),
    new ButtonBuilder().setCustomId('tk:close').setLabel('Close').setStyle(ButtonStyle.Danger)
  );
}

async function handleSelect(i) {
  const type = i.values[0];
  await i.showModal(modalFor(type));
  i.message.edit(ticketPanel(i.guild)).catch(() => {});
}

async function openTicket(i, type, answers) {
  await i.deferReply({ flags: EPHEMERAL });
  const guild = i.guild;
  const g = store.guild(guild.id);
  const cfg = g.cfg;
  const def = TYPES[type];

  for (const [channelId, t] of Object.entries(g.tickets)) {
    if (t.userId === i.user.id && t.type === type) {
      if (guild.channels.cache.has(channelId)) {
        return i.editReply(`You already have an open ticket: <#${channelId}>`);
      }
      delete g.tickets[channelId];
    }
  }

  let name;
  if (type === 'claim') {
    const hostId = parseId(answers[1][1]);
    const hostMember = hostId ? guild.members.cache.get(hostId) : null;
    name = `${slug(hostMember ? hostMember.displayName : answers[1][1], 16)}-${slug(answers[0][1], 16)}`;
  } else {
    const prefix = { support: 'support', middleman: 'mm', digout: 'digout', base: 'base', spawner: 'spawner', ad: 'ad' }[type];
    name = `${prefix}-${slug(i.user.username)}`;
  }

  const view = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks
  ];
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: i.user.id, allow: view },
    { id: guild.members.me.id, allow: [...view, PermissionFlagsBits.ManageChannels] }
  ];
  const typeRole = cfg[def.staff];
  const roleIds = new Set([typeRole, def.ping ? cfg[def.ping] : null, typeRole ? null : cfg.staff_role].filter(Boolean));
  for (const roleId of roleIds) {
    if (guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow: view });
  }

  const parent = cfg[def.category] ? guild.channels.cache.get(cfg[def.category]) : null;
  const channel = await guild.channels.create({
    name: name.slice(0, 90),
    type: ChannelType.GuildText,
    parent: parent && parent.type === ChannelType.GuildCategory ? parent.id : null,
    permissionOverwrites: overwrites
  });

  g.counter += 1;
  const number = g.counter;
  g.tickets[channel.id] = { number, type, userId: i.user.id, claimedBy: null, createdAt: Date.now() };
  store.save();

  const e = embed(guild)
    .setTitle(def.label)
    .setDescription(`${i.user}, thank you for opening a ticket. A staff member will be with you shortly.`)
    .addFields(answers.map(([label, value]) => ({ name: label, value: shorten(value) })))
    .setFooter({ text: ticketFooter(number) });

  const pingId = (def.ping && cfg[def.ping]) || typeRole;
  const pingText = pingId && guild.roles.cache.has(pingId) ? `<@&${pingId}> ` : '';
  await channel.send({ content: `${pingText}${i.user}`, embeds: [e], components: [controls(false)] });
  await i.editReply(`Your ticket has been created: ${channel}`);
}

async function submit(i, type) {
  const answers = FIELDS[type].map(([id, label]) => [label, i.fields.getTextInputValue(id)]);
  return openTicket(i, type, answers);
}

async function claim(i) {
  const g = store.guild(i.guild.id);
  const t = g.tickets[i.channel.id];
  if (!t) return i.reply({ content: 'This is not a ticket.', flags: EPHEMERAL });
  if (!canManage(i.member, t.type)) return i.reply({ content: 'You cannot claim this ticket.', flags: EPHEMERAL });
  if (t.claimedBy) return i.reply({ content: `This ticket is already claimed by <@${t.claimedBy}>.`, flags: EPHEMERAL });
  t.claimedBy = i.user.id;
  store.save();
  const e = EmbedBuilder.from(i.message.embeds[0]).addFields({ name: 'Claimed By', value: `${i.user}` });
  await i.update({ embeds: [e], components: [controls(true)] });
}

async function closeTicket(channel, closer, title) {
  const guild = channel.guild;
  const g = store.guild(guild.id);
  const t = g.tickets[channel.id];
  if (!t) return false;

  const { file, messages } = await transcript.build(channel);
  const def = TYPES[t.type] || { label: 'Ticket' };
  const e = embed(guild)
    .setTitle(title)
    .addFields(
      { name: 'Type', value: def.label, inline: true },
      { name: 'Opened By', value: `<@${t.userId}>`, inline: true },
      { name: 'Claimed By', value: t.claimedBy ? `<@${t.claimedBy}>` : 'Nobody', inline: true },
      { name: 'Closed By', value: `${closer}`, inline: true },
      { name: 'Messages', value: `${messages.length}`, inline: true }
    )
    .setFooter({ text: ticketFooter(t.number) });

  await send(guild, 'transcript_channel', { embeds: [e], files: [file] });
  const opener = await channel.client.users.fetch(t.userId).catch(() => null);
  if (opener) await opener.send({ embeds: [e], files: [file] }).catch(() => {});

  delete g.tickets[channel.id];
  store.save();
  setTimeout(() => channel.delete().catch(() => {}), 5000);
  return true;
}

async function close(i) {
  const t = store.guild(i.guild.id).tickets[i.channel.id];
  if (!t) return i.reply({ content: 'This is not a ticket.', flags: EPHEMERAL });
  if (!canManage(i.member, t.type) && i.user.id !== t.userId) {
    return i.reply({ content: 'You cannot close this ticket.', flags: EPHEMERAL });
  }
  await i.reply({ embeds: [embed(i.guild).setDescription('This ticket will be closed in 5 seconds.')] });
  await closeTicket(i.channel, i.user, 'Ticket Closed');
}

async function recap(message) {
  const guild = message.guild;
  const msgs = await transcript.fetchAll(message.channel);
  const humans = msgs.filter(m => !m.author.bot);
  const counts = {};
  let files = 0;
  for (const m of humans) {
    counts[m.author.id] = (counts[m.author.id] || 0) + 1;
    files += m.attachments.size;
  }
  const top =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, n]) => `<@${id}> - ${n}`)
      .join('\n') || 'None';

  const e = embed(guild).setTitle('Channel Recap');
  const t = store.guild(guild.id).tickets[message.channel.id];
  if (t) {
    e.addFields(
      { name: 'Type', value: (TYPES[t.type] || { label: 'Ticket' }).label, inline: true },
      { name: 'Opened By', value: `<@${t.userId}>`, inline: true },
      { name: 'Claimed By', value: t.claimedBy ? `<@${t.claimedBy}>` : 'Nobody', inline: true }
    );
    e.setFooter({ text: ticketFooter(t.number) });
  }
  e.addFields(
    { name: 'Messages', value: `${humans.length}`, inline: true },
    { name: 'Attachments', value: `${files}`, inline: true },
    { name: 'Started', value: msgs[0] ? `<t:${Math.floor(msgs[0].createdTimestamp / 1000)}:R>` : 'Unknown', inline: true },
    { name: 'Participants', value: top }
  );
  const lastHuman = humans[humans.length - 1];
  if (lastHuman) {
    e.addFields({
      name: 'Latest Message',
      value: shorten(`${lastHuman.author}: ${lastHuman.content || 'Attachment'}`, 300)
    });
  }
  return message.channel.send({ embeds: [e] });
}

async function route(i) {
  const [, kind, arg] = i.customId.split(':');
  if (i.isStringSelectMenu() && kind === 'select') return handleSelect(i);
  if (i.isButton()) {
    if (kind === 'open' && FIELDS[arg]) return i.showModal(modalFor(arg));
    if (kind === 'claim') return claim(i);
    if (kind === 'close') return close(i);
  }
  if (i.isModalSubmit() && kind === 'modal' && FIELDS[arg]) return submit(i, arg);
}

module.exports = {
  TYPES,
  route,
  ticketPanel,
  buildingPanel,
  middlemanPanel,
  spawnerPanel,
  openTicket,
  canManage,
  closeTicket,
  recap
};
