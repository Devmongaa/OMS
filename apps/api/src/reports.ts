import {Prisma, PrismaClient, Role} from '@prisma/client';
import {filters, orderFilter} from './orders.js';
export type Workload = {id:string;name:string;total:number;new:number;assigned:number;inProgress:number;pending:number;completed:number;cancelled:number;highPriority:number;overdue:number};
export async function workload(prisma:PrismaClient, query:Record<string,unknown>, user:{id:string;role:Role}, paginate:boolean, overdueBefore?:Date) {
 if(!overdueBefore){const settings=await prisma.agingSettings.findUnique({where:{id:1}});overdueBefore=new Date(Date.now()-((settings?.orangeDays??5)+1)*86400000);}
 // Share validation and date semantics with the order directory.
 const where = orderFilter(query,user);
 const f=filters.parse(Object.fromEntries(Object.entries(query).filter(([,v])=>v!=='')));
 const conditions:Prisma.Sql[]=[Prisma.sql`TRUE`];
 if(f.status)conditions.push(Prisma.sql`o.status = ${f.status}::"OrderStatus"`);
 if(f.priority!==undefined)conditions.push(Prisma.sql`o.priority = ${f.priority}`);
 if(f.orderType)conditions.push(Prisma.sql`o."orderType" = ${f.orderType}`);
 const dates=where.createdAt as Prisma.DateTimeFilter;
 if(dates.gte)conditions.push(Prisma.sql`o."createdAt" >= ${dates.gte}`);
 if(dates.lt)conditions.push(Prisma.sql`o."createdAt" < ${dates.lt}`);
 if(f.q){const pattern=`%${f.q}%`;conditions.push(Prisma.sql`(o."orderNumber" ILIKE ${pattern} OR o."customerName" ILIKE ${pattern} OR o.description ILIKE ${pattern})`);}
 for(const id of [user.role==='EMPLOYEE'?user.id:undefined,f.assigneeId])if(id)conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "OrderAssignment" scope WHERE scope."orderId"=o.id AND scope."userId"=${id})`);
 const number=(v:unknown,d:number)=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):d;
 const page=number(query.page,1),limit=Math.min(number(query.limit,20),100);
 const result=await prisma.$queryRaw<{items:Workload[];total:number;summary:{total:number;pending:number;completed:number}}[]>(Prisma.sql`
 WITH counts AS (
 SELECT a."userId", count(*)::int AS total,
 count(*) FILTER (WHERE o.status IN ('NEW','ORDER_RECEIVED'))::int AS new,
 count(*) FILTER (WHERE o.status='ASSIGNED')::int AS assigned,
 count(*) FILTER (WHERE o.status IN ('IN_PROGRESS','DESIGNING','CUTTING_AND_PRINTING','MAKING','PACKING_AND_DISPATCH'))::int AS "inProgress",
 count(*) FILTER (WHERE o.status='PENDING')::int AS pending,
 count(*) FILTER (WHERE o.status='COMPLETED')::int AS completed,
 count(*) FILTER (WHERE o.status='CANCELLED')::int AS cancelled,
 count(*) FILTER (WHERE o.status NOT IN ('COMPLETED','CANCELLED') AND o."createdAt" <= ${overdueBefore})::int AS overdue,
 count(*) FILTER (WHERE o.priority>=2)::int AS "highPriority"
 FROM "Order" o JOIN "OrderAssignment" a ON a."orderId"=o.id
 WHERE ${Prisma.join(conditions,' AND ')} GROUP BY a."userId"
 ), rows AS (
 SELECT u.id,u.name,coalesce(c.total,0) AS total,coalesce(c.new,0) AS new,
 coalesce(c.assigned,0) AS assigned,coalesce(c."inProgress",0) AS "inProgress",
 coalesce(c.pending,0) AS pending,coalesce(c.completed,0) AS completed,
 coalesce(c.cancelled,0) AS cancelled,coalesce(c.overdue,0) AS overdue,coalesce(c."highPriority",0) AS "highPriority"
 FROM "User" u LEFT JOIN counts c ON c."userId"=u.id
 WHERE ${f.assigneeId?Prisma.sql`u.id=${f.assigneeId}`:Prisma.sql`TRUE`}
 ), page_rows AS (SELECT * FROM rows ORDER BY name,id ${paginate?Prisma.sql`LIMIT ${limit} OFFSET ${(page-1)*limit}`:Prisma.empty})
 SELECT coalesce((SELECT json_agg(page_rows) FROM page_rows),'[]'::json) AS items,
 (SELECT count(*)::int FROM rows) AS total,
 (SELECT json_build_object('total',coalesce(sum(total),0),'pending',coalesce(sum(pending),0),'completed',coalesce(sum(completed),0)) FROM rows) AS summary
 `);
 return {...result[0],page,limit};
}
