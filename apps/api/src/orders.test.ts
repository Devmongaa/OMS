import test from 'node:test';
import assert from 'node:assert/strict';
import {aging,orderFilter,orderSort} from './orders.js';
test('aging boundaries and terminal exclusions',()=>{
 const now=new Date('2026-10-10T12:00:00Z');
 for(const [days,color] of [[0,'green'],[1,'green'],[2,'yellow'],[3,'yellow'],[4,'orange'],[5,'orange'],[6,'red']] as const){
  const createdAt=new Date(+now-days*86400000);
  assert.equal(aging({createdAt,status:'PENDING'},null,now).ageColor,color);
  for(const status of ['COMPLETED','CANCELLED'] as const)assert.equal(aging({createdAt,status},null,now).ageColor,null);
 }
 assert.equal(aging({createdAt:new Date(+now-2*86400000),status:'NEW'},{greenDays:2,yellowDays:4,orangeDays:8},now).ageColor,'green');
});
test('all roles see all orders unless explicitly filtering an assignee',()=>{
 for (const role of ['ADMIN','MANAGER','EMPLOYEE'] as const) {
  assert.deepEqual(orderFilter({},{id:'viewer',role}).AND,[]);
  assert.deepEqual(orderFilter({assigneeId:'other'},{id:'viewer',role}).AND,[{assignments:{some:{userId:'other'}}}]);
 }
});
test('filters retain low priority and inclusive end date, rejecting invalid values',()=>{
 const f=orderFilter({priority:'0',from:'2026-10-01',to:'2026-10-05'},{id:'a',role:'ADMIN'});
 assert.equal(f.priority,0);assert.deepEqual(f.createdAt,{gte:new Date('2026-10-01'),lt:new Date('2026-10-06')});
 for(const q of [{priority:'9'},{status:'oops'},{from:'2026-10-10',to:'2026-10-01'}])assert.throws(()=>orderFilter(q,{id:'a',role:'ADMIN'}));
});
test('age sort reverses creation order and has stable tie breaker',()=>{
 assert.deepEqual(orderSort({sort:'age',direction:'desc'}),[{createdAt:'asc'},{serialNumber:'asc'}]);
 assert.throws(()=>orderSort({sort:'passwordHash'}));
});
