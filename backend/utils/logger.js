// backend/utils/logger.js
const pino = require('pino');
const config = require('../config');

const loggerOptions = {
  level: config.logLevel || 'info', // Default to 'info', can be set via LOG_LEVEL env var in config
};

// Use pino-pretty for development for more readable logs
if (config.nodeEnv === 'development') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard', // More readable timestamp
      ignore: 'pid,hostname', // Less noise in dev logs
    },
  };
}

const logger = pino(loggerOptions);

module.exports = logger;
