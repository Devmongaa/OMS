import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration} from './config.js';
const env={DATABASE_URL:'postgresql://user:pass@localhost/db',NODE_ENV:'production',JWT_SECRET:'a'.repeat(40),FRONTEND_URL:'https://frontend.example'};
test('production requires explicit credentials and allowed frontend origin',()=>{
 for(const patch of [{DATABASE_URL:''},{JWT_SECRET:''},{FRONTEND_URL:''},{FRONTEND_URL:'*'},{PORT:'-1'}])assert.throws(()=>configuration({...env,...patch}));
 assert.equal(configuration(env).frontendUrl,env.FRONTEND_URL);
});
test('small pool defaults preserve provider connection options and explicit overrides',()=>{
 const url=new URL(configuration({...env,DATABASE_URL:env.DATABASE_URL+'?sslmode=require&connection_limit=1'}).databaseUrl);
 assert.equal(url.searchParams.get('connection_limit'),'1');assert.equal(url.searchParams.get('sslmode'),'require');
 assert.equal(url.searchParams.get('pool_timeout'),'10');assert.equal(url.searchParams.get('socket_timeout'),'20');assert.equal(url.searchParams.get('max_idle_connection_lifetime'),'60');
});
