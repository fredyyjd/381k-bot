const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const { embed } = require('./util');
const tickets = require('./tickets');

const EPHEMERAL = MessageFlags.Ephemeral;

const PRODUCTS = [
  { label: '@everyone ping', price: 4 },
  { label: '@Member ping', price: 3 },
  { label: '@here ping', price: 2 },
  { label: 'Personal channel, 1 day', price: 0.5 },
  { label: 'Personal channel, 1 week', price: 3 },
  { label: 'Nitro Premium', price: 12 },
  { label: 'Nitro Basic', price: 4 }
];

const money = n => `$${n.toFixed(2)}`;

function panel(guild) {
  const e = embed(guild)
    .setTitle('Paid Ads')
    .setDescription(
      [
        '**Paid Advertisement**',
        'Want to grow your server?',
        'Select everything you want to purchase below and the bot will automatically calculate your total.'
      ].join('\n')
    )
    .addFields(
      { name: 'ADVERTISING', value: ['\u2022 @everyone - $4', '\u2022 @Member - $3', '\u2022 @here - $2'].join('\n') },
      { name: 'PERSONAL CHANNEL', value: ['\u2022 $0.50 / day', '\u2022 $3 / week (7 days)'].join('\n') },
      { name: 'NITRO', value: ['\u2022 Nitro Premium - $12', '\u2022 Nitro Basic - $4'].join('\n') },
      { name: 'PAYMENT METHODS', value: ['\u2022 Cash App', '\u2022 PayPal', '\u2022 Gift Cards'].join('\n') },
      {
        name: 'READY TO PURCHASE?',
        value: 'Select your products below to automatically calculate your total and open a ticket.'
      }
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ad:buy').setLabel('Buy paid-ad').setEmoji('\uD83D\uDD37').setStyle(ButtonStyle.Primary)
  );
  return { embeds: [e], components: [row] };
}

function picker(selected = []) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ad:pick')
    .setPlaceholder('Select what you want to purchase')
    .setMinValues(1)
    .setMaxValues(PRODUCTS.length)
    .addOptions(
      PRODUCTS.map((p, n) => ({
        label: p.label,
        description: money(p.price),
        value: String(n),
        default: selected.includes(n)
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function order(guild, ids) {
  const items = ids.map(n => PRODUCTS[n]);
  const total = items.reduce((sum, p) => sum + p.price, 0);
  const lines = items.map(p => `${p.label} - ${money(p.price)}`);
  return { lines, total };
}

async function route(i) {
  const [, kind, arg] = i.customId.split(':');

  if (i.isButton() && kind === 'buy') {
    return i.reply({
      embeds: [embed(i.guild).setDescription('Select what you want to purchase below.')],
      components: [picker()],
      flags: EPHEMERAL
    });
  }

  if (i.isStringSelectMenu() && kind === 'pick') {
    const ids = i.values.map(Number).filter(n => PRODUCTS[n]).sort((a, b) => a - b);
    const { lines, total } = order(i.guild, ids);
    const e = embed(i.guild)
      .setTitle('Your Order')
      .setDescription(`${lines.join('\n')}\n\n**Total: ${money(total)}**`);
    const confirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ad:open:${ids.join(',')}`).setLabel('Open Ticket').setStyle(ButtonStyle.Success)
    );
    return i.update({ embeds: [e], components: [picker(ids), confirm] });
  }

  if (i.isButton() && kind === 'open') {
    const ids = String(arg || '')
      .split(',')
      .map(Number)
      .filter(n => PRODUCTS[n]);
    if (!ids.length) return i.reply({ content: 'Select a product first.', flags: EPHEMERAL });
    const { lines, total } = order(i.guild, ids);
    return tickets.openTicket(i, 'ad', [
      ['Items', lines.join('\n')],
      ['Total', money(total)],
      ['Payment Methods', 'Cash App, PayPal, Gift Cards']
    ]);
  }
}

module.exports = { panel, route };
