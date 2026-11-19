import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required');
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({host:parsed.hostname,port:Number(parsed.port||3306),user:decodeURIComponent(parsed.username),password:decodeURIComponent(parsed.password),database:parsed.pathname.slice(1),connectionLimit:12,connectTimeout:10000});
  return new PrismaClient({adapter});
}
export const db = createDb();
