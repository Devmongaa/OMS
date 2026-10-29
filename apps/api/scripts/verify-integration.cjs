// Run only against a disposable database after applying migrations.
const assert = require('node:assert/strict');
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  assert.equal(process.env.OMS_TEST_DATABASE, '1', 'Set OMS_TEST_DATABASE=1 for a disposable database');
  const app = require('../dist/app.js').default;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const password = 'Integration123!';
  const suffix = Date.now();
  const users = {};
  async function request(path, token, method='GET', body, expected=200) {
    const response = await fetch(base+path, {method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data = response.status===204?null:await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    await prisma.agingSettings.upsert({where:{id:1},create:{id:1,greenDays:1,yellowDays:3,orangeDays:5},update:{greenDays:1,yellowDays:3,orangeDays:5}});
    for (const [key,role] of Object.entries({admin:'ADMIN',manager:'MANAGER',staff:'EMPLOYEE',other:'EMPLOYEE'})) {
      const user=await prisma.user.create({data:{name:key,email:`${key}-${suffix}@example.test`,role,passwordHash:await bcrypt.hash(password,4)}});
      users[key]={...user,token:(await request('/auth/login',null,'POST',{email:' '+user.email.toUpperCase()+' ',password})).token};
    }
    const a=users.admin.token,m=users.manager.token,s=users.staff.token;
    const account=await request('/users',a,'POST',{name:'Email normalization',email:` Mixed-${suffix}@Example.Test `,password,role:'EMPLOYEE'},201);
    assert.equal(account.email,`mixed-${suffix}@example.test`);
    await request('/users',a,'POST',{name:'Duplicate',email:`MIXED-${suffix}@EXAMPLE.TEST`,password,role:'EMPLOYEE'},409);
    const renamed=await request('/users/'+account.id,a,'PATCH',{email:` RENAMED-${suffix}@Example.Test `});
    assert.equal(renamed.email,`renamed-${suffix}@example.test`);
    await request('/auth/login',null,'POST',{email:`RENAMED-${suffix}@EXAMPLE.TEST`,password});

    const body={customerName:'Integration',description:'Permission and workload checks',priority:3,orderType:`Test-${suffix}`,customerEmail:'clear@example.test',dueDate:'2026-12-01T00:00:00Z'};
    await request('/orders',null,'POST',body,401);
    for(const token of [s,m]){
      const created=await request('/orders',token,'POST',body,201);
      assert.equal((await request('/orders/'+created.id,token)).id,created.id);
      if(token===s)assert.equal(created.assignments[0].user.id,users.staff.id);
      assert.equal((await request('/orders/'+created.id,users.other.token)).id,created.id);
      assert.equal((await request('/orders/'+created.id,token,'PATCH',{customerName:'Edited'})).customerName,'Edited');
      await request('/orders/'+created.id,token,'DELETE',undefined,403);
      await request('/orders/'+created.id,a,'DELETE',undefined,204);
    }
    const order=await request('/orders',a,'POST',body,201);
    assert.equal(order.status,'NEW');assert.ok(order.serialNumber>0);
    assert.equal((await request('/orders?orderType='+body.orderType,s)).total,1);
    await request('/orders/'+order.id,s,'PATCH',{customerName:'Denied'},403);
    await request('/orders/'+order.id+'/status',s,'POST',{status:'PENDING'});
    await request('/orders/'+order.id+'/assignments',s,'POST',{userId:users.staff.id},409);
    await request('/orders/'+order.id+'/files',s,'POST',{name:'Denied',url:'https://example.test/file'},403);
    await request('/orders/'+order.id+'/shipments',s,'POST',{carrier:'Denied'},403);
    assert.equal((await request('/orders/'+order.id,s)).id,order.id);
    assert.equal((await request('/orders/'+order.id,m,'PATCH',{customerName:'Manager edited'})).customerName,'Manager edited');
    let updated=await request('/orders/'+order.id,a,'PATCH',{customerEmail:'',dueDate:null});
    assert.equal(updated.customerEmail,null);assert.equal(updated.dueDate,null);
    for (const token of [a,m,s,users.other.token]) {
      const candidates=await request('/users',token);
      assert.ok(candidates.some(u=>u.id===users.staff.id));
      assert.ok(candidates.every(u=>!('passwordHash' in u)));
      await request('/orders/'+order.id+'/status',token,'POST',{status:'MAKING'});
      const assigned=await request('/orders/'+order.id+'/assignments',token,'POST',{userId:users.other.id});
      assert.equal(assigned.assignments.length,1);
      assert.equal(assigned.assignments[0].user.id,users.other.id);
      await request('/orders/'+order.id+'/status',token,'POST',{status:'PENDING'});
      await request('/orders/'+order.id+'/assignments',token,'POST',{userId:users.staff.id},409);
    }
    await request('/orders/'+order.id+'/status',s,'POST',{status:'MAKING'});
    await request('/orders/'+order.id+'/status',s,'POST',{status:'MAKING'},409);
    await request('/orders/'+order.id+'/status',s,'POST',{status:'INVALID'},400);
    await request('/orders/'+order.id+'/status',null,'POST',{status:'PENDING'},401);
    await request('/orders/'+order.id+'/assignments',null,'POST',{userId:users.staff.id},401);
    updated=await request('/orders/'+order.id+'/assignments',s,'POST',{userId:users.staff.id});
    assert.equal(updated.status,'MAKING');assert.equal(updated.assignments.length,1);assert.ok(updated.assignments[0].assignedAt);
    assert.equal((await request('/orders',s)).total,1);
    assert.equal((await request('/orders?assigneeId='+users.other.id,s)).total,0);
    await request('/orders/'+order.id,s,'PATCH',{priority:3});
    await request('/orders/'+order.id,users.other.token,'PATCH',{priority:0},403);
    await request('/orders/'+order.id+'/status',s,'POST',{status:'PENDING'});
    await request('/reports/workload',s,'GET',undefined,403);
    const report=await request('/reports/workload?assigneeId='+users.staff.id+'&orderType='+body.orderType,m);
    assert.equal(report.items[0].total,1);assert.equal(report.items[0].pending,1);assert.equal(report.items[0].highPriority,1);
    await prisma.order.update({where:{id:order.id},data:{createdAt:new Date(Date.now()-7*86400000)}});
    assert.equal((await request('/orders/'+order.id,s)).ageColor,'red');
    await request('/settings/aging',m,'PUT',{greenDays:7,yellowDays:8,orangeDays:9},403);
    await request('/settings/aging',a,'PUT',{greenDays:7,yellowDays:8,orangeDays:9});
    assert.equal((await request('/orders/'+order.id,s)).ageColor,'green');
    await request('/settings/aging',a,'PUT',{greenDays:4,yellowDays:2,orangeDays:1},400);
    await request('/orders/'+order.id+'/status',s,'POST',{status:'COMPLETED'});
    assert.equal((await request('/orders/'+order.id,s)).ageColor,null);
    await request('/orders/'+order.id+'/status',s,'POST',{status:'IN_PROGRESS'});
    await request('/orders/'+order.id+'/status',users.other.token,'POST',{status:'MAKING'});
    await request('/orders/'+order.id+'/assignments',users.other.token,'POST',{userId:users.other.id});
    assert.equal((await request('/orders/'+order.id,s)).id,order.id);
    await request('/orders/'+order.id,s,'PATCH',{customerName:'Denied'},403);
    await request('/admin/users',m,'GET',undefined,403);
    await request('/users/'+users.admin.id,a,'PATCH',{role:'EMPLOYEE'},400);
    await request('/users/'+users.manager.id,a,'PATCH',{role:'EMPLOYEE'});
    await request('/reports/workload',m,'GET',undefined,403);
    await request('/users/'+users.other.id,a,'PATCH',{active:false});
    await request('/orders',users.other.token,'GET',undefined,401);
    await request('/orders/'+order.id+'/status',users.other.token,'POST',{status:'PENDING'},401);
    await request('/orders/'+order.id+'/assignments',users.other.token,'POST',{userId:users.staff.id},401);
    await prisma.order.update({where:{id:order.id},data:{status:'PENDING',createdAt:new Date(Date.now()-11*86400000)}});
    const aged=await request('/reports/workload?assigneeId='+users.other.id+'&orderType='+body.orderType,a);
    assert.equal(aged.items[0].overdue,1);
    await prisma.order.update({where:{id:order.id},data:{status:'COMPLETED'}});
    const dashboard=await request('/dashboard',a);
    assert.ok(dashboard.total>=1);assert.ok(dashboard.recent.length<=6);assert.ok(dashboard.attention.length<=4);
    assert.equal(dashboard.recent.some(o=>'description' in o || 'files' in o || 'shipment' in o),false);
    const shared=await request('/dashboard',s);assert.equal(shared.total,dashboard.total);assert.deepEqual(shared.byStatus,dashboard.byStatus);assert.deepEqual(shared.workload,dashboard.workload);
    const page=await request('/reports/workload?limit=1&page=1',a);
    assert.equal(page.items.length,1);assert.ok(page.total>=4);assert.ok(page.summary.total>=1);
    const emptyPage=await request('/reports/workload?page=999',a);assert.equal(emptyPage.items.length,0);assert.equal(emptyPage.summary.total,page.summary.total);
    const filtered=await request('/reports/workload?orderType='+body.orderType+'&status=COMPLETED&priority=3',a);
    assert.equal(filtered.summary.total,1);assert.equal(filtered.summary.completed,1);
    assert.equal((await request('/reports/workload?from=2099-01-01',a)).summary.total,0);
    assert.equal((await request('/orders?limit=1000',a)).limit,100);
    await request('/orders/'+order.id+'/files',a,'POST',{name:'invalid',url:'data:image/png;base64,abc'},400);
    await request('/orders/'+order.id,a,'DELETE',undefined,204);
    assert.equal((await request('/health')).status,'ok');
    console.log('PASS: shared order visibility, API permissions, role refresh, assignment, reports, aging, optional-field clearing and deletion');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
