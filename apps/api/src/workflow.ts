import { OrderStatus } from '@prisma/client';

export const WORKFLOW: OrderStatus[] = [
  'ORDER_RECEIVED', 'DESIGNING', 'CUTTING_AND_PRINTING', 'MAKING', 'PACKING_AND_DISPATCH', 'COMPLETED',
];

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from !== to;
}
