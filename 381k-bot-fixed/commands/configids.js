const config = require('./config');

// Same command as /config, kept under its old name.
module.exports = {
  data: config.build('configids'),
  execute: config.execute,
  autocomplete: config.autocomplete
};
