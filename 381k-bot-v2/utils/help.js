const { embed } = require('./util');

const sections = [
  {
    name: 'General',
    lines: [
      ['/about', 'Name, owner and ping'],
      ['/help', 'View all bot commands'],
      ['/setup', 'Configure the bot for another server'],
      ['/config view', 'View every saved ID'],
      ['/config set', 'Set a channel, category or role'],
      ['/config ranks', 'Set staff ranks, highest first'],
      ['/config demote', 'Set the roles members can be demoted to'],
      ['/level lb', 'Level leaderboard or one member']
    ]
  },
  {
    name: 'Panels',
    lines: [
      ['!ticketpanel', 'Ticket panel'],
      ['!setupbuilding', 'Building services panel'],
      ['!middlemanpanel', 'Middleman panel'],
      ['!spawnerpanel', 'Spawner buy and sell panel'],
      ['!adpanel', 'Paid ads panel'],
      ['!reactroles', 'Ping roles panel'],
      ['!applicationpanel', 'Applications panel'],
      ['!review complete', 'Close review and send transcript'],
      ['!recap', 'Recap the current ticket or channel']
    ]
  },
  {
    name: 'Staff',
    lines: [
      ['/stafflist', 'Staff list by highest rank'],
      ['/staff role select', 'Ticket ping role selector'],
      ['/promote', 'Promote member and post changelog'],
      ['/demote', 'Demote a member, optionally to a chosen role'],
      ['/activity check', 'Start a 24 hour activity check'],
      ['/partner tracker', 'Partner leaderboard'],
      ['/partner reset', 'Reset partner leaderboard'],
      ['/schematictracker leaderboard', 'Weekly schematic leaderboard'],
      ['/schematictracker user', 'View schematic points'],
      ['/schematictracker remove', 'Remove 1 point'],
      ['/schematictracker reset', 'Reset one member'],
      ['/schematictracker resetall', 'Reset all schematic points']
    ]
  },
  {
    name: 'Strikes',
    lines: [
      ['/strikeadd', 'Add a strike'],
      ['/strikeremove', 'Remove strike 1, 2 or 3'],
      ['/strikelist', 'View strikes of a member'],
      ['/strikeclear', 'Clear all strikes'],
      ['3 strikes', 'Auto demotes one rank and resets strikes']
    ]
  },
  {
    name: 'Staff Applications',
    lines: [
      ['/staff-app-panel', 'Post the blue Staff Application button (applicants answer in DMs)']
    ]
  },
  {
    name: 'Giveaways',
    lines: [
      ['/gcreate', 'Start a giveaway'],
      ['/gend', 'End a giveaway early'],
      ['/greroll', 'Pick new winners']
    ]
  },
  {
    name: 'Utility',
    lines: [
      ['/embed', 'Post an embed or plain text'],
      ['/lock', 'Lock a channel for everyone'],
      ['/unlock', 'Unlock a channel']
    ]
  },
  {
    name: 'Moderation',
    lines: [
      ['!purge <amount>', 'Purge messages'],
      ['!to @user [time]', 'Timeout, defaults to 1 hour'],
      ['!ban @user [reason]', 'Ban member']
    ]
  },
  {
    name: 'Systems',
    lines: [
      ['Levels', 'XP from messages, level up embed, no roles'],
      ['Auto Nicknames', 'Sync staff display name and rank'],
      ['Welcome System', 'Banner, avatar and member number'],
      ['Message Logs', 'Edited and deleted messages'],
      ['Transcripts', 'Ticket and review transcripts as .txt'],
      ['Anti Raid', 'Join flood, spam and mass mention protection']
    ]
  }
];

function helpEmbed(guild) {
  const e = embed(guild).setTitle('📖 Commands').setDescription('Some commands require staff permissions.');
  for (const section of sections) {
    e.addFields({
      name: section.name,
      value: section.lines.map(([name, text]) => `\`${name}\` - ${text}`).join('\n')
    });
  }
  return e;
}

module.exports = { sections, helpEmbed };
