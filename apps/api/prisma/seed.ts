import { PrismaClient, OrderStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('Password123!', 10);
  const admin = await prisma.user.upsert({ where: { email: 'admin@oms.local' }, update: {}, create: { email: 'admin@oms.local', name: 'Avery Admin', passwordHash: hash, role: Role.ADMIN } });
  await prisma.user.upsert({ where: { email: 'manager@oms.local' }, update: {}, create: { email: 'manager@oms.local', name: 'Morgan Manager', passwordHash: hash, role: Role.MANAGER } });
  const designer = await prisma.user.upsert({ where: { email: 'designer@oms.local' }, update: {}, create: { email: 'designer@oms.local', name: 'Dev Designer', passwordHash: hash } });
  const maker = await prisma.user.upsert({ where: { email: 'maker@oms.local' }, update: {}, create: { email: 'maker@oms.local', name: 'Mina Maker', passwordHash: hash } });
  const existing = await prisma.order.count(); if (existing) return;
  await prisma.order.create({ data: { orderNumber: 'OMS-00001', customerName: 'Northstar Cafe', customerEmail: 'orders@northstar.example', description: '50 branded canvas tote bags', quantity: 50, priority: 2, status: OrderStatus.DESIGNING, assignments: { create: { userId: designer.id } }, statusHistory: { create: [{ toStatus: OrderStatus.ORDER_RECEIVED, note: 'Order created', changedById: admin.id }, { fromStatus: OrderStatus.ORDER_RECEIVED, toStatus: OrderStatus.DESIGNING, note: 'Assigned to design', changedById: admin.id }] } } });
  await prisma.order.create({ data: { orderNumber: 'OMS-00002', customerName: 'Greenline Studio', description: '24 custom printed mugs', quantity: 24, status: OrderStatus.MAKING, assignments: { create: { userId: maker.id } }, statusHistory: { create: { toStatus: OrderStatus.MAKING, note: 'Seeded in production', changedById: admin.id } } } });
}
main().finally(() => prisma.$disconnect());
