import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner,apiError,check,uuid,ApiError } from '@/lib/api';
import { resolveVariables,missingVariables,safeName } from '@/lib/domain';
import { renderWord,bundledTemplate,checksum } from '@/lib/word';
import type { Project,Contract } from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=60;

export async function POST(request:Request) {
 try {
  const {db,user}=await requireOwner(request);
  const input=z.object({project_id:uuid,template_version_id:uuid,folder_id:uuid.optional(),mode:z.enum(['resolve','preview','save']),request_key:uuid.optional(),values:z.record(z.string(),z.string().max(10000)).optional()}).parse(await request.json());
  const [pr,co,tv]=await Promise.all([
   db.from('projects').select('*').eq('id',input.project_id).single(),
   db.from('contracts').select('*').eq('project_id',input.project_id),
   db.from('template_versions').select('*,templates!template_versions_template_id_fkey(*)').eq('id',input.template_version_id).single()
  ]);
  const p=check(pr) as Project, contracts=check(co) as Contract[],version=check(tv);
  const values={...resolveVariables(p,contracts),...input.values};
  const variables=version.variables as string[];
  const missing=missingVariables(variables,values);
  if(input.mode==='resolve') return NextResponse.json({values,variables,missing});
  if(missing.length) throw new ApiError('Thiếu dữ liệu bắt buộc: '+missing.join(', '));
  const bytes=version.storage_key.startsWith('bundled/')?await bundledTemplate(version.storage_key):
   Buffer.from(await check(await db.storage.from('dossier').download(version.storage_key)).arrayBuffer());
  if(checksum(bytes)!==version.checksum) throw new ApiError('Mẫu không vượt qua kiểm tra tính toàn vẹn.',409);
  const output=renderWord(bytes,values);
  if(input.mode==='preview') {
   const prefix=`previews/${user.id}`;
   const oldPreviews=check(await db.storage.from('dossier').list(prefix,{limit:100,sortBy:{column:'created_at',order:'asc'}}));
   const expired=oldPreviews.filter(f=>f.created_at&&Date.parse(f.created_at)<Date.now()-86400000).map(f=>`${prefix}/${f.name}`);
   if(expired.length) check(await db.storage.from('dossier').remove(expired));
   const preview_key=`${prefix}/${crypto.randomUUID()}.docx`;
   check(await db.storage.from('dossier').upload(preview_key,output,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false}));
   const signed=check(await db.storage.from('dossier').createSignedUrl(preview_key,600));
   return NextResponse.json({url:signed.signedUrl,preview_key,variables,missing:[]},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(!input.request_key) throw new ApiError('Thiếu mã yêu cầu sinh tài liệu.');
  const old=check(await db.from('document_versions').select('document_id').eq('request_key',input.request_key).maybeSingle(),true);
  if(old) return NextResponse.json({document_id:old.document_id});
  let folderQuery=db.from('folders').select('id').eq('project_id',p.id).is('deleted_at',null);
  folderQuery=input.folder_id?folderQuery.eq('id',input.folder_id):folderQuery.eq('code',version.templates.folder_code);
  const folder=check(await folderQuery.maybeSingle(),true);
  if(!folder) throw new ApiError('Hãy chọn thư mục lưu hồ sơ. Thư mục mặc định có thể đã bị xóa.');
  const storage_key=`generated/${user.id}/${input.request_key}.docx`;
  const upload=await db.storage.from('dossier').upload(storage_key,output,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false});
  if(upload.error) {
   // A retry may already have uploaded an identical blob; never overwrite it.
   const existing=await db.storage.from('dossier').download(storage_key);
   if(existing.error || checksum(Buffer.from(await existing.data.arrayBuffer()))!==checksum(output)) throw new ApiError('Không thể lưu tệp. Hãy thử lại với yêu cầu mới.',409);
  }
  const document_id=check(await db.rpc('commit_document',{payload:{project_id:p.id,folder_id:folder.id,template_version_id:version.id,
   name:`${safeName(p.code)}_${safeName(version.templates.code)}.docx`,file_type:'docx',storage_key,checksum:checksum(output),size_bytes:output.length,
   request_key:input.request_key,snapshot:values}}));
  return NextResponse.json({document_id});
 }catch(error){return apiError(error);}
}

export async function DELETE(request:Request) {
 try {
  const {db,user}=await requireOwner(request);
  const {preview_key}=z.object({preview_key:z.string()}).parse(await request.json());
  if(!new RegExp(`^previews/${user.id}/[a-f0-9-]{36}\\.docx$`).test(preview_key)) throw new ApiError('Đường dẫn xem trước không hợp lệ.',403);
  check(await db.storage.from('dossier').remove([preview_key]));
  return NextResponse.json({ok:true});
 }catch(error){return apiError(error);}
}
