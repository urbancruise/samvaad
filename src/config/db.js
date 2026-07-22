const { PrismaClient: MySQLClient } = require("../../generated/mysql-client");
const { PrismaClient: PostgresClient } = require("../../generated/postgres-client");

const mysqlDb = new MySQLClient({ log: ["warn", "error"] });
const postgresDb = new PostgresClient({ log: ["warn", "error"] });

const connectDB = async () => {
  try {
    await mysqlDb.$connect();
    console.log("✅ MySQL (main user data) connected.");
    await postgresDb.$connect();
    console.log("✅ PostgreSQL (app data) connected.");
  } catch (error) {
    console.error("❌ Prisma connection failed:", error);
    process.exit(1);
  }
};

module.exports = { mysqlDb, postgresDb, connectDB };