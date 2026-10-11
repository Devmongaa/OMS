import { OrderStatus } from '@prisma/client';

export const WORKFLOW: OrderStatus[] = [
  'ORDER_RECEIVED', 'DESIGNING', 'CUTTING_AND_PRINTING', 'MAKING', 'PACKING_AND_DISPATCH', 'COMPLETED',
];

export function canTransition(from: OrderStatus, to: OrderStatus, isAdmin: boolean) {
  if (['NEW','ASSIGNED','IN_PROGRESS','PENDING','CANCELLED'].includes(from) || ['NEW','ASSIGNED','IN_PROGRESS','PENDING','CANCELLED'].includes(to)) {
    if(isAdmin) return from !== to;
    return !['COMPLETED','CANCELLED'].includes(from) && from!==to && ['IN_PROGRESS','PENDING','COMPLETED'].includes(to);
  }
  return isAdmin ? from !== to : WORKFLOW.indexOf(to) === WORKFLOW.indexOf(from) + 1;
}
