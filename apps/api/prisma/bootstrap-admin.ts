import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { emailInput } from '../src/email.js';

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (existingAdmin) {
    console.info('An administrator already exists; skipping bootstrap.');
    return;
  }

  const input = z.object({
    email: emailInput,
    password: z.string().min(12),
    name: z.string().trim().min(1),
  }).parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Administrator',
  });

  await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: Role.ADMIN,
    },
  });
  console.info('Created the initial administrator.');
}

main()
  .finally(() => prisma.$disconnect());
