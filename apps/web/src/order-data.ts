import {api} from './api';
import {Order} from './types';

// Analytics use every result, rather than presenting a single page as the total.
export async function loadOrders(params:Record<string,unknown>={},signal?:AbortSignal):Promise<Order[]> {
 const first=await api.get('/orders',{params:{...params,page:1,limit:100},signal});
 const orders:Order[]=[...first.data.items];
 for(let page=2;page<=Math.ceil(first.data.total/100);page++){
  const response=await api.get('/orders',{params:{...params,page,limit:100},signal});
  orders.push(...response.data.items);
 }
 return orders;
}
