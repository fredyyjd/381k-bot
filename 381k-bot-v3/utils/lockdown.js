const { PermissionFlagsBits } = require('discord.js');
const createStore = require('./jsonStore');

// data/locks.json: channelId -> what @everyone's overrides were before /lock,
// so /unlock can put them back exactly (a channel where @everyone was explicitly
// allowed to type goes back to allowed, anything else goes back to default).
const store = createStore('locks.json', {});
const FLAGS = ['SendMessages', 'SendMessagesInThreads'];

function stateOf(overwrite, flag) {
  if (!overwrite) return null;
  if (overwrite.allow.has(PermissionFlagsBits[flag])) return true;
  if (overwrite.deny.has(PermissionFlagsBits[flag])) return false;
  return null;
}

const everyoneOverwrite = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);

function isLocked(channel) {
  return stateOf(everyoneOverwrite(channel), 'SendMessages') === false;
}

async function lockChannel(channel, user) {
  if (isLocked(channel)) return { already: true };

  const ow = everyoneOverwrite(channel);
  const prev = {};
  for (const f of FLAGS) prev[f] = stateOf(ow, f);
  store.set(channel.id, { prev, by: user.id, at: Date.now() });

  try {
    await channel.permissionOverwrites.edit(
      channel.guild.roles.everyone,
      { SendMessages: false, SendMessagesInThreads: false },
      { reason: `Locked by ${user.tag ?? user.username}` }
    );
  } catch (err) {
    store.delete(channel.id);
    throw err;
  }
  return { already: false };
}

async function unlockChannel(channel, user) {
  if (!isLocked(channel)) return { already: true };

  const saved = store.get(channel.id);
  const patch = {};
  for (const f of FLAGS) patch[f] = saved?.prev?.[f] === true ? true : null;

  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, patch, {
    reason: `Unlocked by ${user.tag ?? user.username}`,
  });
  store.delete(channel.id);
  return { already: false };
}

module.exports = { lockChannel, unlockChannel, isLocked };
