import { OrderStatus } from '@prisma/client';

export const WORKFLOW: OrderStatus[] = [
  'ORDER_RECEIVED', 'DESIGNING', 'CUTTING_AND_PRINTING', 'MAKING', 'PACKING_AND_DISPATCH', 'COMPLETED',
];

export function canTransition(from: OrderStatus, to: OrderStatus) {
  // ASSIGNED remains in the enum solely to preserve existing history.
  return to !== 'ASSIGNED' && from !== to;
}
