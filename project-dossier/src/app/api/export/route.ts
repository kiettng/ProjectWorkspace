import { apiError,requireOwner,check,uuid,ApiError } from '@/lib/api';
import { documentProgress,safeName } from '@/lib/domain';
import { checksum } from '@/lib/word';
import type { Task,Document,Template } from '@/lib/types';
import PizZip from 'pizzip';
import { NextResponse } from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 try{
  const {db,user}=await requireOwner();const id=uuid.parse(new URL(request.url).searchParams.get('project'));
  const [p,t,d,tp]=await Promise.all([db.from('projects').select('*').eq('id',id).single(),db.from('tasks').select('*').eq('project_id',id).is('deleted_at',null),db.from('documents').select('*').eq('project_id',id).is('deleted_at',null),db.from('templates').select('*')]);
  const project=check(p),tasks=check(t) as Task[],documents=check(d) as Document[],templates=check(tp) as Template[];
  const progress=documentProgress(tasks,documents,templates);
  if(progress.valid<progress.total)throw new ApiError(`Còn thiếu ${progress.total-progress.valid} hồ sơ hợp lệ. Hoàn thiện checklist trước khi đóng gói.`,409);
  const valid=documents.filter(d=>['Approved','Issued','Signed'].includes(d.status));
  if(!valid.length)throw new ApiError('Chưa có hồ sơ hợp lệ để xuất.');
  const versions=check(await db.from('document_versions').select('*').in('document_id',valid.map(d=>d.id)));
  const current=valid.map(d=>({d,v:versions.find(v=>v.document_id===d.id&&v.version===d.current_version)}));
  if(current.some(i=>!i.v))throw new ApiError('Một hồ sơ thiếu tệp phiên bản hiện tại.',409);
  if(current.reduce((sum,i)=>sum+i.v!.size_bytes,0)>19*1024*1024)throw new ApiError('Bộ hồ sơ vượt giới hạn đóng gói 19 MB. Hãy tải theo từng tài liệu.');
  const zip=new PizZip(),manifest=[];
  for(const {d,v} of current){
   const file=check(await db.storage.from('dossier').download(v!.storage_key));const bytes=Buffer.from(await file.arrayBuffer());
   if(checksum(bytes)!==v!.checksum)throw new ApiError('Không thể xác minh tính toàn vẹn của '+d.name,409);
   const filename=`${safeName(d.name.replace(/\.[^.]+$/,''))}_v${String(v!.version).padStart(2,'0')}_${d.id.slice(0,8)}.${d.file_type}`;
   zip.file(filename,bytes);manifest.push({id:d.id,file:filename,status:d.status,version:v!.version,checksum:v!.checksum,snapshot:v!.snapshot});
  }
  zip.file('manifest.json',JSON.stringify({project,exported_at:new Date().toISOString(),documents:manifest},null,2));
  const bytes=zip.generate({type:'nodebuffer',compression:'DEFLATE'});
  const key=`exports/${user.id}/${crypto.randomUUID()}.zip`;
  check(await db.storage.from('dossier').upload(key,bytes,{contentType:'application/zip',upsert:false}));
  const signed=check(await db.storage.from('dossier').createSignedUrl(key,120,{download:`${safeName(project.code)}_Ban_giao.zip`}));
  return NextResponse.redirect(signed.signedUrl);
 }catch(error){return apiError(error);}
}
