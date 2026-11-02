const { Events } = require('discord.js');
const staff = require('../utils/staff');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (oldMember.partial || !oldMember.roles.cache.equals(newMember.roles.cache)) {
      await staff.syncNick(newMember);
    }
  }
};
