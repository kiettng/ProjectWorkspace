import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner,apiError,check,uuid,ApiError } from '@/lib/api';
import { resolveVariables,missingVariables,safeName } from '@/lib/domain';
import { renderWord,bundledTemplate,wordText,checksum } from '@/lib/word';
import type { Project,Contract } from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=60;

export async function POST(request:Request) {
 try {
  const {db,user}=await requireOwner(request);
  const input=z.object({project_id:uuid,template_version_id:uuid,mode:z.enum(['resolve','preview','save']),request_key:uuid.optional(),values:z.record(z.string(),z.string().max(10000)).optional()}).parse(await request.json());
  const [pr,co,tv]=await Promise.all([
   db.from('projects').select('*').eq('id',input.project_id).single(),
   db.from('contracts').select('*').eq('project_id',input.project_id),
   db.from('template_versions').select('*,templates(*)').eq('id',input.template_version_id).single()
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
  const text=await wordText(output);
  if(input.mode==='preview') return NextResponse.json({text,variables,missing:[]});
  if(!input.request_key) throw new ApiError('Thiếu mã yêu cầu sinh tài liệu.');
  const old=check(await db.from('document_versions').select('document_id').eq('request_key',input.request_key).maybeSingle(),true);
  if(old) return NextResponse.json({document_id:old.document_id});
  const folder=check(await db.from('folders').select('id').eq('project_id',p.id).eq('code',version.templates.folder_code).single());
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
  return NextResponse.json({document_id,text});
 }catch(error){return apiError(error);}
}
