export type Status = 'NEW'|'ASSIGNED'|'IN_PROGRESS'|'PENDING'|'CANCELLED'|'ORDER_RECEIVED'|'DESIGNING'|'CUTTING_AND_PRINTING'|'MAKING'|'PACKING_AND_DISPATCH'|'COMPLETED';
export type User = { id:string; name:string; email:string; active?:boolean; role:'ADMIN'|'MANAGER'|'EMPLOYEE' };
export type Order = { id:string; serialNumber:number; orderType:string; ageDays:number; ageColor:string|null; orderNumber:string; customerName:string; customerEmail?:string; customerPhone?:string; description:string; quantity:number; dueDate?:string; priority:number; status:Status; createdAt:string; updatedAt:string; assignments:{user:User;assignedAt:string}[]; shipment?:{carrier?:string;trackingNumber?:string}; statusHistory?:{id:string;fromStatus?:Status;toStatus:Status;note?:string;createdAt:string;changedBy:{name:string}}[]; files?:{id:string;name:string;url:string;kind:string}[] };
export const STATUS_LABEL: Record<Status,string> = { NEW:'New', ASSIGNED:'Assigned', IN_PROGRESS:'In progress', PENDING:'Pending', CANCELLED:'Cancelled', ORDER_RECEIVED:'Order received', DESIGNING:'Designing', CUTTING_AND_PRINTING:'Cutting & printing', MAKING:'Making', PACKING_AND_DISPATCH:'Packing & dispatch', COMPLETED:'Completed' };
export const FLOW: Status[] = ['ORDER_RECEIVED','DESIGNING','CUTTING_AND_PRINTING','MAKING','PACKING_AND_DISPATCH','COMPLETED'];

// Keep the legacy label for historical events; never offer it as a current status.
export const STATUSES=(Object.keys(STATUS_LABEL) as Status[]).filter(status=>status!=='ASSIGNED');
export const PRIORITIES=['Low','Medium','High','Urgent'];
