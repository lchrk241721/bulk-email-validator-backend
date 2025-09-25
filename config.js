// backend/config.js
const config = {
  development: {
    port: 3001,
    corsOrigin: ['http://localhost:3000']
  },
  production: {
    port: process.env.PORT || 3001,
    corsOrigin: [
      'https://bulkemailvalidator.linkwatch.in'
    ]
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];