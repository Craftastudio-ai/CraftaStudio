import { defineConfig } from "prisma/config";

export default defineConfig({
  db: {
    url: process.env.DATABASE_URL,
  },
});