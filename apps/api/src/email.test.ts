import test from 'node:test';
import assert from 'node:assert/strict';
import { emailInput } from './email.js';

test('email input normalizes casing and whitespace before queries and writes', () => {
  assert.equal(emailInput.parse('  User.Name@EXAMPLE.COM  '), 'user.name@example.com');
  assert.equal(emailInput.parse('user.name@example.com'), 'user.name@example.com');
  assert.throws(() => emailInput.parse('not an email'));
  assert.throws(() => emailInput.parse('   '));
  assert.equal(emailInput.optional().parse(undefined), undefined);
});
