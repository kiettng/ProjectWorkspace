import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import PizZip from 'pizzip';

const source=path.resolve(process.argv[2]||'../Template Warehouse');
const target=path.resolve('templates');
await fs.mkdir(target,{recursive:true});
const catalog=[];
const entries=[
 ['NB_BM.40.01.Ke hoach trien khai phan mem.dotx','BM.40.01','Kế hoạch triển khai phần mềm','Kế hoạch','02','vi'],
 ['NB_BM.40.08. Bien Ban khao sat Va phuong an thuc hien.docx','BM.40.08','Biên bản khảo sát và phương án thực hiện','Khảo sát','01','vi'],
 ['NB_BM.40.11. Ke Hoach Khao Sat.dotx','BM.40.11','Kế hoạch khảo sát','Khảo sát','01','vi'],
 ['NB_BM.40.06.Quyet dinh thanh lap ban du an.dotx','BM.40.06','Quyết định thành lập ban dự án','Kế hoạch','02','vi'],
 ['NB_PL.40.02.01. Bien Ban xac nhan cai dat.dotx','PL.40.02.01','Biên bản xác nhận cài đặt','Cài đặt','03','vi'],
 ['NB_PL.40.03.02. Bien ban xac nhan dao tao phan mem.dotx','PL.40.03.02','Biên bản xác nhận đào tạo phần mềm','Đào tạo','03','vi'],
 ['NB_PL.40.04.Bien ban Nghiem Thu.dotx','PL.40.04','Biên bản nghiệm thu phần mềm','Nghiệm thu','05','vi'],
 ['NB_PL.40.09. Bien ban nghiem thu chay thu.dotx','PL.40.09.UAT','Biên bản nghiệm thu chạy thử','UAT','04-04','vi'],
 ['PL.40.09 Bien Ban xac nhan nhan su quan tri he thong.dotx','PL.40.09','Biên bản xác định nhân sự quản trị hệ thống','Cài đặt','03','vi'],
 ['NB_Bien Ban hop Khao sat.dotx','BM.HOP','Biên bản họp khảo sát','Họp & Báo cáo','08','vi'],
 ['NB_Bien ban ho tro sau nghiem thu.dotx','BM.SNT','Biên bản hỗ trợ sau nghiệm thu','Bảo hành','06','vi'],
 ['BM.40.01-Implementation plan.dotx','BM.40.01.EN','Implementation plan','Kế hoạch','02','en'],
 ['BM.40.08-Certificate of technical survey and implementing solution.dotx','BM.40.08.EN','Certificate of technical survey and implementing solution','Khảo sát','01','en'],
 ['NB_PL.40.04.MINUTES OF SOFTWARE ACCEPTANCE.docx','PL.40.04.EN','Minutes of software acceptance','Nghiệm thu','05','en']
];
const unescape=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Replace text ranges across Word runs while retaining all paragraphs, tables,
// run properties, page setup, images, styles and relationships from the source.
function changeParagraph(xml, transform) {
 const matches=[...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
 const nodes=matches.map(m=>unescape(m[1])); const original=nodes.join('');
 const changes=transform(original).sort((a,b)=>b.start-a.start);
 for(const {start,end,text} of changes) {
  let offset=0; const starts=nodes.map(n=>{const p=offset;offset+=n.length;return p;});
  let first=nodes.findIndex((n,i)=>start>=starts[i] && start<starts[i]+n.length);
  if(first<0 && start===original.length) first=nodes.length-1;
  if(first<0) continue;
  let last=nodes.findIndex((n,i)=>end>starts[i] && end<=starts[i]+n.length);
  if(start===end) last=first;
  if(last<first) last=first;
  const prefix=nodes[first].slice(0,start-starts[first]);
  const suffix=nodes[last].slice(end-starts[last]);
  nodes[first]=prefix+text+suffix;
  for(let i=first+1;i<=last;i++) nodes[i]='';
 }
 let index=0;
 return xml.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g,()=>`<w:t xml:space="preserve">${escape(nodes[index++])}</w:t>`);
}

for(const [filename,code,name,category,folder_code,language] of entries) {
 const zip=new PizZip(await fs.readFile(path.join(source,filename)));
 const touched=[];
 for(const item of Object.values(zip.files).filter(f=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(f.name))) {
  const xml=item.asText().replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>changeParagraph(p,text=>{
   const changes=[];
   const replace=(regex,replacement)=>{const m=regex.exec(text);if(m)changes.push({start:m.index,end:m.index+m[0].length,text:replacement(m)});};
   if(language==='vi') {
    if(/^Số\s*:/u.test(text.trim())) replace(/Số\s*:[\s\S]*/u,()=>`Số: {=DocumentNo}`);
    if(/Căn cứ.*[Hh]ợp đồng/u.test(text)) {
     replace(/(số\s*:?)[\s.…]*(?=ký|được ký)/u,m=>m[1]+' {=ContractNo} ');
     replace(/(ký(?: kết)?\s*(?:ngày)?\s*:?)\s*[\s\S]*?(?=giữa)/u,()=> 'ký ngày {=ContractSignedDate} ');
     replace(/((?:và|với) [Cc]ông ty)\s*[.\s…]*(?=[(“";.]|$)/u,()=> 'và {=CustomerName} ');
    }
    if(/^(?:Bên|BÊN) A\s*:/u.test(text.trim())) replace(/((?:Bên|BÊN) A\s*:)\s*(?:CÔNG TY)?[\s.…]*/u,m=>m[1]+' {=CustomerName} ');
    if(/^Hôm nay,/u.test(text.trim())) replace(/ngày[\s\S]*?(?=,|tại|chúng tôi|Chúng tôi)/u,()=>'ngày {=DocumentDate} ');
    if(/^Đề nghị đưa ra người chịu trách nhiệm quản lý dự án/u.test(text.trim())) changes.push({start:text.length,end:text.length,text:' {=ProjectManager}'});
   } else {
    replace(/ABC CO\., LTD/g,()=>'{=CustomerName}');
    if(/^Customer name:/i.test(text.trim())) replace(/Customer name:[\s\S]*/i,()=> 'Customer name: {=CustomerName}');
    for(const [regex,key] of [[/Contract \(Appendix\) No\.:/gi,'ContractNo'],[/Signing date:/gi,'ContractSignedDate'],[/Project manager:/gi,'ProjectManager'],[/Starting date:/gi,'ProjectStartDate'],[/Finishing date:/gi,'ProjectEndDate']]) {
     for(const m of text.matchAll(regex))changes.push({start:m.index+m[0].length,end:m.index+m[0].length,text:' {='+key+'} '});
    }
    replace(/(Contract number\s*)[.\s…]+/i,m=>m[1]+'{=ContractNo} ');
    replace(/(signed on\s*)[.\s…,]+/i,m=>m[1]+'{=ContractSignedDate} ');
    replace(/^(Today,\s*)[\s\S]*?(?=in |we include:)/,m=>m[1]+'{=DocumentDate}, ');
   }
   if(changes.length) touched.push(text.slice(0,90));
   // Discard overlapping replacements rather than corrupting a paragraph.
   const accepted=[];
   for(const change of changes) if(!accepted.some(c=>change.start<c.end && change.end>c.start)) accepted.push(change);
   return accepted;
  }));
  zip.file(item.name,xml);
 }
 const content=zip.file('[Content_Types].xml').asText().replace(/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.template\.main\+xml/g,'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');
 zip.file('[Content_Types].xml',content);
 const variables=[...new Set(Object.values(zip.files).filter(f=>/^word\/.*\.xml$/.test(f.name)).flatMap(f=>[...f.asText().matchAll(/\{=([A-Za-z][A-Za-z0-9.]*)\}/g)].map(m=>m[1])))].sort();
 if(!variables.includes('CustomerName')) throw new Error(`Missing customer mapping: ${filename}`);
 const bytes=zip.generate({type:'nodebuffer',compression:'DEFLATE'});
 const output=code+'.docx';
 await fs.writeFile(path.join(target,output),bytes);
 catalog.push({id:crypto.randomUUID(),version_id:crypto.randomUUID(),code,name,category,folder_code,language,
  file:output,original_name:filename,variables,checksum:crypto.createHash('sha256').update(bytes).digest('hex'),adapted_paragraphs:touched.length});
}
await fs.writeFile(path.join(target,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const sql=catalog.map(t=>`insert into public.templates(id,code,name,category,folder_code,language) values(${quote(t.id)},${quote(t.code)},${quote(t.name)},${quote(t.category)},${quote(t.folder_code)},${quote(t.language)});\ninsert into public.template_versions(id,template_id,version,storage_key,variables,checksum,original_name) values(${quote(t.version_id)},${quote(t.id)},1,${quote('bundled/'+t.file)},${quote(JSON.stringify(t.variables))}::jsonb,${quote(t.checksum)},${quote(t.original_name)});\nupdate public.templates set current_version_id=${quote(t.version_id)} where id=${quote(t.id)};`).join('\n');
await fs.writeFile('supabase/template-catalog.sql',sql+'\n');
console.log(`Prepared ${catalog.length} templates; originals unchanged.`);
console.log(catalog.map(t=>`${t.code}: ${t.variables.join(', ')}`).join('\n'));
