// Settings that are the same every time the bot runs.
// Tokens and ids live in the .env file (TOKEN, CLIENT_ID, GUILD_ID).
module.exports = {
  // ---- /about ----
  about: {
    name: '381K Bot',
    owner: 'smooth & 381k'
  },

  // ---- Staff applications (the blue "Staff Application" button, answered in DMs) ----
  staffApplication: {
    // Every finished application is posted here with Accept / Deny buttons.
    reviewChannelId: '1560663173626069123',
    // Extra roles allowed to press Accept / Deny (staff, mods and managers always can).
    reviewerRoleIds: [],
    // Role pinged in the review channel when an application lands ('' = no ping).
    pingRoleId: '',
    // Role given to the applicant when accepted ('' = none).
    acceptedRoleId: '',
    // How long they have to finish once they press Start App.
    timeLimitHours: 3,
    // How long a denied applicant has to wait before applying again.
    reapplyDays: 7
  }
};
