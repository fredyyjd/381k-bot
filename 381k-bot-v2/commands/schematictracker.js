const { SlashCommandBuilder } = require('discord.js');
const store = require('../utils/store');
const staff = require('../utils/staff');
const { isManager, isStaff } = require('../utils/util');
const { deny, text } = require('../utils/reply');

const userOption = (o, required = true, description = 'Member') =>
  o.setName('user').setDescription(description).setRequired(required);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schematictracker')
    .setDescription('Schematic points')
    .addSubcommand(s => s.setName('leaderboard').setDescription('Weekly schematic leaderboard'))
    .addSubcommand(s =>
      s.setName('user').setDescription('View schematic points').addUserOption(o => userOption(o, false))
    )
    .addSubcommand(s => s.setName('remove').setDescription('Remove 1 point').addUserOption(o => userOption(o)))
    .addSubcommand(s => s.setName('reset').setDescription('Reset one member').addUserOption(o => userOption(o)))
    .addSubcommand(s => s.setName('resetall').setDescription('Reset all schematic points')),

  async execute(i) {
    if (!i.guild) return;
    const sub = i.options.getSubcommand();
    const g = store.guild(i.guild.id);

    if (sub === 'leaderboard' || sub === 'user') {
      if (!isStaff(i.member)) return deny(i);
    } else if (!isManager(i.member)) {
      return deny(i);
    }

    if (sub === 'leaderboard') {
      return i.reply({ embeds: [staff.board(i.guild, 'Weekly Schematic Leaderboard', staff.schematic(g))] });
    }
    if (sub === 'user') {
      const user = i.options.getUser('user') || i.user;
      const points = staff.schematic(g)[user.id] || 0;
      return text(i, `${user} has ${points} schematic point${points === 1 ? '' : 's'} this week.`);
    }
    if (sub === 'remove') {
      const user = i.options.getUser('user');
      const points = staff.schematic(g);
      points[user.id] = Math.max((points[user.id] || 0) - 1, 0);
      store.save();
      return text(i, `Removed 1 point from ${user}. They now have ${points[user.id]}.`);
    }
    if (sub === 'reset') {
      const user = i.options.getUser('user');
      delete staff.schematic(g)[user.id];
      store.save();
      return text(i, `Schematic points reset for ${user}.`);
    }
    if (sub === 'resetall') {
      staff.schematic(g);
      g.schematic.points = {};
      store.save();
      return text(i, 'All schematic points reset.');
    }
  }
};
