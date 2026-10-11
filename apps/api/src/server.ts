import 'dotenv/config';
import app, {prisma} from './app.js';
import {configuration} from './config.js';
const config=configuration(process.env);
const server=app.listen(config.port,()=>console.info(`OMS API listening on ${config.port}`));
server.requestTimeout=60000;
server.headersTimeout=15000;
let stopping=false;
function shutdown(){
 if(stopping)return;
 stopping=true;
 const deadline=setTimeout(()=>process.exit(1),10000);
 deadline.unref();
 server.close(()=>{prisma.$disconnect().then(()=>{clearTimeout(deadline);process.exit(0);}).catch(()=>process.exit(1));});
}
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
