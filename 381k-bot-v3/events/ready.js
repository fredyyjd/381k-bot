const { Events, REST, Routes, ActivityType } = require('discord.js');
const store = require('../utils/store');
const staff = require('../utils/staff');
const { startGiveawayTimer } = require('../utils/giveaways');
const { startSessionSweeper } = require('../utils/staffApp');

async function register(client) {
  const body = [...client.commands.values()].map(c => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, { body });
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(c, client) {
    console.log(`Logged in as ${c.user.tag}`);
    c.user.setActivity('381K Giveaways', { type: ActivityType.Watching });

    try {
      await register(client);
      console.log(`Commands registered (${client.commands.size})`);
    } catch (err) {
      console.error('Command registration failed', err);
    }

    for (const id of store.all()) staff.scheduleActivity(client, id);
    startGiveawayTimer(client); // ends giveaways that are due, also after a restart
    startSessionSweeper(client); // closes staff applications that ran out of time
  }
};
