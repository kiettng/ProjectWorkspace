import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError,requireOwner,check,uuid,date,name,ApiError } from '@/lib/api';
import { documentFilename } from '@/lib/domain';
export const maxDuration=60;

export async function POST(request:Request) {
 try {
  const {db,user}=await requireOwner(request);
  const body=await request.json();
  let result:unknown;
  switch(body.action) {
   case 'create-project': {
    const p=z.object({code:name,name,customer:name,manager:z.string().max(200),tax_code:z.string().max(50).default(''),start_date:date,end_date:date,
     pack_id:uuid,project_type:name,contract_number:z.string().max(200).default(''),signed_date:date,
     description:z.string().max(5000).default(''),modules:z.array(z.string().max(100)).max(50).default([]),integrations:z.array(z.string().max(200)).max(50).default([])}).parse(body.data);
    if(p.start_date&&p.end_date&&p.end_date<p.start_date) throw new ApiError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
    result=check(await db.rpc('create_project',{payload:p})); break;
   }
   case 'update-project': {
    const p=z.object({id:uuid,name,customer:name,manager:z.string().max(200),tax_code:z.string().max(50),description:z.string().max(5000),
     start_date:date,end_date:date,status:z.enum(['Draft','Active','OnHold','Completed','Archived']),modules:z.array(z.string().max(100)),integrations:z.array(z.string().max(200))}).parse(body.data);
    const {id,...data}=p;
    result=check(await db.from('projects').update({...data,start_date:data.start_date||null,end_date:data.end_date||null,updated_at:new Date().toISOString()}).eq('id',id).select().single());break;
   }
   case 'add-contract': {
    const p=z.object({project_id:uuid,number:name,name:z.string().max(300).default(''),signed_date:date,value:z.number().nonnegative().nullable().optional()}).parse(body.data);
    result=check(await db.from('contracts').insert({...p,signed_date:p.signed_date||null}).select().single());break;
   }
   case 'primary-contract': result=check(await db.rpc('set_primary_contract',{contract_id:uuid.parse(body.id)}));break;
   case 'add-member': {
    const p=z.object({project_id:uuid,name,role:name,email:z.union([z.email(),z.literal('')]),phone:z.string().max(30)}).parse(body.data);
    result=check(await db.from('members').insert(p).select().single()); break;
   }
   case 'create-folder': {
    const p=z.object({project_id:uuid,parent_id:uuid.nullable(),name}).parse(body.data);
    let siblings=db.from('folders').select('sort_order').eq('project_id',p.project_id).is('deleted_at',null);
    siblings=p.parent_id?siblings.eq('parent_id',p.parent_id):siblings.is('parent_id',null);
    const last=check(await siblings.order('sort_order',{ascending:false}).limit(1));
    result=check(await db.from('folders').insert({...p,code:'custom-'+crypto.randomUUID(),sort_order:(last[0]?.sort_order??0)+10}).select().single());break;
   }
   case 'update-folder': {
    const p=z.object({id:uuid,name,parent_id:uuid.nullable()}).parse(body.data); const {id,...data}=p;
    result=check(await db.from('folders').update(data).eq('id',id).select().single());break;
   }
   case 'delete-folder': result=check(await db.from('folders').update({deleted_at:new Date().toISOString()}).eq('id',uuid.parse(body.id)).is('deleted_at',null).select().single());break;
   case 'reorder-folders': {
    const p=z.object({project_id:uuid,parent_id:uuid.nullable(),ids:z.array(uuid).min(1).max(500)}).parse(body.data);
    result=check(await db.rpc('reorder_folders',{p_project_id:p.project_id,p_parent_id:p.parent_id,p_ids:p.ids}),true);break;
   }
   case 'create-task':
   case 'update-task': {
    const p=z.object({id:uuid.optional(),project_id:uuid,phase_code:name,title:name,status:z.enum(['Todo','InProgress','InReview','Done','Blocked','Cancelled']),owner_name:z.string().max(200),due_date:date,
     required_template_codes:z.array(z.string().min(1).max(80)).max(100).transform(a=>[...new Set(a)])}).parse(body.data);
    const {id,...data}=p; const fields={...data,due_date:data.due_date||null};
    const last=body.action==='create-task'?check(await db.from('tasks').select('sort_order').eq('project_id',p.project_id).is('deleted_at',null).order('sort_order',{ascending:false}).limit(1)):[];
    result=body.action==='create-task'?check(await db.from('tasks').insert({...fields,sort_order:(last[0]?.sort_order??0)+10}).select().single()):
     check(await db.from('tasks').update(fields).eq('id',uuid.parse(id)).eq('project_id',p.project_id).is('deleted_at',null).select().single());break;
   }
   case 'delete-task': result=check(await db.from('tasks').update({deleted_at:new Date().toISOString()}).eq('id',uuid.parse(body.id)).is('deleted_at',null).select().single());break;
   case 'reorder-tasks': {
    const p=z.object({project_id:uuid,ids:z.array(uuid).min(1).max(500)}).parse(body.data);
    result=check(await db.rpc('reorder_tasks',{p_project_id:p.project_id,p_ids:p.ids}),true);break;
   }
   case 'document-requirement': {
    const p=z.object({id:uuid,requirement_code:z.string().min(1).max(80).nullable()}).parse(body.data);
    result=check(await db.from('documents').update({requirement_code:p.requirement_code}).eq('id',p.id).select().single());break;
   }
   case 'document-status': {
    const p=z.object({id:uuid,status:z.enum(['Draft','Official'])}).parse(body.data);
    result=check(await db.from('documents').update({status:p.status}).eq('id',p.id).select().single());break;
   }
   case 'rename-document': {
    const p=z.object({id:uuid,base_name:name}).parse(body.data);
    const doc=check(await db.from('documents').select('id,project_id,folder_id,file_type').eq('id',p.id).is('deleted_at',null).single());
    let filename:string;
    try{filename=documentFilename(`file.${doc.file_type}`,p.base_name);}
    catch(error){throw new ApiError(error instanceof Error?error.message:'Tên tài liệu không hợp lệ.');}
    const duplicate=check(await db.from('documents').select('id').eq('project_id',doc.project_id).eq('folder_id',doc.folder_id).eq('name',filename).neq('id',p.id).is('deleted_at',null).limit(1));
    if(duplicate.length) throw new ApiError('Tên tệp đã tồn tại trong thư mục này. Hãy nhập tên khác.',409);
    result=check(await db.from('documents').update({name:filename}).eq('id',p.id).is('deleted_at',null).select().single());break;
   }
   case 'move-document': {
    const p=z.object({id:uuid,folder_id:uuid}).parse(body.data);
    result=check(await db.from('documents').update({folder_id:p.folder_id}).eq('id',p.id).select().single());break;
   }
   case 'delete-document': {
    const id=uuid.parse(body.id),keys:string[]=[];
    for(let offset=0;;offset+=1000){
     const page=check(await db.from('document_versions').select('storage_key').eq('document_id',id).order('version',{ascending:true}).range(offset,offset+999));
     keys.push(...page.map(v=>v.storage_key));
     if(page.length<1000)break;
    }
    const expected=keys.toSorted();
    if(keys.some(key=>!key.startsWith(`uploads/${user.id}/`)&&!key.startsWith(`generated/${user.id}/`))) throw new ApiError('Đường dẫn tệp không hợp lệ. Không thể xóa hồ sơ.',409);
    check(await db.rpc('purge_document',{p_document_id:id,p_expected_keys:expected,p_execute:false}));
    for(let i=0;i<keys.length;i+=1000) check(await db.storage.from('dossier').remove(keys.slice(i,i+1000)));
    result=check(await db.rpc('purge_document',{p_document_id:id,p_expected_keys:expected,p_execute:true}));break;
   }
   default: throw new ApiError('Thao tác không được hỗ trợ.');
  }
  return NextResponse.json({data:result});
 } catch(error) {return apiError(error);}
}
