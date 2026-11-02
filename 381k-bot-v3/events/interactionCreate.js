const { Events, MessageFlags } = require('discord.js');
const tickets = require('../utils/tickets');
const apps = require('../utils/apps');
const staff = require('../utils/staff');
const ads = require('../utils/ads');
const roles = require('../utils/roles');
const staffApp = require('../utils/staffApp');
const config = require('../commands/config');
const { handleGiveawayButton } = require('../utils/giveaways');

module.exports = {
  name: Events.InteractionCreate,
  async execute(i, client) {
    try {
      const id = i.customId || '';

      // Staff application buttons that are pressed inside the applicant's DMs.
      if (i.isButton() && (id === 'sapp_start' || id === 'sapp_cancel')) {
        return id === 'sapp_start' ? await staffApp.handleStartButton(i) : await staffApp.handleCancelButton(i);
      }

      if (!i.guild) return;

      if (i.isAutocomplete()) {
        const command = client.commands.get(i.commandName);
        return command?.autocomplete ? await command.autocomplete(i) : undefined;
      }

      if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        return command ? await command.execute(i) : undefined;
      }

      if (i.isButton()) {
        if (id === 'giveaway_enter') return await handleGiveawayButton(i);
        if (id === 'sapp_apply') return await staffApp.handleApplyButton(i);
        if (id.startsWith('sapp_accept:') || id.startsWith('sapp_deny:')) {
          return await staffApp.handleDecisionButton(i);
        }
      }

      if (i.isModalSubmit() && id.startsWith('sapp_reason:')) {
        return await staffApp.handleDecisionModal(i);
      }

      if (id.startsWith('cfg:')) return await config.route(i);
      if (id.startsWith('tk:')) return await tickets.route(i);
      if (id.startsWith('ap:')) return await apps.route(i);
      if (id.startsWith('act:')) return await staff.routeActivity(i);
      if (id.startsWith('ad:')) return await ads.route(i);
      if (id.startsWith('rr:')) return await roles.route(i);
    } catch (err) {
      console.error(err);
      if (i.isAutocomplete()) return;
      const payload = { content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
      if (i.deferred || i.replied) i.followUp(payload).catch(() => {});
      else i.reply(payload).catch(() => {});
    }
  }
};
