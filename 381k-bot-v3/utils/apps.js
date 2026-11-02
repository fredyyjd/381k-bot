const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const store = require('./store');
const { embed, ticketFooter, isManager, parseMoney, getChannel, shorten } = require('./util');

const EPHEMERAL = MessageFlags.Ephemeral;
const MIN_AGE = 14;
const MIN_BALANCE = 200e6;

const TYPES = {
  staff: { label: 'Staff', experience: 'Experience (if any, include links)' },
  builder: { label: 'Builder', experience: 'Experience and links to previous work' },
  partner: { label: 'Partner Manager', experience: 'Partner experience, links, member counts' }
};

function panel(guild) {
  const e = embed(guild)
    .setTitle('Staff Requirements')
    .addFields(
      {
        name: 'Staff Applications',
        value: ['Must be 14+', 'Mature and respectful', 'No recent punishments', 'Good grammar and communication', '200M+ balance']
          .map(l => `* ${l}`)
          .join('\n')
      },
      {
        name: 'Builder Applications',
        value: ['Must be 14+', 'Experienced builder', 'Must show previous work', 'Active and reliable', 'Works well with others', '200M+ balance']
          .map(l => `* ${l}`)
          .join('\n')
      },
      {
        name: 'Partner Manager Applications',
        value: ['Must be 14+', 'Active and professional', 'Good communication', 'Partnership experience', 'Friendly and respectful', '200M+ balance']
          .map(l => `* ${l}`)
          .join('\n')
      }
    )
    .setDescription(
      [
        'Meeting the requirements does not guarantee acceptance. Low-effort applications will be declined.',
        'Opening a ticket about your application = instant blacklist, no appeal.',
        '',
        'Select the position you want to apply for below!'
      ].join('\n')
    );
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ap:select')
    .setPlaceholder('Select a position')
    .addOptions(
      { label: 'Staff Application', value: 'staff' },
      { label: 'Builder Application', value: 'builder' },
      { label: 'Partner Manager Application', value: 'partner' }
    );
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(menu)] };
}

function input(id, label, style, placeholder, max) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(true)
      .setPlaceholder(placeholder || '')
      .setMaxLength(max || 100)
  );
}

function modalFor(type) {
  const def = TYPES[type];
  return new ModalBuilder()
    .setCustomId(`ap:modal:${type}`)
    .setTitle(`${def.label} Application`)
    .addComponents(
      input('ign', 'Minecraft IGN', TextInputStyle.Short, '', 16),
      input('age', 'Age', TextInputStyle.Short, '', 3),
      input('balance', 'Balance (200M+ required)', TextInputStyle.Short, 'Example: 350M', 20),
      input('playtime', 'Playtime on DonutSMP', TextInputStyle.Short, 'Example: 120h', 40),
      input('experience', def.experience, TextInputStyle.Paragraph, '', 1000)
    );
}

function decisionButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap:accept:${id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ap:acceptr:${id}`).setLabel('Accept With Reason').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ap:deny:${id}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ap:denyr:${id}`).setLabel('Deny With Reason').setStyle(ButtonStyle.Danger)
  );
}

async function submit(i, type) {
  const guild = i.guild;
  const g = store.guild(guild.id);
  const def = TYPES[type];

  const age = parseInt(i.fields.getTextInputValue('age'), 10);
  const balanceText = i.fields.getTextInputValue('balance');
  const balance = parseMoney(balanceText);

  if (Number.isNaN(age) || age < MIN_AGE) {
    return i.reply({ content: `You must be ${MIN_AGE} or older to apply.`, flags: EPHEMERAL });
  }
  if (Number.isNaN(balance) || balance < MIN_BALANCE) {
    return i.reply({ content: 'You need a balance of 200M or more to apply.', flags: EPHEMERAL });
  }

  const pending = Object.values(g.apps).find(a => a.userId === i.user.id && a.type === type && a.status === 'pending');
  if (pending) return i.reply({ content: 'You already have a pending application for this position.', flags: EPHEMERAL });

  const channel = await getChannel(guild, 'application_channel');
  if (!channel) return i.reply({ content: 'Applications are not set up yet.', flags: EPHEMERAL });

  await i.deferReply({ flags: EPHEMERAL });

  g.appCounter += 1;
  const id = g.appCounter;
  const member = i.member;
  const stamp = d => `<t:${Math.floor(d / 1000)}:R>`;

  const e = embed(guild)
    .setTitle(`${def.label} Application`)
    .setThumbnail(i.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Applicant', value: `${i.user}`, inline: true },
      { name: 'User ID', value: i.user.id, inline: true },
      { name: 'Username', value: i.user.username, inline: true },
      { name: 'Display Name', value: member.displayName, inline: true },
      { name: 'Joined Discord', value: stamp(i.user.createdTimestamp), inline: true },
      { name: 'Joined Server', value: member.joinedTimestamp ? stamp(member.joinedTimestamp) : 'Unknown', inline: true },
      { name: 'IGN', value: i.fields.getTextInputValue('ign'), inline: true },
      { name: 'Age', value: String(age), inline: true },
      { name: 'Balance', value: shorten(balanceText, 100), inline: true },
      { name: 'Playtime', value: shorten(i.fields.getTextInputValue('playtime'), 100) },
      { name: def.experience, value: shorten(i.fields.getTextInputValue('experience')) }
    )
    .setFooter({ text: ticketFooter(id, 'Application') });

  const sent = await channel.send({ embeds: [e], components: [decisionButtons(id)] });
  g.apps[id] = { id, userId: i.user.id, type, channelId: channel.id, messageId: sent.id, status: 'pending' };
  store.save();
  await i.editReply('Your application has been submitted. Do not open a ticket about it.');
}

async function decide(i, id, accepted, reason) {
  if (!isManager(i.member)) {
    return i.reply({ content: 'You cannot review applications.', flags: EPHEMERAL });
  }
  const g = store.guild(i.guild.id);
  const app = g.apps[id];
  if (!app) return i.reply({ content: 'Application not found.', flags: EPHEMERAL });
  if (app.status !== 'pending') return i.reply({ content: 'This application has already been reviewed.', flags: EPHEMERAL });

  app.status = accepted ? 'accepted' : 'denied';
  store.save();

  const channel = await i.guild.channels.fetch(app.channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(app.messageId).catch(() => null) : null;
  if (message) {
    const e = EmbedBuilder.from(message.embeds[0]).addFields({
      name: 'Decision',
      value: `${accepted ? 'Accepted' : 'Denied'} by ${i.user}`
    });
    if (reason) e.addFields({ name: 'Reason', value: shorten(reason) });
    await message.edit({ embeds: [e], components: [] }).catch(() => {});
  }

  const applicant = await i.client.users.fetch(app.userId).catch(() => null);
  if (applicant) {
    const dm = embed(i.guild)
      .setTitle(`Application ${accepted ? 'Accepted' : 'Denied'}`)
      .setDescription(`Your ${TYPES[app.type].label} application has been ${accepted ? 'accepted' : 'denied'}.`);
    if (reason) dm.addFields({ name: 'Reason', value: shorten(reason) });
    await applicant.send({ embeds: [dm] }).catch(() => {});
  }

  await i.reply({ content: `Application ${accepted ? 'accepted' : 'denied'}.`, flags: EPHEMERAL });
}

function reasonModal(action, id) {
  return new ModalBuilder()
    .setCustomId(`ap:reason:${action}:${id}`)
    .setTitle(action === 'accept' ? 'Accept With Reason' : 'Deny With Reason')
    .addComponents(input('reason', 'Reason', TextInputStyle.Paragraph, '', 800));
}

async function route(i) {
  const parts = i.customId.split(':');
  const kind = parts[1];

  if (i.isStringSelectMenu() && kind === 'select') {
    await i.showModal(modalFor(i.values[0]));
    i.message.edit(panel(i.guild)).catch(() => {});
    return;
  }

  if (i.isModalSubmit()) {
    if (kind === 'modal') return submit(i, parts[2]);
    if (kind === 'reason') return decide(i, parts[3], parts[2] === 'accept', i.fields.getTextInputValue('reason'));
  }

  if (i.isButton()) {
    const id = parts[2];
    if (kind === 'accept') return decide(i, id, true, null);
    if (kind === 'deny') return decide(i, id, false, null);
    if (kind === 'acceptr' || kind === 'denyr') {
      if (!isManager(i.member)) return i.reply({ content: 'You cannot review applications.', flags: EPHEMERAL });
      return i.showModal(reasonModal(kind === 'acceptr' ? 'accept' : 'deny', id));
    }
  }
}

module.exports = { route, panel };
