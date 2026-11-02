const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const store = require('../utils/store');
const { embed, isAdmin } = require('../utils/util');
const { EPHEMERAL, deny } = require('../utils/reply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot for another server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(i) {
    if (!i.guild) return;
    if (!isAdmin(i.member)) return deny(i);

    await i.deferReply({ flags: EPHEMERAL });
    const guild = i.guild;
    const cfg = store.guild(guild.id).cfg;
    const hidden = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles
        ]
      }
    ];

    const make = async (key, name, type, privateChannel) => {
      if (cfg[key] && guild.channels.cache.has(cfg[key])) return;
      const channel = await guild.channels.create({
        name,
        type,
        permissionOverwrites: privateChannel ? hidden : undefined
      });
      cfg[key] = channel.id;
    };

    try {
      await make('ticket_category', 'Tickets', ChannelType.GuildCategory);
      await make('middleman_category', 'Middleman', ChannelType.GuildCategory);
      await make('building_category', 'Building', ChannelType.GuildCategory);
      await make('spawner_category', 'Spawners', ChannelType.GuildCategory);
      await make('ad_category', 'Paid Ads', ChannelType.GuildCategory);
      await make('levels_channel', 'levels', ChannelType.GuildText);
      await make('welcome_channel', 'welcome', ChannelType.GuildText);
      await make('log_channel', 'logs', ChannelType.GuildText, true);
      await make('transcript_channel', 'transcripts', ChannelType.GuildText, true);
      await make('application_channel', 'application-review', ChannelType.GuildText, true);
      await make('changelog_channel', 'staff-changelog', ChannelType.GuildText, true);
      await make('activity_channel', 'activity-checks', ChannelType.GuildText, true);
      await make('partner_channel', 'partner-submissions', ChannelType.GuildText, true);
      await make('schematic_channel', 'schematic-submissions', ChannelType.GuildText, true);
    } catch {
      store.save();
      return i.editReply('I could not create every channel. Give me Manage Channels and run /setup again.');
    }
    store.save();

    const e = embed(guild)
      .setTitle('✅ Setup Complete')
      .setDescription(
        [
          'Channels and categories were created and saved.',
          '',
          'Next steps:',
          '* /config set to choose every role, such as the staff role, mod role and ping roles',
          '* /config ranks to set staff ranks, highest first',
          '* /staff role select to choose the ticket ping role',
          '* Give staff access to the private channels',
          '* Run !ticketpanel and !applicationpanel where you want them'
        ].join('\n')
      );
    return i.editReply({ embeds: [e] });
  }
};
