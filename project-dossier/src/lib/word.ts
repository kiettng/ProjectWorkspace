import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { variableLabels,missingVariables } from './domain';

export function inspectWord(bytes:Buffer) {
  const zip=new PizZip(bytes);
  if(!zip.file('word/document.xml')) throw new Error('Tệp không phải tài liệu Word hợp lệ.');
  const parts=Object.values(zip.files).filter(f=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(f.name));
  const text=parts.map(f=>f.asText().replace(/<[^>]+>/g,'')).join('\n');
  const variables=[...new Set([...text.matchAll(/\{=\s*([A-Za-z][A-Za-z0-9.]*)\s*\}/g)].map(m=>m[1]))];
  const unknown=variables.filter(v=>!Object.hasOwn(variableLabels,v));
  if(unknown.length) throw new Error('Biến chưa được hỗ trợ: '+unknown.join(', '));
  if(!variables.length) throw new Error('Mẫu chưa có biến. Hãy chèn các biến {=CustomerName}, {=ContractNo}… trong Word.');
  return {zip,variables};
}
export function renderWord(bytes:Buffer,values:Record<string,string>) {
  const {zip,variables}=inspectWord(bytes);
  const missing=missingVariables(variables,values);
  if(missing.length) throw new Error('Thiếu dữ liệu: '+missing.map(k=>variableLabels[k]||k).join(', '));
  // Docxtemplater resolves placeholders split into multiple Word XML runs.
  const engine=new Docxtemplater(zip,{
    delimiters:{start:'{=',end:'}'},paragraphLoop:true,linebreaks:true,errorLogging:false,
    parser:tag=>({get:scope=>Object.hasOwn(variableLabels,tag.trim())?String(scope[tag.trim()]??''):undefined}),
    nullGetter:()=>{throw new Error('Mẫu chứa biến không xác định.');}
  });
  engine.render(values);
  const content=engine.getZip().file('[Content_Types].xml')!.asText().replace(/wordprocessingml\.template\.main\+xml/g,'wordprocessingml.document.main+xml');
  engine.getZip().file('[Content_Types].xml',content);
  const output=engine.getZip().generate({type:'nodebuffer',compression:'DEFLATE'});
  const remaining=Object.values(engine.getZip().files).filter(f=>/^word\/.*\.xml$/.test(f.name)).some(f=>/\{=/.test(f.asText().replace(/<[^>]+>/g,'')));
  if(remaining) throw new Error('Tài liệu còn biến chưa được điền.');
  return output;
}
export async function wordText(bytes:Buffer) {return (await mammoth.extractRawText({buffer:bytes})).value;}
export function checksum(bytes:Buffer) {return createHash('sha256').update(bytes).digest('hex');}
export async function bundledTemplate(key:string) {
  if(!/^bundled\/[A-Za-z0-9.]+\.docx$/.test(key)) throw new Error('Đường dẫn mẫu không hợp lệ.');
  return readFile(path.join(process.cwd(),'templates',key.slice('bundled/'.length)));
}
export function validateFile(bytes:Buffer,filename:string) {
 const extension=filename.split('.').pop()?.toLowerCase()||'';
 const mime:Record<string,string>={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',dotx:'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',csv:'text/csv'};
 if(!mime[extension]) throw new Error('Hỗ trợ DOCX, DOTX, XLSX, PPTX, PDF, ảnh, TXT và CSV.');
 if(!bytes.length||bytes.length>20*1024*1024) throw new Error('Tệp phải có nội dung và nhỏ hơn 20 MB.');
 let valid=true;
 if(['docx','dotx','xlsx','pptx'].includes(extension)) {
  const zip=new PizZip(bytes);
  if(Object.keys(zip.files).length>5000) throw new Error('Tệp nén có quá nhiều thành phần.');
  let expanded=0;
  for(const f of Object.values(zip.files)) {
   const size=(f as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0;
   expanded+=size;
  }
  if(expanded>100*1024*1024) throw new Error('Tệp Office vượt giới hạn giải nén 100 MB.');
  valid=!!zip.file(extension==='xlsx'?'xl/workbook.xml':extension==='pptx'?'ppt/presentation.xml':'word/document.xml');
  if(zip.file(/vbaProject\.bin$/i).length) throw new Error('Không hỗ trợ tài liệu chứa macro.');
 } else if(extension==='pdf') valid=bytes.subarray(0,5).toString()==='%PDF-';
 else if(extension==='png') valid=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
 else if(['jpg','jpeg'].includes(extension)) valid=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 else if(extension==='webp') valid=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 else valid=!bytes.includes(0);
 if(!valid) throw new Error('Nội dung tệp không khớp định dạng khai báo.');
 return {extension,mime:mime[extension]};
}
