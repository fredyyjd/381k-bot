const crypto = require('crypto');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const config = require('../config');
const createStore = require('./jsonStore');
const { isStaff } = require('./util');

const cfg = config.staffApplication;
const TIME_LIMIT_MS = cfg.timeLimitHours * 60 * 60 * 1000;
const REAPPLY_MS = cfg.reapplyDays * 24 * 60 * 60 * 1000;
const CONFIRM_TTL_MS = 60 * 60 * 1000; // an unstarted "Are you sure?" message expires after 1 hour
const MAX_ANSWER = 1000;
const EPHEMERAL = MessageFlags.Ephemeral;

const COLOR = { neutral: 0x2b2d31, blue: 0x5865f2, green: 0x57f287, red: 0xed4245 };

const QUESTIONS = [
  "What's your balance, playtime and IGN?",
  'Why are you better than the other applicants?',
  'Are you active? And how long a day?',
  'Why should we choose you over the others?',
  'If you have experience, send it here! (server name, how many members, what role, or send links)',
  'If you ping a staff member about your app you will be denied.\n\nType **I understand** to continue.',
  'Are you able to host 15m weekly, or a bit less?',
  'Do you have a working mic?',
  "Have you read the rules? (If you haven't, please read them now)",
];

// data/staffApps.json
//   sessions:  userId -> application in progress (lives in the file, so a bot restart doesn't lose it)
//   apps:      appId  -> finished application and its decision
//   cooldowns: userId -> when they were last denied (ms)
const store = createStore('staffApps.json', { sessions: {}, apps: {}, cooldowns: {} });

const read = (key) => store.get(key) || {};
const weekText = () => (cfg.reapplyDays === 7 ? '1 week' : `${cfg.reapplyDays} day${cfg.reapplyDays === 1 ? '' : 's'}`);
const unix = (ms) => Math.floor(ms / 1000);

// One thing at a time per user / per application, so a double click or two quick
// messages can't be processed twice.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  next.then(
    () => locks.get(key) === next && locks.delete(key),
    () => locks.get(key) === next && locks.delete(key)
  );
  return next;
}

/* =========================================================
   PANEL + DM MESSAGES
========================================================= */

function panelPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR.blue)
    .setDescription(
      [
        '## Staff Applications',
        'Think you have what it takes? Press the button below and I will DM you the application.',
        '',
        '**Before you apply**',
        '> Make sure your DMs are open',
        `> You have ${cfg.timeLimitHours} hours to finish once you start`,
        '> Do not ping staff about your application, you will be denied',
        `> If you get denied you can reapply after ${weekText()}`,
      ].join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sapp_apply').setLabel('Staff Application').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function confirmPayload() {
  const embed = new EmbedBuilder()
    .setColor(COLOR.blue)
    .setTitle('Staff Application')
    .setDescription(
      [
        '**Are you sure you want to apply?**',
        '',
        `Once you start the application I will send you a series of questions. You will have **${cfg.timeLimitHours} hours** to complete the application. If you do not complete the application in time, you will have to restart.`,
        '',
        'If you wish to stop the application feel free to click the cancel button at any time.',
      ].join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sapp_start').setLabel('Start App').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sapp_cancel').setLabel('Cancel App').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

// Every question carries the red Cancel App button.
function questionPayload(session) {
  const i = session.index;
  const embed = new EmbedBuilder()
    .setColor(COLOR.blue)
    .setTitle(`Staff Application | Question ${i + 1} of ${QUESTIONS.length}`)
    .setDescription(
      `${QUESTIONS[i]}\n\n-# Reply to this message with your answer. This application ends <t:${unix(session.deadline)}:R>.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sapp_cancel').setLabel('Cancel App').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

/* =========================================================
   APPLY BUTTON (in the server)
========================================================= */

async function handleApplyButton(interaction) {
  await interaction.deferReply({ flags: EPHEMERAL });
  const user = interaction.user;

  await withLock(`user:${user.id}`, async () => {
    const sessions = read('sessions');
    let s = sessions[user.id];

    if (s && isExpired(s)) {
      delete sessions[user.id];
      store.set('sessions', sessions);
      s = null;
    }
    if (s) {
      return interaction.editReply('You already have an application in progress. Check your DMs with me.');
    }

    const pending = Object.values(read('apps')).find((a) => a.userId === user.id && a.status === 'pending');
    if (pending) {
      return interaction.editReply('Your application is already waiting for review. Please be patient and do not ping staff.');
    }

    const deniedAt = read('cooldowns')[user.id];
    if (deniedAt && Date.now() < deniedAt + REAPPLY_MS) {
      return interaction.editReply(`You were denied recently. You can reapply <t:${unix(deniedAt + REAPPLY_MS)}:R>.`);
    }

    let msg;
    try {
      const dm = await user.createDM();
      msg = await dm.send(confirmPayload());
    } catch {
      return interaction.editReply(
        "I couldn't DM you. Turn on direct messages from server members (Privacy Settings) and press the button again."
      );
    }

    sessions[user.id] = { state: 'confirm', createdAt: Date.now(), confirmMsgId: msg.id };
    store.set('sessions', sessions);
    return interaction.editReply('Check your DMs to start your application!');
  });
}

/* =========================================================
   START / CANCEL (in the DM)
========================================================= */

function isExpired(s) {
  if (s.state === 'asking') return Date.now() > s.deadline;
  return Date.now() - s.createdAt > CONFIRM_TTL_MS;
}

async function handleStartButton(interaction) {
  const userId = interaction.user.id;

  return withLock(`user:${userId}`, async () => {
    const sessions = read('sessions');
    const s = sessions[userId];

    if (!s || isExpired(s)) {
      if (s) {
        delete sessions[userId];
        store.set('sessions', sessions);
      }
      const old = interaction.message.embeds[0];
      const embed = (old ? EmbedBuilder.from(old) : new EmbedBuilder()).setColor(COLOR.red).setFooter({
        text: 'This application expired. Press the Staff Application button in the server to start again.',
      });
      return interaction.update({ embeds: [embed], components: [] });
    }

    if (s.state === 'asking') {
      return interaction.reply({ content: 'Your application has already started. Answer the question above.', flags: EPHEMERAL });
    }

    s.state = 'asking';
    s.startedAt = Date.now();
    s.deadline = s.startedAt + TIME_LIMIT_MS;
    s.index = 0;
    s.answers = [];
    sessions[userId] = s;
    store.set('sessions', sessions);

    const old = interaction.message.embeds[0];
    const started = (old ? EmbedBuilder.from(old) : new EmbedBuilder())
      .setColor(COLOR.green)
      .setFooter({ text: 'Application started' });
    await interaction.update({ embeds: [started], components: [] });

    await interaction.channel.send(questionPayload(s));
  });
}

async function handleCancelButton(interaction) {
  const userId = interaction.user.id;

  return withLock(`user:${userId}`, async () => {
    const sessions = read('sessions');
    const had = Boolean(sessions[userId]);
    if (had) {
      delete sessions[userId];
      store.set('sessions', sessions);
    }

    const old = interaction.message.embeds[0];
    const embed = (old ? EmbedBuilder.from(old) : new EmbedBuilder())
      .setColor(COLOR.red)
      .setFooter({ text: had ? 'Application cancelled' : 'This application is no longer active' });

    await interaction.update({ embeds: [embed], components: [] });

    if (had) {
      await interaction.channel
        .send('Your application was cancelled. Press the **Staff Application** button in the server whenever you want to start again.')
        .catch(() => {});
    }
  });
}

/* =========================================================
   ANSWERS (DM messages)
========================================================= */

async function expireSession(client, userId, session) {
  const sessions = read('sessions');
  delete sessions[userId];
  store.set('sessions', sessions);

  if (session.state !== 'asking') return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;
  const embed = new EmbedBuilder()
    .setColor(COLOR.red)
    .setTitle('Application timed out')
    .setDescription(
      `You did not finish within ${cfg.timeLimitHours} hours, so the application was closed. Press the **Staff Application** button in the server to restart.`
    );
  await user.send({ embeds: [embed] }).catch(() => {});
}

async function handleDmMessage(message, client) {
  if (message.author.bot || message.guild) return;
  const userId = message.author.id;

  return withLock(`user:${userId}`, async () => {
    const sessions = read('sessions');
    const s = sessions[userId];
    if (!s || s.state !== 'asking') return;

    if (Date.now() > s.deadline) return expireSession(client, userId, s);

    let answer = message.content.trim();
    const files = [...message.attachments.values()].map((a) => a.url);
    if (files.length) answer = [answer, ...files].filter(Boolean).join('\n');

    if (!answer) {
      return message.channel.send('Please type your answer as a message.').catch(() => {});
    }
    if (answer.length > MAX_ANSWER) {
      return message.channel
        .send(`That answer is too long (${answer.length}/${MAX_ANSWER} characters). Please shorten it and send it again.`)
        .catch(() => {});
    }

    s.answers.push({ q: QUESTIONS[s.index].split('\n')[0], a: answer });
    s.index += 1;
    sessions[userId] = s;
    store.set('sessions', sessions);

    if (s.index < QUESTIONS.length) {
      return message.channel.send(questionPayload(s));
    }

    return submitApplication(client, message.author, s, message.channel);
  });
}

/* =========================================================
   SUBMIT -> review channel
========================================================= */

function embedLen(e) {
  const d = e.data;
  return (
    (d.title?.length || 0) +
    (d.description?.length || 0) +
    (d.footer?.text?.length || 0) +
    (d.author?.name?.length || 0) +
    (d.fields || []).reduce((n, f) => n + f.name.length + f.value.length, 0)
  );
}

// Answers go into as few embeds/messages as Discord allows (6000 characters per message).
function answerEmbeds(answers) {
  const blocks = answers.map((a, i) => `**${i + 1}. ${a.q}**\n${a.a}`);
  const descs = [];
  let cur = '';
  for (const b of blocks) {
    if (cur && cur.length + b.length + 2 > 3600) {
      descs.push(cur);
      cur = '';
    }
    cur += (cur ? '\n\n' : '') + b;
  }
  if (cur) descs.push(cur);
  return descs.map((d) => new EmbedBuilder().setColor(COLOR.neutral).setDescription(d));
}

function packMessages(first, rest) {
  const messages = [[first]];
  let size = embedLen(first);
  for (const e of rest) {
    const len = embedLen(e);
    const cur = messages[messages.length - 1];
    if (size + len > 5600 || cur.length >= 10) {
      messages.push([]);
      size = 0;
    }
    messages[messages.length - 1].push(e);
    size += len;
  }
  return messages;
}

function duration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

function decisionRow(appId, state = null) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sapp_accept:${appId}`)
      .setLabel(state === 'accepted' ? 'Accepted' : 'Accept')
      .setStyle(ButtonStyle.Success)
      .setDisabled(Boolean(state)),
    new ButtonBuilder()
      .setCustomId(`sapp_deny:${appId}`)
      .setLabel(state === 'denied' ? 'Denied' : 'Deny')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(Boolean(state))
  );
}

async function submitApplication(client, user, session, dm) {
  const failBack = async () => {
    // Put the last answer back so they can just send it again.
    const sessions = read('sessions');
    const s = sessions[user.id];
    if (s) {
      s.answers.pop();
      s.index -= 1;
      sessions[user.id] = s;
      store.set('sessions', sessions);
    }
    await dm
      .send('Something went wrong sending your application to staff. Please send your last answer again in a minute, or contact staff.')
      .catch(() => {});
  };

  const reviewChannel = await client.channels.fetch(cfg.reviewChannelId).catch(() => null);
  if (!reviewChannel) {
    console.error(`[staff apps] review channel ${cfg.reviewChannelId} not found`);
    return failBack();
  }

  const member = await reviewChannel.guild.members.fetch(user.id).catch(() => null);
  const appId = crypto.randomBytes(4).toString('hex');
  const now = Date.now();

  const info = new EmbedBuilder()
    .setColor(COLOR.blue)
    .setTitle('Staff Application')
    .setAuthor({ name: member?.displayName || user.globalName || user.username, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`${user} submitted a staff application.`)
    .addFields(
      { name: 'Display Name', value: member?.displayName || user.globalName || user.username, inline: true },
      { name: 'Username', value: user.username, inline: true },
      { name: 'User ID', value: user.id, inline: true },
      { name: 'Joined Discord', value: `<t:${unix(user.createdTimestamp)}:F>\n(<t:${unix(user.createdTimestamp)}:R>)`, inline: true },
      {
        name: 'Joined Server',
        value: member?.joinedTimestamp
          ? `<t:${unix(member.joinedTimestamp)}:F>\n(<t:${unix(member.joinedTimestamp)}:R>)`
          : 'Not in the server',
        inline: true,
      },
      { name: 'Time Taken', value: duration(now - session.startedAt), inline: true },
      { name: 'Highest Role', value: member ? `${member.roles.highest}` : 'None', inline: true },
      { name: 'Submitted', value: `<t:${unix(now)}:R>`, inline: true }
    )
    .setFooter({ text: `Application ID: ${appId}` })
    .setTimestamp(now);

  const messages = packMessages(info, answerEmbeds(session.answers));

  let first;
  try {
    first = await reviewChannel.send({
      content: cfg.pingRoleId ? `<@&${cfg.pingRoleId}>` : undefined,
      embeds: messages[0],
      components: [decisionRow(appId)],
      allowedMentions: { roles: cfg.pingRoleId ? [cfg.pingRoleId] : [] },
    });
    for (const embeds of messages.slice(1)) await reviewChannel.send({ embeds });
  } catch (err) {
    console.error('[staff apps] could not post application:', err);
    return failBack();
  }

  const apps = read('apps');
  apps[appId] = {
    id: appId,
    userId: user.id,
    status: 'pending',
    answers: session.answers,
    startedAt: session.startedAt,
    submittedAt: now,
    reviewChannelId: reviewChannel.id,
    reviewMessageId: first.id,
  };
  store.set('apps', apps);

  const sessions = read('sessions');
  delete sessions[user.id];
  store.set('sessions', sessions);

  const done = new EmbedBuilder()
    .setColor(COLOR.green)
    .setTitle('Application submitted')
    .setDescription(
      'Thanks! Staff will review your application and I will DM you the result.\n\n**Do not ping staff about your application, you will be denied.**'
    );
  await dm.send({ embeds: [done] }).catch(() => {});
}

/* =========================================================
   ACCEPT / DENY (review channel)
========================================================= */

function canReview(member) {
  if (!member) return false;
  if (isStaff(member)) return true;
  return (cfg.reviewerRoleIds || []).some((id) => member.roles?.cache?.has(id));
}

async function handleDecisionButton(interaction) {
  const [prefix, appId] = interaction.customId.split(':');
  const action = prefix === 'sapp_accept' ? 'accept' : 'deny';

  if (!canReview(interaction.member)) {
    return interaction.reply({ content: 'Only staff can accept or deny applications.', flags: EPHEMERAL });
  }

  const app = read('apps')[appId];
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'This application has already been handled.', flags: EPHEMERAL });
  }

  const modal = new ModalBuilder()
    .setCustomId(`sapp_reason:${action}:${appId}`)
    .setTitle(action === 'accept' ? 'Accept application' : 'Deny application')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(900)
          .setPlaceholder('Leave empty to skip')
      )
    );

  return interaction.showModal(modal);
}

function acceptedDm(staff, reason) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.green)
    .setTitle('Application Accepted')
    .setDescription(`Congratulations! Your staff application was accepted by ${staff}. A staff member will be in touch with the next steps.`);
  if (reason) embed.addFields({ name: 'Reason', value: reason });
  return { embeds: [embed] };
}

function deniedDm(staff, reason) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.red)
    .setTitle('Application Denied')
    .setDescription(
      `You got denied. Your staff application was reviewed by ${staff} and was not accepted this time.\n\nDo not worry, you can try again once the wait is over.`
    );
  if (reason) embed.addFields({ name: 'Reason', value: reason });

  // Greyed out on purpose: it only tells them how long to wait.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sapp_reapply_info')
      .setLabel(`Reapply in ${weekText()}!`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
  return { embeds: [embed], components: [row] };
}

async function handleDecisionModal(interaction) {
  const [, action, appId] = interaction.customId.split(':');

  if (!canReview(interaction.member)) {
    return interaction.reply({ content: 'Only staff can accept or deny applications.', flags: EPHEMERAL });
  }

  return withLock(`app:${appId}`, async () => {
    const apps = read('apps');
    const app = apps[appId];
    if (!app || app.status !== 'pending') {
      return interaction.reply({ content: 'This application has already been handled.', flags: EPHEMERAL });
    }

    const accepted = action === 'accept';
    const reason = interaction.fields.getTextInputValue('reason')?.trim() || null;

    app.status = accepted ? 'accepted' : 'denied';
    app.decidedBy = interaction.user.id;
    app.decidedAt = Date.now();
    app.reason = reason;
    apps[appId] = app;
    store.set('apps', apps);

    if (!accepted) {
      const cooldowns = read('cooldowns');
      cooldowns[app.userId] = app.decidedAt;
      store.set('cooldowns', cooldowns);
    }

    // Update the review message: colour, decision line, buttons greyed out.
    const embeds = interaction.message.embeds.map((e) => EmbedBuilder.from(e));
    embeds[0]
      .setColor(accepted ? COLOR.green : COLOR.red)
      .addFields({
        name: accepted ? 'Accepted' : 'Denied',
        value: `By ${interaction.user} <t:${unix(app.decidedAt)}:R>${reason ? `\n**Reason:** ${reason}` : ''}`,
      });
    const payload = { embeds, components: [decisionRow(appId, app.status)] };

    if (interaction.isFromMessage()) await interaction.update(payload);
    else {
      await interaction.deferReply({ flags: EPHEMERAL });
      await interaction.message?.edit(payload).catch(() => {});
      await interaction.editReply('Done.');
    }

    const notes = [];

    if (accepted && cfg.acceptedRoleId) {
      try {
        const member = await interaction.guild.members.fetch(app.userId);
        await member.roles.add(cfg.acceptedRoleId);
      } catch (err) {
        console.error('[staff apps] could not give the accepted role:', err.message);
        notes.push("I couldn't give the accepted role (check my role position and Manage Roles).");
      }
    }

    try {
      const applicant = await interaction.client.users.fetch(app.userId);
      await applicant.send(accepted ? acceptedDm(interaction.user, reason) : deniedDm(interaction.user, reason));
    } catch {
      notes.push("I couldn't DM the applicant (their DMs are closed).");
    }

    if (notes.length) await interaction.followUp({ content: notes.join('\n'), flags: EPHEMERAL }).catch(() => {});
  });
}

/* =========================================================
   CLEANUP (runs every minute from events/ready.js)
========================================================= */

function startSessionSweeper(client) {
  const sweep = async () => {
    const sessions = read('sessions');
    for (const [userId, s] of Object.entries(sessions)) {
      if (isExpired(s)) await expireSession(client, userId, s).catch((err) => console.error('[staff apps] expire failed', err));
    }
  };
  sweep();
  setInterval(sweep, 60 * 1000).unref();
}

module.exports = {
  QUESTIONS,
  panelPayload,
  handleApplyButton,
  handleStartButton,
  handleCancelButton,
  handleDmMessage,
  handleDecisionButton,
  handleDecisionModal,
  startSessionSweeper,
};
