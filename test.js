require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

async function test() {
  console.log(process.env.DATABASE_URL);

  const prisma = new PrismaClient();

  await postgresDb.$connect();

  console.log("Connected!");

  await postgresDb.$disconnect();
}

test().catch(console.error);