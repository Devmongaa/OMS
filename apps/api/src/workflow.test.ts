import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from './workflow.js';

test('employees can advance exactly one stage', () => {
  assert.equal(canTransition('ORDER_RECEIVED', 'DESIGNING', false), true);
  assert.equal(canTransition('ORDER_RECEIVED', 'MAKING', false), false);
  assert.equal(canTransition('MAKING', 'DESIGNING', false), false);
});
