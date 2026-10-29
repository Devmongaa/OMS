import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '@prisma/client';
import { canTransition } from './workflow.js';

test('active statuses allow reopening; retired Assigned and no-op changes are rejected', () => {
  for (const from of Object.values(OrderStatus)) {
    for (const to of Object.values(OrderStatus)) {
      assert.equal(canTransition(from, to), to !== 'ASSIGNED' && from !== to, from + ' -> ' + to);
    }
  }
});
