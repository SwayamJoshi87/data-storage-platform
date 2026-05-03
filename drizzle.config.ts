import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './api/db/migrations',
  schema: './api/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
