//recommended keep this for later
import winston from 'winston'

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: "api-gateway" },
    transports: [
        // Only log to console in non-production
        ...(process.env.NODE_ENV !== 'production'
            ? [
                  new winston.transports.Console({
                      format: winston.format.combine(
                          winston.format.colorize(),
                          winston.format.simple()
                      )
                  })
              ]
            : []),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: 'logs/combined.log'
        })
    ]
});

export default logger;
