import { NextResponse } from 'next/server';
import { requireOwner,apiError,check } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET() {
  try {
    const {db}=await requireOwner();
    const tables=['projects','contracts','members','folders','templates','template_versions','documents','document_versions','tasks','template_packs','audit_logs'] as const;
    const results=await Promise.all(tables.map(table=>{
      let q=db.from(table).select('*');
      if(['documents','folders','tasks'].includes(table)) q=q.is('deleted_at',null);
      if(table==='audit_logs') q=q.order('created_at',{ascending:false}).limit(100);
      if(table==='projects') q=q.order('created_at',{ascending:false});
      return q;
    }));
    return NextResponse.json(Object.fromEntries(tables.map((t,i)=>[t,check(results[i])])),{headers:{'Cache-Control':'private, no-store'}});
  } catch(error){return apiError(error);}
}
