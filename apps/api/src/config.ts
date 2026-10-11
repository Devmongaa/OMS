export function configuration(env:NodeJS.ProcessEnv) {
 const production=env.NODE_ENV==='production';
 if(!env.DATABASE_URL)throw new Error('DATABASE_URL is required');
 const url=new URL(env.DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL must use PostgreSQL');
 for(const [key,value] of Object.entries({connection_limit:'2',pool_timeout:'10',connect_timeout:'10',socket_timeout:'20',max_idle_connection_lifetime:'60'})) {
  if(!url.searchParams.has(key))url.searchParams.set(key,value);
 }
 const secret=env.JWT_SECRET || (production?'':'development-only-secret');
 if(production&&(secret.length<32 || secret==='development-only-secret'))throw new Error('JWT_SECRET must contain at least 32 characters');
 const frontendUrl=env.FRONTEND_URL || (production?'':'http://localhost:5173');
 if(!frontendUrl || !['http:','https:'].includes(new URL(frontendUrl).protocol) || new URL(frontendUrl).origin!==frontendUrl)throw new Error('FRONTEND_URL must be an origin without a trailing slash');
 const port=Number(env.PORT||4000);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT is invalid');
 return {databaseUrl:url.toString(),secret,frontendUrl,port};
}
