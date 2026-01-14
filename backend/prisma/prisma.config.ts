import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './schema.prisma',

  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://home-cam:home-cam@localhost:5432/home-cam?schema=public',
  },
});
