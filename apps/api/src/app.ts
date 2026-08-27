import express, { NextFunction, Request, Response } from 'express';

import cors from 'cors';

import jwt from 'jsonwebtoken';

import bcrypt from 'bcryptjs';

import { PrismaClient, Role, OrderStatus } from '@prisma/client';

import { z } from 'zod';

import { canTransition } from './workflow.js';


const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
prisma.$on('query', event => console.info(`DB ${event.duration}ms ${event.query.replace(/\s+/g, ' ').slice(0, 120)}`));

const secret = process.env.JWT_SECRET || 'development-only-secret';

type AuthUser = { id: string;
 role: Role;
 email: string };

declare global { namespace Express { interface Request { user?: AuthUser } } }

const orderInclude = { assignments: { include: { user: { select: { id: true, name: true, email: true, role: true } } } }, shipment: true, files: true } as const;

const app = express();

app.use(cors());
 app.use(express.json());
app.use((req, res, next) => {
  const startedAt = performance.now();
  res.on('finish', () => {
    const elapsedMs = performance.now() - startedAt;
    console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`);
  });
  next();
});


function fail(res: Response, status: number, message: string) { return res.status(status).json({ error: { message } });
 }
function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) return fail(res, 401, 'Authentication required');

  try { req.user = jwt.verify(token, secret) as AuthUser;
 next();
 } catch { return fail(res, 401, 'Invalid or expired token');
 }
}
function admin(req: Request, res: Response, next: NextFunction) { return req.user?.role === 'ADMIN' ? next() : fail(res, 403, 'Admin access required');
 }
function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) { return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
 }
function page(value: unknown, fallback: number) { const n = Number(value);
 return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
 }
function param(req: Request, name: string) { const value = req.params[name];
 return Array.isArray(value) ? value[0] : value;
 }
async function allowedOnOrder(req: Request, res: Response) {
  if (req.user!.role === 'ADMIN') return true;

  const item = await prisma.orderAssignment.findUnique({ where: { orderId_userId: { orderId: param(req, 'id'), userId: req.user!.id } } });

  if (!item) { fail(res, 403, 'You must be assigned to this order');
 return false;
 }
  return true;

}

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash))) return fail(res, 401, 'Invalid email or password');

  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, secret, { expiresIn: '8h' });

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

}));

app.get('/api/auth/me', auth, asyncRoute(async (req, res) => res.json(await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, active: true } }))));


app.get('/api/users', auth, admin, asyncRoute(async (_, res) => res.json(await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } }))));

app.get('/api/orders', auth, asyncRoute(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;

  const status = Object.values(OrderStatus).includes(req.query.status as OrderStatus) ? req.query.status as OrderStatus : undefined;

  const assigneeId = typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined;

  const currentPage = page(req.query.page, 1), limit = Math.min(page(req.query.limit, 20), 100);

  const where = { ...(status && { status }), ...(assigneeId && { assignments: { some: { userId: assigneeId } } }), ...(q && { OR: [{ orderNumber: { contains: q, mode: 'insensitive' as const } }, { customerName: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }] }) };

 const [items, total] = await Promise.all([prisma.order.findMany({ where, include: orderInclude, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], skip: (currentPage - 1) * limit, take: limit }), prisma.order.count({ where })]);

  res.json({ items, page: currentPage, limit, total });

}));

const orderInput = z.object({ customerName: z.string().min(1), customerEmail: z.string().email().optional().or(z.literal('')), customerPhone: z.string().optional(), description: z.string().min(1), quantity: z.number().int().positive().default(1), dueDate: z.string().datetime().optional().nullable(), priority: z.number().int().min(0).max(2).default(0) });

app.post('/api/orders', auth, asyncRoute(async (req, res) => {
  const data = orderInput.parse(req.body);
 const count = await prisma.order.count();
 const orderNumber = `OMS-${String(count + 1).padStart(5, '0')}`;

  const order = await prisma.order.create({ data: { ...data, customerEmail: data.customerEmail || null, dueDate: data.dueDate ? new Date(data.dueDate) : null, orderNumber, statusHistory: { create: { toStatus: 'ORDER_RECEIVED', note: 'Order created', changedById: req.user!.id } } }, include: orderInclude });

  res.status(201).json(order);

}));

app.get('/api/orders/:id', auth, asyncRoute(async (req, res) => { const order = await prisma.order.findUnique({ where: { id: param(req, 'id') }, include: { ...orderInclude, statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } } });
 return order ? res.json(order) : fail(res, 404, 'Order not found');
 }));

app.patch('/api/orders/:id', auth, asyncRoute(async (req, res) => { const data = orderInput.partial().parse(req.body);
 const order = await prisma.order.update({ where: { id: param(req, 'id') }, data: { ...data, customerEmail: data.customerEmail || undefined, dueDate: data.dueDate ? new Date(data.dueDate) : undefined }, include: orderInclude });
 res.json(order);
 }));

app.delete('/api/orders/:id', auth, admin, asyncRoute(async (req, res) => {
  await prisma.order.delete({ where: { id: param(req, 'id') } });
  res.status(204).send();
}));

app.post('/api/orders/:id/status', auth, asyncRoute(async (req, res) => {
  if (!(await allowedOnOrder(req, res))) return;
 const data = z.object({ status: z.nativeEnum(OrderStatus), note: z.string().max(1000).optional() }).parse(req.body);
 const order = await prisma.order.findUnique({ where: { id: param(req, 'id') } });

  if (!order) return fail(res, 404, 'Order not found');
 if (!canTransition(order.status, data.status, req.user!.role === 'ADMIN')) return fail(res, 409, 'Only the next workflow status is allowed');

  res.json(await prisma.order.update({ where: { id: order.id }, data: { status: data.status, statusHistory: { create: { fromStatus: order.status, toStatus: data.status, note: data.note, changedById: req.user!.id } } }, include: orderInclude }));

}));

app.post('/api/orders/:id/assignments', auth, admin, asyncRoute(async (req, res) => { const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
 const orderId = param(req, 'id');
 const result = await prisma.orderAssignment.upsert({ where: { orderId_userId: { orderId, userId } }, create: { orderId, userId }, update: {} });
 res.status(201).json(result);
 }));

app.delete('/api/orders/:id/assignments/:userId', auth, admin, asyncRoute(async (req, res) => { await prisma.orderAssignment.delete({ where: { orderId_userId: { orderId: param(req, 'id'), userId: param(req, 'userId') } } });
 res.status(204).send();
 }));

app.post('/api/orders/:id/files', auth, asyncRoute(async (req, res) => { const data = z.object({ name: z.string().min(1), url: z.string().url(), mimeType: z.string().optional(), kind: z.enum(['ARTWORK', 'REFERENCE', 'PRODUCTION', 'SHIPPING', 'OTHER']).default('OTHER') }).parse(req.body);
 res.status(201).json(await prisma.fileRecord.create({ data: { ...data, orderId: param(req, 'id') } }));
 }));

app.post('/api/orders/:id/shipments', auth, asyncRoute(async (req, res) => { if (!(await allowedOnOrder(req, res))) return;
 const data = z.object({ carrier: z.string().optional(), trackingNumber: z.string().optional(), shippedAt: z.string().datetime().optional().nullable(), deliveryAddress: z.string().optional(), notes: z.string().optional() }).parse(req.body);
 const orderId = param(req, 'id');
 res.json(await prisma.shipment.upsert({ where: { orderId }, create: { ...data, shippedAt: data.shippedAt ? new Date(data.shippedAt) : null, orderId }, update: { ...data, shippedAt: data.shippedAt ? new Date(data.shippedAt) : null } }));
 }));

app.get('/api/dashboard', auth, asyncRoute(async (_, res) => { const [statuses, recent] = await Promise.all([prisma.order.findMany({ select: { status: true } }), prisma.order.findMany({ take: 8, orderBy: { updatedAt: 'desc' }, include: orderInclude })]);
 const byStatus = statuses.reduce<Partial<Record<OrderStatus, number>>>((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {});
 res.json({ byStatus, recent });
 }));

app.use((err: unknown, _: Request, res: Response, __: NextFunction) => { if (err instanceof z.ZodError) return fail(res, 400, err.issues.map(x => x.message).join('; '));
 console.error(err);
 return fail(res, 500, 'Unexpected server error');
 });

export default app;
