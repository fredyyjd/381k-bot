const { Events, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const store = require('../utils/store');
const { embed, send } = require('../utils/util');
const staff = require('../utils/staff');

const joins = new Map();

const JOIN_LIMIT = 6;
const JOIN_WINDOW = 10000;

async function welcomeImage(member, number) {
  const canvas = createCanvas(1000, 360);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1000, 360);
  gradient.addColorStop(0, '#17171c');
  gradient.addColorStop(1, '#2f2f3a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 360);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, 14, 360);

  const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
  ctx.save();
  ctx.beginPath();
  ctx.arc(180, 180, 110, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 70, 70, 220, 220);
  ctx.restore();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(180, 180, 113, 0, Math.PI * 2);
  ctx.stroke();

  const name = member.displayName.length > 20 ? member.displayName.slice(0, 19) + '...' : member.displayName;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('WELCOME', 340, 140);
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(name, 340, 205);
  ctx.fillStyle = '#b5b5c4';
  ctx.font = '30px sans-serif';
  ctx.fillText(`Member #${number}`, 340, 260);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome.png' });
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const guild = member.guild;
    const cfg = store.guild(guild.id).cfg;

    // Anti raid: join flood.
    const now = Date.now();
    const list = (joins.get(guild.id) || []).filter(j => now - j.time < JOIN_WINDOW);
    list.push({ id: member.id, time: now });
    joins.set(guild.id, list);

    if (list.length >= JOIN_LIMIT) {
      joins.set(guild.id, []);
      let count = 0;
      for (const entry of list) {
        const target = await guild.members.fetch(entry.id).catch(() => null);
        if (target && target.moderatable) {
          await target.timeout(3600000, 'Anti raid: join flood').catch(() => {});
          count += 1;
        }
      }
      await send(guild, 'log_channel', {
        embeds: [
          embed(guild)
            .setTitle('Anti Raid Triggered')
            .setDescription(`${list.length} members joined within ${JOIN_WINDOW / 1000} seconds. ${count} of them were timed out for 1 hour.`)
        ]
      });
    }

    // Welcome banner.
    if (cfg.welcome_channel && !member.user.bot) {
      const channel = guild.channels.cache.get(cfg.welcome_channel);
      if (channel) {
        const file = await welcomeImage(member, guild.memberCount).catch(() => null);
        const e = embed(guild)
          .setTitle('Welcome')
          .setDescription(`${member}, welcome to ${guild.name}. You are member number ${guild.memberCount}.`);
        if (file) e.setImage('attachment://welcome.png');
        await channel.send({ content: `${member}`, embeds: [e], files: file ? [file] : [] }).catch(() => {});
      }
    }

    await staff.syncNick(member);
  }
};
