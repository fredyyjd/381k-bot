const { MessageFlags } = require('discord.js');

const EPHEMERAL = MessageFlags.Ephemeral;

const deny = (i) => i.reply({ content: 'You do not have permission to use this command.', flags: EPHEMERAL });
const text = (i, content) => i.reply({ content, flags: EPHEMERAL });

module.exports = { EPHEMERAL, deny, text };
