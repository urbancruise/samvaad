require("dotenv").config();
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const httpServer = http.createServer(app);
require("./module/email/Email.socket").initEmailSocket(httpServer);
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the server due to initialization error:", error);
    process.exit(1);
  }
};

startServer();