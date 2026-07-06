const app = require('./app');
const logger = require("./config/logger");
const requestLogger = require("./middlewares/requestLogger");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
