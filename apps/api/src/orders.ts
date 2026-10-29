import { OrderStatus, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
export const filters = z.object({
 q:z.string().optional(), status:z.nativeEnum(OrderStatus).optional(), assigneeId:z.string().optional(),
 priority:z.coerce.number().int().min(0).max(3).optional(), orderType:z.string().optional(),
 from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
export function orderFilter(query:object,_user:{id:string;role:Role}):Prisma.OrderWhereInput {
 const f=filters.parse(Object.fromEntries(Object.entries(query).filter(([,v])=>v!=='')));
 const from=f.from?new Date(f.from):undefined, to=f.to?new Date(f.to):undefined;
 if ((from && !Number.isFinite(+from)) || (to && !Number.isFinite(+to)) || (from && to && from>to)) throw new z.ZodError([{code:'custom',path:['from'],message:'Invalid date range'}]);
 if(to)to.setUTCDate(to.getUTCDate()+1);
 return {status:f.status,priority:f.priority,orderType:f.orderType,createdAt:{gte:from,lt:to},AND:[
 ...(f.assigneeId?[{assignments:{some:{userId:f.assigneeId}}}]:[])
 ],...(f.q?{OR:['orderNumber','customerName','description'].map(key=>({[key]:{contains:f.q,mode:'insensitive'}}))}:{})};
}
export function orderSort(query:Record<string,unknown>):Prisma.OrderOrderByWithRelationInput[] {
 const {sort,direction}=z.object({sort:z.enum(['serialNumber','createdAt','priority','status','age']).default('createdAt'),direction:z.enum(['asc','desc']).default('desc')}).parse(query);
 return [{[sort==='age'?'createdAt':sort]:sort==='age'?(direction==='asc'?'desc':'asc'):direction},{serialNumber:'asc'}];
}
export function aging(order:{createdAt:Date;status:OrderStatus},settings:{greenDays:number;yellowDays:number;orangeDays:number}|null,now=new Date()) {
 const ageDays=Math.max(0,Math.floor((+now-+order.createdAt)/86400000));
 const s=settings||{greenDays:1,yellowDays:3,orangeDays:5};
 const ageColor=['COMPLETED','CANCELLED'].includes(order.status)?null:ageDays<=s.greenDays?'green':ageDays<=s.yellowDays?'yellow':ageDays<=s.orangeDays?'orange':'red';
 return {ageDays,ageColor};
}
