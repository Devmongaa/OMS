import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StaticRouter} from 'react-router-dom';
import {AgeBadge,OrderTable,ErrorState,Loading} from './ui';
import {Layout} from './shell';
import {Order,User} from './types';
const user:User={id:'staff',name:'Test Staff',email:'staff@example.test',role:'EMPLOYEE'};
const order:Order={id:'one',orderNumber:'OMS-123',serialNumber:123,customerName:'A & B <script>',orderType:'Print',description:'Brief',quantity:1,status:'PENDING',priority:3,createdAt:'2026-10-21T12:00:00Z',updatedAt:'2026-10-29T12:00:00Z',ageDays:8,ageColor:'red',assignments:[{user,assignedAt:'2026-10-21T12:00:00Z'}]};
const render=(element:React.ReactNode)=>renderToStaticMarkup(<StaticRouter location="/orders">{element}</StaticRouter>);
describe('order presentation regressions',()=>{
 it('uses API-provided aging without recalculating thresholds',()=>{
  expect(render(<AgeBadge order={order}/>)).toContain('8d · Overdue');
  expect(render(<AgeBadge order={{...order,ageDays:99,ageColor:'green'}}/>)).toContain('99d · Recent');
  for(const status of ['COMPLETED','CANCELLED'] as const){const html=render(<AgeBadge order={{...order,status,ageColor:null}}/>);expect(html).toContain('Closed');expect(html).not.toContain('Overdue');}
 });
 it('keeps order identity, assignment and actions in both responsive presentations',()=>{
  const html=render(<OrderTable orders={[order]}/>);
  for(const label of ['OMS-123','Test Staff','Urgent','Pending','SLA / Age','desktop-orders','mobile-orders'])expect(html).toContain(label);
  expect(html).toContain('/orders/one');expect(html).toContain('A &amp; B &lt;script&gt;');expect(html).not.toContain('<script>');
 });
 it('preserves the create action in the empty order view',()=>{expect(render(<OrderTable orders={[]} create/>)).toContain('/orders/new')});
 it('exposes loading and error states to assistive technology',()=>{
  expect(render(<Loading label="Loading orders"/>)).toContain('role="status"');
  const html=render(<ErrorState message="Connection unavailable" retry={()=>{}}/>);
  expect(html).toContain('role="alert"');expect(html).toContain('Try again');
 });
 it('retains role-based navigation',()=>{
  const staff=render(<Layout user={user} onLogout={()=>{}}>Content</Layout>);
  expect(staff).toContain('href="/orders/new"');expect(staff).not.toContain('href="/reports"');expect(staff).not.toContain('href="/admin"');
  const manager=render(<Layout user={{...user,role:'MANAGER'}} onLogout={()=>{}}>Content</Layout>);
  expect(manager).toContain('href="/reports"');expect(manager).not.toContain('href="/admin"');
  const admin=render(<Layout user={{...user,role:'ADMIN'}} onLogout={()=>{}}>Content</Layout>);
  expect(admin).toContain('href="/admin"');expect(admin).toContain('href="/admin#settings"');
 });
});
