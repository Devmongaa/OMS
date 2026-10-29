import React,{FormEvent,useEffect,useState,lazy,Suspense}from'react';
import{createRoot}from'react-dom/client';
import{BrowserRouter,Link,Navigate,Route,Routes,useNavigate,useParams}from'react-router-dom';
import{api}from'./api';
import{FLOW,Order,STATUS_LABEL,STATUSES,PRIORITIES,Status,User}from'./types';
import'./styles.css';
import './responsive.css';
const OrderDirectory=lazy(()=>import('./operations').then(m=>({default:m.OrderDirectory})));
const Administration=lazy(()=>import('./operations').then(m=>({default:m.Administration})));
import {Layout} from './shell';
const Dashboard=lazy(()=>import('./dashboard').then(m=>({default:m.Dashboard})));
import {Loading,StatusBadge as Badge,PageHead as Head,PriorityBadge,AgeBadge,Icon,ConfirmDialog,ErrorState} from './ui';

const fmt=(v?:string)=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';

function Mark(){return <span className="brand-symbol"><Icon name="box" size={22}/></span>}
function Login({onLogin}:{onLogin:(u:User)=>void}){const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[sending,setSending]=useState(false);
const nav=useNavigate();
async function submit(e:FormEvent){e.preventDefault();
setSending(true);
setError('');
try{const{data}=await api.post('/auth/login',{email,password});
localStorage.setItem('oms_token',data.token);
onLogin(data.user);
nav('/')}catch{setError('Unable to sign in. Check your credentials and try again.')}finally{setSending(false)}}return <div className="login">
<aside>
<div className="login-brand">
<Mark/>Makkar and Brother OMS</div>
<div>
<span className="eyebrow light">OPERATIONS, SIMPLIFIED</span>
<h1>Less chasing.<br/>More progress.</h1>
<p>From the first request to the final delivery. Give your team a clear view of what matters, every day.</p>
</div>
<small>ORDERS · PEOPLE · PROGRESS</small>
</aside>
<section>
<form onSubmit={submit}>
<div>
<span className="eyebrow">WELCOME BACK</span>
<h2>Sign in to your workspace</h2>
<p>Enter your details to continue managing orders.</p>
</div>{error&&<div className="error" role="alert">{error}</div>}<label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>
</label>
<div className="login-password"><label htmlFor="login-password">Password</label><div className="password-input-wrap"><input id="login-password" required type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/><button type="button" className="password-toggle" aria-label={showPassword?'Hide password':'Show password'} aria-controls="login-password" onClick={()=>setShowPassword(visible=>!visible)}>{showPassword?'Hide':'Show'}</button></div></div>
<button disabled={sending}>{sending?'Signing in…':'Sign in to Makkar and Brother OMS'} →</button>
<small className="secure"><Icon name="check" size={14}/> Your team’s order management workspace</small>
</form>
</section>
</div>}
function NewOrder(){const nav=useNavigate();
const[error,setError]=useState(''),[creating,setCreating]=useState(false);
async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();
setCreating(true);
setError('');
const f=new FormData(e.currentTarget);
try{const{data}=await api.post('/orders',{customerName:f.get('customerName'),customerEmail:f.get('customerEmail')||undefined,description:f.get('description'),quantity:Number(f.get('quantity')),orderType:f.get('orderType'),priority:Number(f.get('priority'))});
nav('/orders/'+data.id)}catch{setError('Unable to create the order. Check the required fields and try again.')}finally{setCreating(false)}}return <>
<Head eyebrow="NEW ORDER" title="Create an order" description="Add customer information and production requirements."/>
<div className="create-layout"><section className="form-card">
<form onSubmit={submit}>
<div>
<div className="form-section-head"><span className="section-number">01</span><div><h2>Customer details</h2><p>Who are we creating this order for?</p></div></div>
<div className="grid">
<label>Customer name <span className="required">*</span><input name="customerName" placeholder="e.g. Northstar Studio" required/>
</label>
<label>Email address <small>Optional</small>
<input name="customerEmail" type="email" placeholder="name@company.com"/>
</label>
</div>
</div>
<div>
<div className="form-section-head"><span className="section-number">02</span><div><h2>Order requirements</h2><p>Give your team the details they need to get started.</p></div></div>
<label>Production brief <span className="required">*</span><textarea name="description" placeholder="Describe the product, finish, artwork, and any special instructions…" required/>
</label>
<div className="grid small">
<label>Quantity<input name="quantity" type="number" min="1" defaultValue="1"/>
</label>
<label>Order type<input name="orderType" defaultValue="General" required/></label><label>Priority<select name="priority" defaultValue="1">
{PRIORITIES.map((p,i)=><option key={p} value={i}>{p}</option>)}
</select>
</label>
</div>
</div>{error&&<div className="error" role="alert">{error}</div>}<div className="actions">
<Link to="/orders">Cancel</Link>
<button disabled={creating}>{creating?<><span className="button-spinner"/>Creating order…</>:'Create order'}</button>
</div>
</form>
</section><aside className="form-aside"><div className="card pad"><span className="aside-icon"><Icon name="box" size={24}/></span><h3>Order checklist</h3><p>Include dimensions, materials, artwork, and delivery requirements in the production brief.</p><hr/><div className="aside-step"><Icon name="check"/><span>A unique order ID is generated automatically.</span></div><div className="aside-step"><Icon name="users"/><span>Assign a team member when the order reaches Making.</span></div><div className="aside-step"><Icon name="clock"/><span>New orders start with the New status.</span></div></div></aside></div>
</>}
function Detail({user}:{user:User}){const{id=''}=useParams();
const[confirmDelete,setConfirmDelete]=useState(false),[deleting,setDeleting]=useState(false),[assigning,setAssigning]=useState(false),[assignee,setAssignee]=useState(''),[success,setSuccess]=useState('');
const[order,setOrder]=useState<Order|null>(null),[users,setUsers]=useState<User[]>([]),[note,setNote]=useState(''),[saving,setSaving]=useState(false),[editing,setEditing]=useState(false),[error,setError]=useState('');
const load=()=>api.get('/orders/'+id).then(r=>setOrder(r.data));
useEffect(()=>{load().catch(()=>setError('Unable to load this order or access denied.'));
api.get('/users').then(r=>setUsers(r.data)).catch(()=>setError('Unable to load assignment candidates.'))},[id]);
if(!order&&error)return <ErrorState message={error} retry={()=>load().catch(()=>setError('Unable to load this order.'))}/>;
if(!order)return <Loading label="Loading order…"/>;
const flow:Status[]=FLOW.includes(order.status)?FLOW:['NEW','ASSIGNED','IN_PROGRESS','COMPLETED'];
const assigned=order.assignments.some(a=>a.user.id===user.id);
async function move(status:Status){setSaving(true);setError('');setSuccess('');try{await api.post('/orders/'+id+'/status',{status,note});
setNote('');
await load();setSuccess('Order status updated.')}catch{setError('Unable to update status. Please refresh and try again.')}finally{setSaving(false)}}return <>
<div className="detail-head">
<div>
<Link to="/orders">← All orders</Link>
<span className="eyebrow">#{String(order.serialNumber).padStart(3,'0')} · {order.orderNumber}</span>
<h1>{order.customerName}</h1>
<p>{order.quantity} unit{order.quantity!==1?'s':''} · Created {fmt(order.createdAt)}</p>
</div>
<div className="detail-actions"><PriorityBadge priority={order.priority}/><Badge status={order.status}/><AgeBadge order={order}/>{user.role==='ADMIN'&&<button className="secondary danger-text" onClick={()=>setConfirmDelete(true)}>Delete order</button>}</div>
<ConfirmDialog open={confirmDelete} title="Delete this order?" busy={deleting} onCancel={()=>setConfirmDelete(false)} onConfirm={async()=>{setDeleting(true);try{await api.delete('/orders/'+id);window.location.href='/orders'}catch{setError('Unable to delete the order. Please try again.');setConfirmDelete(false)}finally{setDeleting(false)}}}>This permanently deletes {order.orderNumber} and its history. This action cannot be undone.</ConfirmDialog></div>
{success&&<div className="notice" role="status"><Icon name="check"/>{success}</div>}{error&&<ErrorState message={error}/>}<div className="detail">
<section className="card pad">
<span className="eyebrow">ORDER BRIEF</span>
<h2>Order information</h2><p className="order-description">{order.description}</p>
<dl><div><dt>Order type</dt><dd>{order.orderType}</dd></div><div><dt>Created</dt><dd>{fmt(order.createdAt)}</dd></div><div><dt>Phone number</dt><dd>{order.customerPhone||'Not provided'}</dd></div>
<div>
<dt>Customer email</dt>
<dd>{order.customerEmail||'Not provided'}</dd>
</div>
<div>
<dt>Priority / Age</dt><dd><PriorityBadge priority={order.priority}/> <AgeBadge order={order}/></dd></div><div><dt>Last updated</dt>
<dd>{fmt(order.updatedAt)}</dd>
</div>
</dl>
<div className="team">
<div>
<span className="eyebrow">ASSIGNED TEAM</span>
<p>{order.assignments.map(a=>`${a.user.name} (assigned ${new Date(a.assignedAt).toLocaleString()})`).join(', ')||'Nobody has been assigned yet.'}</p>
</div>{order.status==='MAKING'?<div className="assignment-controls"><label>Team member<select aria-label="Assign or reassign order" value={assignee} disabled={assigning} onChange={e=>setAssignee(e.target.value)}>
<option value="">Select team member…</option>{users.filter(u=>!order.assignments.some(a=>a.user.id===u.id)).map(u=>
<option key={u.id} value={u.id}>{u.name}</option>)}</select></label><button disabled={assigning||saving||!assignee} onClick={async()=>{setAssigning(true);setError('');setSuccess('');try{await api.post('/orders/'+id+'/assignments',{userId:assignee});setAssignee('');await load();setSuccess('Assignment updated. This order remains visible to everyone.')}catch{setError('Assignment failed. The order must still be in Making. Please refresh and try again.')}finally{setAssigning(false)}}}>{assigning?'Updating assignment…':order.assignments.length?'Reassign order':'Assign order'}</button></div>:<p className="muted">Assignment is available during Making.</p>}</div>
</section>
<section className="card pad">
<span className="eyebrow">WORKFLOW</span>
<h2>Order progress</h2>
<div className="workflow-current"><span>Current status</span><Badge status={order.status}/></div><div className="steps">{flow.map((s,i)=>
<div className={flow.indexOf(s)<=flow.indexOf(order.status)?'done':''} key={s}>
<b>{flow.indexOf(s)<flow.indexOf(order.status)?'✓':i+1}</b>{STATUS_LABEL[s]}</div>)}</div><div className="advance">
<label>Progress note<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
<label>Update status<select value="" disabled={saving||assigning} onChange={e=>e.target.value&&move(e.target.value as Status)}><option value="">Select status…</option>{STATUSES.map(s=><option key={s} value={s} disabled={s===order.status}>{STATUS_LABEL[s]}{s===order.status?' (current)':''}</option>)}</select></label>
</div>
{(user.role!=='EMPLOYEE'||assigned)&&<details className="edit-panel"><summary>Edit order <Icon name="settings" size={16}/></summary><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setEditing(true);setError('');setSuccess('');try{await api.patch('/orders/'+id,{customerName:f.get('customerName'),description:f.get('description'),orderType:f.get('orderType'),priority:Number(f.get('priority'))});await load();setSuccess('Order updated successfully.')}catch{setError('Unable to save order')}finally{setEditing(false)}}}><p className="muted">Update the order’s customer and production details.</p><label>Customer<input name="customerName" defaultValue={order.customerName} required/></label><label>Description<textarea name="description" defaultValue={order.description} required/></label><label>Type<input name="orderType" defaultValue={order.orderType} required/></label><label>Priority<select name="priority" defaultValue={order.priority}>{PRIORITIES.map((p,i)=><option key={p} value={i}>{p}</option>)}</select></label><button disabled={editing}>{editing?'Saving…':'Save changes'}</button></form></details>}
</section>
</div>
<section className="card history">
<span className="eyebrow">ACTIVITY</span>
<h2>Order history</h2><p className="muted">A record of this order’s progress.</p>{order.statusHistory?.map(x=>
<div className="event" key={x.id}>
<b>✓</b>
<div>
<strong>{STATUS_LABEL[x.toStatus]}</strong>
<p>{x.note||'No note added'}</p>
<small>{x.changedBy.name} · {fmt(x.createdAt)}</small>
</div>
</div>)}</section>{!!order.files?.length&&<section className="card pad"><h2>Attachments</h2><div className="attachments">{order.files.filter(f=>/^https?:\/\//i.test(f.url)).map(f=><a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="attachment"><Icon name="box"/>{f.name}<Icon name="arrow" size={14}/></a>)}</div></section>}
</>}
function App(){const[user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(Boolean(localStorage.getItem('oms_token'))),[restoreError,setRestoreError]=useState(''),[restoreAttempt,setRestoreAttempt]=useState(0);
useEffect(()=>{if(!localStorage.getItem('oms_token'))return;const controller=new AbortController();setChecking(true);setRestoreError('');api.get('/auth/me',{signal:controller.signal}).then(r=>setUser(r.data)).catch(error=>{if(controller.signal.aborted)return;if(error.response?.status===401)localStorage.removeItem('oms_token');else setRestoreError('The server may be waking up. Please try restoring your workspace again.');}).finally(()=>{if(!controller.signal.aborted)setChecking(false)});return()=>controller.abort()},[restoreAttempt]);
if(checking)return <Loading label="Restoring your workspace…"/>;
if(restoreError)return <ErrorState message={restoreError} retry={()=>setRestoreAttempt(n=>n+1)}/>;
if(!user)return <Routes>
<Route path="*" element={<Login onLogin={setUser}/>}/>
</Routes>;
return <Layout user={user} onLogout={()=>{localStorage.clear();
setUser(null)}}>
<Suspense fallback={<Loading label="Loading workspace…"/>}><Routes>
<Route path="/" element={<Dashboard user={user}/>}/>
<Route path="/orders" element={<OrderDirectory user={user}/>}/>
<Route path="/orders/new" element={<NewOrder/>}/>
<Route path="/reports" element={user.role!=='EMPLOYEE'?<OrderDirectory user={user} report/>:<Navigate to="/orders"/>}/><Route path="/admin" element={user.role==='ADMIN'?<Administration/>:<Navigate to="/orders"/>}/>
<Route path="/orders/:id" element={<Detail user={user}/>}/>
<Route path="*" element={<Navigate to="/"/>}/>
</Routes></Suspense>
</Layout>};
createRoot(document.getElementById('root')!).render(<BrowserRouter>
<App/>
</BrowserRouter>);
