import React,{FormEvent,useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{BrowserRouter,Link,Navigate,Route,Routes,useNavigate,useParams}from'react-router-dom';
import{api}from'./api';
import{FLOW,Order,STATUS_LABEL,Status,User}from'./types';
import'./styles.css';

const fmt=(v?:string)=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
const initials=(n:string)=>n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();

function Mark(){return <span className="mark">
<i/>
<i/>
<i/>
</span>}function Loading({label='Loading…'}:{label?:string}){return <div className="loading" role="status">
<span className="spinner"/>{label}</div>}function Badge({status}:{status:Status}){return <span className={'badge '+status.toLowerCase()}>
<i/>{STATUS_LABEL[status]}</span>}function Head({eyebrow,title,description,action}:{eyebrow:string;
title:string;
description:string;
action?:React.ReactNode}){return <div className="page-head">
<div>
<span className="eyebrow">{eyebrow}</span>
<h1>{title}</h1>
<p>{description}</p>
</div>{action}</div>}
function Layout({user,children,onLogout}:{user:User;
children:React.ReactNode;
onLogout:()=>void}){const[open,setOpen]=useState(false);
return <div className="app">
<header>
<div className="nav-inner">
<Link className="brand" to="/">
<Mark/>Makkar and Brother OMS</Link>
<button className="menu" aria-label="Toggle navigation" onClick={()=>setOpen(!open)}>☰</button>
<nav className={open?'open':''}>
<Link to="/">Overview</Link>
<Link to="/orders">Orders</Link>
<Link className="mobile-new" to="/orders/new">+ New order</Link>
</nav>
<div className="account">
<span className="avatar">{initials(user.name)}</span>
<span>{user.name}<small>{user.role==='ADMIN'?'Administrator':'Employee'}</small>
</span>
<button className="signout" onClick={onLogout}>Sign out</button>
</div>
</div>
</header>
<main>{children}</main>
</div>}
function Login({onLogin}:{onLogin:(u:User)=>void}){const[email,setEmail]=useState('admin@oms.local'),[password,setPassword]=useState('Password123!'),[error,setError]=useState(''),[sending,setSending]=useState(false);
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
<h1>Every order.<br/>Perfectly in motion.</h1>
<p>One focused workspace for your team to manage every step from order received to delivery.</p>
</div>
<small>● Live workflow visibility&nbsp;
&nbsp;
 • &nbsp;
&nbsp;
Built for teams</small>
</aside>
<section>
<form onSubmit={submit}>
<div>
<span className="eyebrow">WELCOME BACK</span>
<h2>Sign in to your workspace</h2>
<p>Enter your details to continue managing orders.</p>
</div>{error&&<div className="error">{error}</div>}<label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>
</label>
<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
</label>
<button disabled={sending}>{sending?'Signing in…':'Sign in to Makkar and Brother OMS'} →</button>
<small className="secure">Protected workspace · Your session is securely encrypted</small>
</form>
</section>
</div>}
function Table({orders}:{orders:Order[]}){const navigate=useNavigate();return <div className="table">
<table>
<thead>
<tr>
<th>Order</th>
<th>Customer</th>
<th>Stage</th>
<th>Assigned to</th>
<th>Updated</th>
</tr>
</thead>
<tbody>{orders.map(o=>
<tr key={o.id} className="order-row" tabIndex={0} onClick={()=>navigate('/orders/'+o.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate('/orders/'+o.id)}}}>
<td>
<Link to={'/orders/'+o.id}>{o.orderNumber}</Link>
<span className="mobile-badge">
<Badge status={o.status}/>
</span>
</td>
<td>
<b>{o.customerName}</b>
<small>{o.quantity} unit{o.quantity!==1?'s':''}</small>
</td>
<td className="desktop">
<Badge status={o.status}/>
</td>
<td className="desktop">{o.assignments.length?o.assignments.map(a=>
<span className="person" key={a.user.id}>{initials(a.user.name)}</span>):<em>Unassigned</em>}</td>
<td className="desktop">{fmt(o.updatedAt)}</td>
</tr>)}{!orders.length&&<tr>
<td colSpan={5}>
<div className="empty">
<b>◌</b>
<h2>No matching orders</h2>
<p>Try adjusting your search or create a new order.</p>
</div>
</td>
</tr>}</tbody>
</table>
</div>}
function Dashboard(){const[data,setData]=useState<{byStatus:Partial<Record<Status,number>>;
recent:Order[]}>({byStatus:{},recent:[]}),[loading,setLoading]=useState(true);
useEffect(()=>{api.get('/dashboard').then(r=>setData(r.data)).finally(()=>setLoading(false))},[]);
const total=Object.values(data.byStatus).reduce((a,b)=>a+(b||0),0);
return <>
<Head eyebrow="OVERVIEW" title="Operations at a glance" description="A clear view of every order moving through your workspace." action={<Link className="button" to="/orders/new">+ Create order</Link>}/>{loading?<Loading label="Loading your workspace…"/>:<>
<section className="overview">
<div>
<span className="eyebrow light">WORKFLOW SNAPSHOT</span>
<h2>{total} active order{total===1?'':'s'} in your pipeline</h2>
<p>Stay ahead of what needs attention, from incoming requests to dispatch.</p>
</div>
<div className="flow">Received　→　Making　→　Delivered</div>
</section>
<section className="metrics">{FLOW.map((s,i)=>
<Link className="metric-link" key={s} to={`/orders?status=${s}`} aria-label={`View ${data.byStatus[s]||0} ${STATUS_LABEL[s]} orders`} style={{textDecoration:'none'}}><article>
<span>0{i+1}</span>
<small>{STATUS_LABEL[s]}</small>
<b>{data.byStatus[s]||0}</b>
</article></Link>)}</section>
<section className="card">
<div className="section-title">
<div>
<h2>Recently updated</h2>
<p>Orders with the latest activity from your team.</p>
</div>
<Link to="/orders">View all →</Link>
</div>
<Table orders={data.recent}/>
</section>
</>}</>}
function Orders(){const[orders,setOrders]=useState<Order[]>([]),[q,setQ]=useState(''),[status,setStatus]=useState(()=>new URLSearchParams(window.location.search).get('status')||''),[loading,setLoading]=useState(true);
function load(){setLoading(true);
api.get('/orders',{params:{q,status}}).then(r=>setOrders(r.data.items)).finally(()=>setLoading(false))}useEffect(load,[]);
return <>
<Head eyebrow="ORDER DIRECTORY" title="Manage orders" description="Search, review, and keep every order moving forward." action={<Link className="button" to="/orders/new">+ Create order</Link>}/>
<section className="card">
<div className="filters">
<label className="filter-search"><span>Search orders</span><input placeholder="Order number, customer, or brief…" value={q} onChange={e=>setQ(e.target.value)}/></label>
<label className="filter-stage"><span>Workflow stage</span><select value={status} onChange={e=>setStatus(e.target.value)}>
<option value="">All workflow stages</option>{FLOW.map(s=>
<option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
<div className="filter-actions"><button className="clear-filters" onClick={()=>{setQ('');setStatus('');setTimeout(load,0)}} disabled={!q&&!status}>Clear</button><button onClick={load} disabled={loading}>{loading?'Loading…':'Apply filters'}</button></div>
</div>{loading?<Loading label="Loading orders…"/>:<Table orders={orders}/>}</section>
</>}
function NewOrder(){const nav=useNavigate();
const[error,setError]=useState(''),[creating,setCreating]=useState(false);
async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();
setCreating(true);
setError('');
const f=new FormData(e.currentTarget);
try{const{data}=await api.post('/orders',{customerName:f.get('customerName'),customerEmail:f.get('customerEmail')||undefined,description:f.get('description'),quantity:Number(f.get('quantity')),priority:Number(f.get('priority'))});
nav('/orders/'+data.id)}catch{setError('Please complete the required fields.')}finally{setCreating(false)}}return <>
<Head eyebrow="NEW ORDER" title="Create an order" description="Capture the essentials now;
 your team can progress it from here."/>
<section className="form-card">
<form onSubmit={submit}>
<div>
<h2>Customer details</h2>
<div className="grid">
<label>Customer name<input name="customerName" required/>
</label>
<label>Email address <small>Optional</small>
<input name="customerEmail" type="email"/>
</label>
</div>
</div>
<div>
<h2>Order requirements</h2>
<label>Production brief<textarea name="description" placeholder="Describe the product, finish, artwork, and any special instructions…" required/>
</label>
<div className="grid small">
<label>Quantity<input name="quantity" type="number" min="1" defaultValue="1"/>
</label>
<label>Priority<select name="priority">
<option value="0">Normal</option>
<option value="1">High</option>
<option value="2">Urgent</option>
</select>
</label>
</div>
</div>{error&&<div className="error">{error}</div>}<div className="actions">
<Link to="/orders">Cancel</Link>
<button disabled={creating}>{creating?<><span className="button-spinner"/>Creating order…</>:'Create order →'}</button>
</div>
</form>
</section>
</>}
function Detail({user}:{user:User}){const{id=''}=useParams();
const[order,setOrder]=useState<Order|null>(null),[users,setUsers]=useState<User[]>([]),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
const load=()=>api.get('/orders/'+id).then(r=>setOrder(r.data));
useEffect(()=>{load();
if(user.role==='ADMIN')api.get('/users').then(r=>setUsers(r.data))},[id]);
if(!order)return <Loading label="Loading order…"/>;
const position=FLOW.indexOf(order.status),next=FLOW[position+1],previous=FLOW.slice(0,position).reverse();
const assigned=order.assignments.some(a=>a.user.id===user.id);
async function move(status:Status){setSaving(true);try{await api.post('/orders/'+id+'/status',{status,note});
setNote('');
await load()}finally{setSaving(false)}}async function advance(){if(next)await move(next)}return <>
<div className="detail-head">
<div>
<Link to="/orders">← All orders</Link>
<span className="eyebrow">ORDER {order.orderNumber}</span>
<h1>{order.customerName}</h1>
<p>{order.quantity} unit{order.quantity!==1?'s':''} · Created {fmt(order.createdAt)}</p>
</div>
<div className="detail-actions"><Badge status={order.status}/>{user.role==='ADMIN'&&<button className="delete-order" onClick={async()=>{if(window.confirm(`Delete ${order.orderNumber}? This cannot be undone.`)){await api.delete('/orders/'+id);window.location.href='/orders'}}}>Delete order</button>}</div>
</div>
<div className="detail">
<section className="card pad">
<span className="eyebrow">ORDER BRIEF</span>
<h2>{order.description}</h2>
<dl>
<div>
<dt>Customer email</dt>
<dd>{order.customerEmail||'Not provided'}</dd>
</div>
<div>
<dt>Last updated</dt>
<dd>{fmt(order.updatedAt)}</dd>
</div>
</dl>
<div className="team">
<div>
<span className="eyebrow">ASSIGNED TEAM</span>
<p>{order.assignments.map(a=>a.user.name).join(', ')||'Nobody has been assigned yet.'}</p>
</div>{user.role==='ADMIN'&&<select defaultValue="" onChange={e=>e.target.value&&api.post('/orders/'+id+'/assignments',{userId:e.target.value}).then(load)}>
<option value="" disabled>Assign team member…</option>{users.filter(u=>!order.assignments.some(a=>a.user.id===u.id)).map(u=>
<option key={u.id} value={u.id}>{u.name}</option>)}</select>}</div>
</section>
<section className="card pad">
<span className="eyebrow">PRODUCTION FLOW</span>
<h2>Order progress</h2>
<div className="steps">{FLOW.map((s,i)=>
<div className={FLOW.indexOf(s)<=FLOW.indexOf(order.status)?'done':''} key={s}>
<b>{FLOW.indexOf(s)<FLOW.indexOf(order.status)?'✓':i+1}</b>{STATUS_LABEL[s]}</div>)}</div>{next&&(user.role==='ADMIN'||assigned)&&<div className="advance">
<label>Progress note <small>Optional</small>
<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add context for the next team…"/>
</label>
<button onClick={advance} disabled={saving}>{saving?'Updating…':`Move to ${STATUS_LABEL[next]} →`}</button>
</div>}{user.role==='ADMIN'&&previous.length>0&&<label className="move-back">Correction <small>Admin only</small><select defaultValue="" disabled={saving} onChange={e=>e.target.value&&move(e.target.value as Status)}><option value="" disabled>Move order back to…</option>{previous.map(status=><option value={status} key={status}>{STATUS_LABEL[status]}</option>)}</select></label>}</section>
</div>
<section className="card history">
<span className="eyebrow">ACTIVITY</span>
<h2>Order history</h2>{order.statusHistory?.map(x=>
<div className="event" key={x.id}>
<b>✓</b>
<div>
<strong>{STATUS_LABEL[x.toStatus]}</strong>
<p>{x.note||'No note added'}</p>
<small>{x.changedBy.name} · {fmt(x.createdAt)}</small>
</div>
</div>)}</section>
</>}
function App(){const[user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(Boolean(localStorage.getItem('oms_token')));
useEffect(()=>{if(localStorage.getItem('oms_token'))api.get('/auth/me').then(r=>setUser(r.data)).catch(()=>localStorage.clear()).finally(()=>setChecking(false))},[]);
if(checking)return <Loading label="Restoring your workspace…"/>;
if(!user)return <Routes>
<Route path="*" element={<Login onLogin={setUser}/>}/>
</Routes>;
return <Layout user={user} onLogout={()=>{localStorage.clear();
setUser(null)}}>
<Routes>
<Route path="/" element={<Dashboard/>}/>
<Route path="/orders" element={<Orders/>}/>
<Route path="/orders/new" element={<NewOrder/>}/>
<Route path="/orders/:id" element={<Detail user={user}/>}/>
<Route path="*" element={<Navigate to="/"/>}/>
</Routes>
</Layout>};
createRoot(document.getElementById('root')!).render(<BrowserRouter>
<App/>
</BrowserRouter>);
