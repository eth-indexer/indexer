import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_ADMIN_USER || "postgres",
  password: process.env.DB_ADMIN_PASSWORD || "password",
  database: "postgres",
};

const NEW_DB_NAME = process.env.DB_NAME || "indexer";
const NEW_DB_USER = process.env.DB_USER || "indexer_user";
const NEW_DB_PASSWORD = process.env.DB_PASSWORD || "indexer_password";

async function setupDatabase() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    try {
      await client.query(
        `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_user WHERE usename = $1) THEN
            CREATE USER ${NEW_DB_USER} WITH PASSWORD '${NEW_DB_PASSWORD}';
          END IF;
        END
        $$;
      `,
        [NEW_DB_USER]
      );
      console.log(`Created the user: ${NEW_DB_USER}`);
    } catch (err: any) {
      console.log("Error when adding the user:", err?.message);
    }

    const dbExists = await client.query(
      `
      SELECT 1 FROM pg_database WHERE datname = $1
    `,
      [NEW_DB_NAME]
    );

    if (dbExists.rows.length > 0) {
      console.log(`Database ${NEW_DB_NAME} already exists`);
    } else {
      await client.query(`CREATE DATABASE ${NEW_DB_NAME}`);
      console.log(`Database ${NEW_DB_NAME} created`);
    }

    await client.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${NEW_DB_NAME} TO ${NEW_DB_USER}`
    );
    console.log(`Granted privileges to ${NEW_DB_USER}`);

    const dbUrl = `postgresql://${NEW_DB_USER}:${NEW_DB_PASSWORD}@${config.host}:${config.port}/${NEW_DB_NAME}?schema=public`;

    console.log("DB URL:", dbUrl);
  } catch (err) {
    console.error("Error setting up database:", err);
    throw err;
  } finally {
    await client.end();
  }
}

setupDatabase().catch(console.error);
