import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });
api.interceptors.request.use(config => { const token = localStorage.getItem('oms_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(undefined, async error => {
  const config = error.config as (typeof error.config & { __retryCount?: number }) | undefined;
  if (config && config.method === 'get' && error.response?.status >= 500 && (config.__retryCount || 0) < 2) {
    config.__retryCount = (config.__retryCount || 0) + 1;
    await new Promise(resolve => setTimeout(resolve, config.__retryCount * 350));
    return api.request(config);
  }
  return Promise.reject(error);
});
