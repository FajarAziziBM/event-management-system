require('dotenv').config();

const env = {
  app: {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
  },

  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
  },

  xendit: {
    secretKey: process.env.XENDIT_SECRET_KEY,
  },
};

module.exports = env;
