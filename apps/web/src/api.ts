import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserView } from '@opsflow/shared';
let csrf='';
export async function api<T>(path:string,options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api${path}`,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
  if(!response.ok){const body=await response.json().catch(()=>({error:{message:'連線中斷，請稍後重試'}}));throw new Error(`${body.error?.message??'操作失敗'}${body.error?.requestId?`（追蹤 ${body.error.requestId}）`:''}`);}
  return response.json() as Promise<T>;
}
export const useAuth=defineStore('auth',()=>{
  const user=ref<UserView|null>(null),ready=ref(false);
  async function restore(){try{const result=await api<{user:UserView;csrf:string}>('/auth/me');user.value=result.user;csrf=result.csrf;}catch{user.value=null;}finally{ready.value=true;}}
  async function login(email:string,password:string){const result=await api<{user:UserView;csrf:string}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});user.value=result.user;csrf=result.csrf;}
  async function logout(){await api('/auth/logout',{method:'POST'});user.value=null;csrf='';}
  return {user,ready,restore,login,logout};
});
export const date=(value:string)=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
