import axios from 'axios';
const baseURL=import.meta.env.VITE_API_URL || (import.meta.env.DEV?'http://localhost:4000/api':'/api');
export const api = axios.create({baseURL,timeout:30000});
api.interceptors.request.use(config => { const token = localStorage.getItem('oms_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(undefined, async error => {
 const config=error.config;
 if(config && config.method==='get' && !config.signal?.aborted && !axios.isCancel(error) && [502,503,504].includes(error.response?.status) && !config.__retried){
  config.__retried=true;
  await new Promise(resolve=>setTimeout(resolve,1000));
  return api.request(config);
 }
 return Promise.reject(error);
});
