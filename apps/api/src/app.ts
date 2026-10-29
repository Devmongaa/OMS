import express, { NextFunction, Request, Response } from 'express';

import cors from 'cors';

import jwt from 'jsonwebtoken';

import bcrypt from 'bcryptjs';

import { PrismaClient, Prisma, Role, OrderStatus } from '@prisma/client';

import { z } from 'zod';
import { emailInput } from './email.js';

import { configuration } from './config.js';
const config=configuration(process.env);
import { workload } from './reports.js';
import { randomUUID } from 'node:crypto';
import { aging, orderFilter, orderSort } from './orders.js';
import { canTransition } from './workflow.js';


export const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });

const secret = config.secret;

type AuthUser = { id: string;
 role: Role;
 email: string };

declare global { namespace Express { interface Request { user?: AuthUser } } }

const orderInclude = { assignments: { include: { user: { select: { id: true, name: true, email: true, role: true } } } }, shipment: true, files: true } as const;


const listSelect = { id:true, serialNumber:true, orderNumber:true, customerName:true, orderType:true, status:true, priority:true, createdAt:true, updatedAt:true, assignments:{select:{assignedAt:true,user:{select:{id:true,name:true}}}} } satisfies Prisma.OrderSelect;

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.frontendUrl }));
app.use((_, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
 app.use(express.json());



function fail(res: Response, status: number, message: string) { return res.status(status).json({ error: { message } });
 }
function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return fail(res, 401, 'Authentication required');
  let id: string;
  try { id = (jwt.verify(token, secret) as AuthUser).id; if (!id) throw new Error(); }
  catch { return fail(res, 401, 'Invalid or expired token'); }
  prisma.user.findUnique({ where: { id }, select: { id:true, name:true, email:true, role:true, active:true } }).then(user => {
    if (!user?.active) return fail(res, 401, 'Account unavailable');
    req.user = user; next();
  }).catch(next);
}
function manager(req: Request, res: Response, next: NextFunction) {
  return req.user?.role !== 'EMPLOYEE' ? next() : fail(res, 403, 'Manager access required');
}
function admin(req: Request, res: Response, next: NextFunction) { return req.user?.role === 'ADMIN' ? next() : fail(res, 403, 'Admin access required');
 }
function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) { return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
 }
function page(value: unknown, fallback: number) { const n = Number(value);
 return Number.isSafeInteger(n) && n > 0 ? n : fallback;
 }
function param(req: Request, name: string) { const value = req.params[name];
 return Array.isArray(value) ? value[0] : value;
 }
async function allowedOnOrder(req: Request, res: Response) {
  if (req.user!.role !== 'EMPLOYEE') return true;

  const item = await prisma.orderAssignment.findUnique({ where: { orderId_userId: { orderId: param(req, 'id'), userId: req.user!.id } } });

  if (!item) { fail(res, 403, 'You must be assigned to this order');
 return false;
 }
  return true;

}

app.get(['/health', '/api/health'], (_, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ email: emailInput, password: z.string().min(1) }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash))) return fail(res, 401, 'Invalid email or password');

  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, secret, { expiresIn: '8h' });

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

}));

app.get('/api/auth/me', auth, (req, res) => res.json(req.user));


app.get('/api/users', auth, asyncRoute(async (_, res) => res.json(await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } }))));

app.get('/api/orders', auth, asyncRoute(async (req, res) => {
  const where = orderFilter(req.query, req.user!);
  const currentPage = page(req.query.page, 1), limit = Math.min(page(req.query.limit, 20), 100);
  const [items, total, settings] = await Promise.all([
    prisma.order.findMany({ where, select: listSelect, orderBy: orderSort(req.query), skip: (currentPage - 1) * limit, take: limit }),
    prisma.order.count({ where }), prisma.agingSettings.findUnique({where:{id:1}})
  ]);
  res.json({ items: items.map(o => ({...o, ...aging(o, settings)})), page: currentPage, limit, total });

}));

const orderInput = z.object({ customerName: z.string().min(1), customerEmail: emailInput.optional().or(z.literal('')), customerPhone: z.string().optional(), description: z.string().min(1), quantity: z.number().int().positive().default(1), dueDate: z.string().datetime().optional().nullable(), orderType: z.string().trim().min(1).default("General"), priority: z.number().int().min(0).max(3).default(1) });

app.post('/api/orders', auth, asyncRoute(async (req, res) => {
  const data = orderInput.parse(req.body);
 const orderNumber = `OMS-${randomUUID()}`;

  const order = await prisma.order.create({ data: { ...data, ...(req.user!.role==='EMPLOYEE'?{assignments:{create:{userId:req.user!.id}}}:{}), status: 'NEW', customerEmail: data.customerEmail || null, dueDate: data.dueDate ? new Date(data.dueDate) : null, orderNumber, statusHistory: { create: { toStatus: 'NEW', note: 'Order created', changedById: req.user!.id } } }, include: orderInclude });

  res.status(201).json(order);

}));

app.get('/api/orders/:id', auth, asyncRoute(async (req, res) => { const order = await prisma.order.findUnique({ where: { id: param(req, 'id') }, include: { ...orderInclude, statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } } });
 return order ? res.json({...order, ...aging(order, await prisma.agingSettings.findUnique({where:{id:1}}))}) : fail(res, 404, 'Order not found');
 }));

app.patch('/api/orders/:id', auth, asyncRoute(async (req, res) => { if (!(await allowedOnOrder(req,res))) return; const data = orderInput.partial().parse(req.body);
 const order = await prisma.order.update({ where: { id: param(req, 'id'), ...(req.user!.role==='EMPLOYEE'?{assignments:{some:{userId:req.user!.id}}}:{}) }, data: { ...data, customerEmail: data.customerEmail === undefined ? undefined : data.customerEmail || null, dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null }, include: orderInclude });
 res.json(order);
 }));

app.delete('/api/orders/:id', auth, admin, asyncRoute(async (req, res) => {
  await prisma.order.delete({ where: { id: param(req, 'id') } });
  res.status(204).send();
}));

app.post('/api/orders/:id/status', auth, asyncRoute(async (req, res) => {
 const data = z.object({ status: z.nativeEnum(OrderStatus), note: z.string().max(1000).optional() }).parse(req.body);
 const order = await prisma.order.findUnique({ where: { id: param(req, 'id') } });

  if (!order) return fail(res, 404, 'Order not found');
 if (!canTransition(order.status, data.status)) return fail(res, 409, 'This status transition is not allowed');

  res.json(await prisma.order.update({ where: { id: order.id, status:order.status }, data: { status: data.status, statusHistory: { create: { fromStatus: order.status, toStatus: data.status, note: data.note, changedById: req.user!.id } } }, include: orderInclude }));

}));

app.post('/api/orders/:id/assignments', auth, asyncRoute(async (req, res) => {
  const {userId} = z.object({userId:z.string().min(1)}).parse(req.body);
  const user = await prisma.user.findUnique({where:{id:userId}});
  if (!user?.active) return fail(res, 400, 'Choose an active user');
  const order = await prisma.$transaction(async tx => {
    // Serialize assignment against both reassignments and status updates.
    const [current] = await tx.$queryRaw<{id:string;status:OrderStatus}[]>`
      SELECT id, status FROM "Order" WHERE id = ${param(req,'id')} FOR UPDATE
    `;
    if (!current) return {error:'Order not found',status:404} as const;
    if (current.status !== 'MAKING') return {error:'Orders can only be assigned or reassigned during Making',status:409} as const;
    return {order:await tx.order.update({where:{id:current.id},data:{
      assignments:{deleteMany:{},create:{userId}},
    },include:orderInclude})};
  });
  if (order.error !== undefined) return fail(res, order.status, order.error);
  res.json(order.order);
}));

app.post('/api/orders/:id/files', auth, asyncRoute(async (req, res) => { if (!(await allowedOnOrder(req, res))) return; const data = z.object({ name: z.string().min(1), url: z.string().max(2048).url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS file URL'), mimeType: z.string().optional(), kind: z.enum(['ARTWORK', 'REFERENCE', 'PRODUCTION', 'SHIPPING', 'OTHER']).default('OTHER') }).parse(req.body);
 res.status(201).json(await prisma.fileRecord.create({ data: { ...data, orderId: param(req, 'id') } }));
 }));

app.post('/api/orders/:id/shipments', auth, asyncRoute(async (req, res) => { if (!(await allowedOnOrder(req, res))) return;
 const data = z.object({ carrier: z.string().optional(), trackingNumber: z.string().optional(), shippedAt: z.string().datetime().optional().nullable(), deliveryAddress: z.string().optional(), notes: z.string().optional() }).parse(req.body);
 const orderId = param(req, 'id');
 res.json(await prisma.shipment.upsert({ where: { orderId }, create: { ...data, shippedAt: data.shippedAt ? new Date(data.shippedAt) : null, orderId }, update: { ...data, shippedAt: data.shippedAt ? new Date(data.shippedAt) : null } }));
 }));

app.get('/api/dashboard', auth, asyncRoute(async (req, res) => {
 const where = orderFilter({}, req.user!);
 const settings = await prisma.agingSettings.findUnique({where:{id:1}});
 const now = new Date();
 const overdueWhere: Prisma.OrderWhereInput = { AND:[where,{status:{notIn:['COMPLETED','CANCELLED']},createdAt:{lte:new Date(+now-((settings?.orangeDays ?? 5)+1)*86400000)}}] };
 const [groups,recent,attention,overdue,assignees] = await Promise.all([
  prisma.order.groupBy({by:['status','priority'],where,_count:true}),
  prisma.order.findMany({where,select:listSelect,take:6,orderBy:[{updatedAt:'desc'},{serialNumber:'asc'}]}),
  prisma.order.findMany({where:overdueWhere,select:listSelect,take:4,orderBy:[{createdAt:'asc'},{serialNumber:'asc'}]}),
  prisma.order.count({where:overdueWhere}),
  workload(prisma, {}, req.user!, false, new Date(+now-((settings?.orangeDays??5)+1)*86400000))
 ]);
 const byStatus: Partial<Record<OrderStatus,number>> = {}, byPriority: Record<number,number> = {};
 let total=0;
 for(const row of groups){byStatus[row.status]=(byStatus[row.status]||0)+row._count;byPriority[row.priority]=(byPriority[row.priority]||0)+row._count;total+=row._count;}
 res.json({byStatus,byPriority,total,overdue,recent:recent.map(o=>({...o,...aging(o,settings,now)})),attention:attention.map(o=>({...o,...aging(o,settings,now)})),workload:assignees.items.filter(u=>u.total>0)});
}));

app.get('/api/reports/workload', auth, manager, asyncRoute(async (req,res)=>{
 res.json(await workload(prisma,req.query,req.user!,true));
}));
const settingsInput=z.object({greenDays:z.number().int().min(0),yellowDays:z.number().int().min(1),orangeDays:z.number().int().min(2)}).refine(x=>x.greenDays<x.yellowDays&&x.yellowDays<x.orangeDays,'Thresholds must increase');
app.get('/api/settings/aging',auth,asyncRoute(async(_,res)=>res.json(await prisma.agingSettings.findUnique({where:{id:1}})||{greenDays:1,yellowDays:3,orangeDays:5})));
app.put('/api/settings/aging',auth,admin,asyncRoute(async(req,res)=>{const data=settingsInput.parse(req.body);res.json(await prisma.agingSettings.upsert({where:{id:1},create:{id:1,...data},update:data}));}));
const userInput=z.object({name:z.string().trim().min(1),email:emailInput,role:z.nativeEnum(Role),password:z.string().min(10),active:z.boolean().default(true)});
app.get('/api/admin/users',auth,admin,asyncRoute(async(_,res)=>res.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,active:true},orderBy:{name:'asc'}}))));
app.post('/api/users',auth,admin,asyncRoute(async(req,res)=>{const {password,...data}=userInput.parse(req.body);const user=await prisma.user.create({data:{...data,passwordHash:await bcrypt.hash(password,10)},select:{id:true,name:true,email:true,role:true,active:true}});res.status(201).json(user);}));
app.patch('/api/users/:id',auth,admin,asyncRoute(async(req,res)=>{
 const {password,...data}=userInput.partial().parse(req.body);
 if(param(req,'id')===req.user!.id && (data.active===false || (data.role && data.role!=='ADMIN'))) return fail(res,400,'You cannot remove your own admin access');
 res.json(await prisma.user.update({where:{id:param(req,'id')},data:{...data,...(password?{passwordHash:await bcrypt.hash(password,10)}:{})},select:{id:true,name:true,email:true,role:true,active:true}}));
}));

app.use((err: unknown, _: Request, res: Response, __: NextFunction) => { if (err instanceof z.ZodError) return fail(res, 400, err.issues.map(x => x.message).join('; '));
 if (err instanceof Prisma.PrismaClientInitializationError) return fail(res,503,'Service temporarily unavailable');
 if (err instanceof Prisma.PrismaClientKnownRequestError) { if(['P1001','P1002','P1017','P2024'].includes(err.code)) return fail(res,503,'Service temporarily unavailable'); if(err.code==='P2021' || err.code==='P2022') return fail(res,503,'Service temporarily unavailable'); if(err.code==='P2025') return fail(res,404,'Record not found'); if(err.code==='P2002') return fail(res,409,'Record already exists'); }
 if ((err as {type?:string})?.type === 'entity.too.large') return fail(res,413,'Request is too large');
 if (err instanceof SyntaxError) return fail(res,400,'Invalid JSON request');
 console.error('API request failed', {name:err instanceof Error ? err.name : 'UnknownError',code:err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined});
 return fail(res, 500, 'Unexpected server error');
 });

export default app;
