import { NextResponse } from 'next/server';
import { apiError,requireOwner,check,uuid,ApiError } from '@/lib/api';
import { bundledTemplate,wordText } from '@/lib/word';
import { safeName } from '@/lib/domain';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {
  const {db}=await requireOwner();
  const params=new URL(request.url).searchParams;
  const id=uuid.parse(params.get('id')), kind=params.get('kind')||'document';
  const mode=params.get('mode')||'link';
  const version=check(await db.from(kind==='template'?'template_versions':'document_versions').select('*').eq('id',id).single());
  const originalName=kind==='template'?version.original_name:
   check(await db.from('documents').select('name').eq('id',version.document_id).single()).name;
  const filename=kind==='template'?
   (/\.docx$/i.test(version.storage_key)?originalName.replace(/\.dotx$/i,'.docx'):originalName):
   originalName.replace(/(\.[^.]+)$/,`_v${String(version.version).padStart(2,'0')}$1`);
  if(['link','download'].includes(mode)&&!version.storage_key.startsWith('bundled/')) {
   const signed=check(await db.storage.from('dossier').createSignedUrl(version.storage_key,120,mode==='download'?{download:filename}:undefined));
   if(mode==='download') return NextResponse.redirect(signed.signedUrl);
   return NextResponse.json({url:signed.signedUrl},{headers:{'Cache-Control':'private, no-store'}});
  }
  const bytes=version.storage_key.startsWith('bundled/')?await bundledTemplate(version.storage_key):
   Buffer.from(await check(await db.storage.from('dossier').download(version.storage_key)).arrayBuffer());
  if(mode==='text') {
   const extension=filename.split('.').pop()?.toLowerCase();
   if(!['docx','dotx','txt','csv'].includes(extension||'')) throw new ApiError('Định dạng này chỉ hỗ trợ tải xuống.');
   const text=['docx','dotx'].includes(extension!)?await wordText(bytes):bytes.toString('utf8');
   return NextResponse.json({text},{headers:{'Cache-Control':'private, no-store'}});
  }
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${safeName(filename.replace(/\.dotx$/i,'.docx'))}"; filename*=UTF-8''${encodeURIComponent(filename.replace(/\.dotx$/i,'.docx'))}`,'Cache-Control':'private, no-store'}});
 } catch(error){return apiError(error);}
}
