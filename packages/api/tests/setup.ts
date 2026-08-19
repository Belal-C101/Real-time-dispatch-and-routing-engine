import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

beforeAll(async () => {
  // Setup test database
});

afterAll(async () => {
  await prisma.$disconnect();
});
