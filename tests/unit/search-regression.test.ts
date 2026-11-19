import { it,expect,vi } from 'vitest';
import { useList } from '../../apps/web/src/useList.js';
import { api } from '../../apps/web/src/api.js';
vi.mock('../../apps/web/src/api.js',()=>({api:vi.fn()}));
it('a late older query cannot replace the newest search result',async()=>{
  let resolveOld:(value:unknown)=>void=()=>{};
  vi.mocked(api).mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValueOnce({items:[{id:2}],total:1,page:1,pageSize:10});
  const list=useList<{id:number}>('/requests');const old=list.load();list.q.value='newest';await list.load();resolveOld({items:[{id:1}],total:20,page:1,pageSize:10});await old;
  expect(list.items.value).toEqual([{id:2}]);expect(list.total.value).toBe(1);
});
