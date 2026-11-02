# 381K Bot

Tickets, giveaway claims, applications, staff management, levels, welcome banners and anti raid for the 381K community.
Now with a DM staff application flow, giveaways, `/embed`, `/lock` and `/unlock`.

## Layout

```
index.js            loads everything below (root)
package.json        (root)
config.js           bot name and owner for /about, staff application settings
commands/           one file per slash command
events/             one file per Discord event
utils/              helpers: store, tickets, apps, staff, levels, giveaways, staffApp, prefix (! commands) ...
data/               created at runtime (not in git)
```

## .env

```
TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
```

Slash commands register themselves every time the bot starts.

## New commands

| Command | What it does |
| --- | --- |
| `/staff-app-panel` | Posts the blue **Staff Application** button in the current channel |
| `/embed` | Posts a yellow embed or plain text (choose with `type`) |
| `/lock` `/unlock` | Locks / unlocks a channel for @everyone and posts "#channel has been locked by @user" |
| `/gcreate` `/gend` `/greroll` | Giveaways: start, end early, reroll |
| `/config` | The only config command. Opens a panel to pick channels, categories, staff roles, ticket staff roles, ping roles, staff ranks and demotion roles |
| `/demote` | Demotes one rank, or to a role picked from the `/config demote` list |
| `/about` | Name, owner and ping |

### Staff applications

1. Run `/staff-app-panel` where you want the button.
2. A member presses **Staff Application** and gets a DM with **Start App** (green) and **Cancel App** (red).
3. After Start they have 3 hours to answer the 9 questions in the DM. Every question has the red Cancel App button.
4. The finished application goes to the review channel (`config.js`, `reviewChannelId`) with the member's info on top and **Accept** (green) / **Deny** (red).
5. Both buttons ask for an optional reason, then the applicant is DMed. A denied applicant gets a greyed out **Reapply in 1 week!** button and cannot apply again until the week is over.

Change the questions in `utils/staffApp.js` (`QUESTIONS`). Everything else is in `config.js`.

## Updating on the VPS

```
git pull && npm install && pm2 restart 381k-bot
```
