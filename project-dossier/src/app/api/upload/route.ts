import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError,requireOwner,check,uuid,name,ApiError } from '@/lib/api';
import { safeName } from '@/lib/domain';
import { checksum,validateFile,inspectWord } from '@/lib/word';
export const runtime='nodejs';
export const maxDuration=60;

export async function POST(request:Request) {
 try {
  const {db,user}=await requireOwner(request);
  const body=await request.json();
  if(body.action==='prepare') {
   const p=z.object({name,size:z.number().int().positive().max(20*1024*1024)}).parse(body);
   const request_key=crypto.randomUUID();
   const storage_key=`uploads/${user.id}/${request_key}/${safeName(p.name)}`;
   const signed=check(await db.storage.from('dossier').createSignedUploadUrl(storage_key,{upsert:false}));
   return NextResponse.json({storage_key,request_key,token:signed.token});
  }
  const input=z.object({storage_key:z.string(),request_key:uuid,name,project_id:uuid.optional(),folder_id:uuid.optional(),document_id:uuid.optional(),
   kind:z.enum(['document','template']),template_id:uuid.optional(),code:z.string().regex(/^[A-Z0-9._-]+$/).max(80).optional(),
   title:name.optional(),category:name.optional(),folder_code:z.string().max(100).optional()}).parse(body);
  if(!input.storage_key.startsWith(`uploads/${user.id}/${input.request_key}/`)) throw new ApiError('Đường dẫn tệp không hợp lệ.',403);
  const blob=check(await db.storage.from('dossier').download(input.storage_key));
  const bytes=Buffer.from(await blob.arrayBuffer());
  const {extension}=validateFile(bytes,input.name);
  if(input.kind==='template') {
   if(!['docx','dotx'].includes(extension)) throw new ApiError('Mẫu phải là DOCX hoặc DOTX.');
   const {variables}=inspectWord(bytes);
   let template_id=input.template_id;
   if(!template_id) {
    if(!input.code||!input.title||!input.category||!input.folder_code) throw new ApiError('Thiếu thông tin mẫu.');
    const t=check(await db.from('templates').insert({code:input.code,name:input.title,category:input.category,folder_code:input.folder_code}).select().single()); template_id=t.id;
   }
   const old=check(await db.from('template_versions').select('version').eq('template_id',template_id!).order('version',{ascending:false}).limit(1));
   const tv=check(await db.from('template_versions').insert({template_id,version:(old[0]?.version||0)+1,storage_key:input.storage_key,
    variables,checksum:checksum(bytes),original_name:input.name}).select().single());
   check(await db.from('templates').update({current_version_id:tv.id}).eq('id',template_id!));
   return NextResponse.json({template_id});
  }
  if(!input.project_id||!input.folder_id) throw new ApiError('Hãy chọn dự án và thư mục.');
  if(input.document_id) {
   const previous=check(await db.from('documents').select('file_type').eq('id',input.document_id).eq('project_id',input.project_id).single());
   if(previous.file_type!==extension) throw new ApiError('Phiên bản mới phải cùng định dạng với hồ sơ hiện có. Với định dạng khác, hãy tải lên thành hồ sơ riêng.');
  }
  if(!input.document_id) {
   const duplicates=check(await db.from('documents').select('id').eq('project_id',input.project_id).eq('folder_id',input.folder_id).eq('name',input.name).is('deleted_at',null));
   if(duplicates.length) throw new ApiError('Tên tệp đã tồn tại. Hãy chọn “Thêm phiên bản” trên hồ sơ hiện có hoặc đổi tên tệp.',409);
  }
  const document_id=check(await db.rpc('commit_document',{payload:{project_id:input.project_id,folder_id:input.folder_id,document_id:input.document_id,
   name:input.name,file_type:extension,storage_key:input.storage_key,request_key:input.request_key,checksum:checksum(bytes),size_bytes:bytes.length}}));
  return NextResponse.json({document_id});
 }catch(error){return apiError(error);}
}
