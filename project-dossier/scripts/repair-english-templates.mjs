import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import PizZip from 'pizzip';

const catalog=JSON.parse(await fs.readFile('templates/catalog.json','utf8'));
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const sql=[];
for(const t of catalog.filter(t=>t.language==='en')) {
 const zip=new PizZip(await fs.readFile(path.join('../Template Warehouse',t.original_name)));
 for(const f of Object.values(zip.files).filter(f=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(f.name))) {
  const xml=f.asText().replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>{
   const matches=[...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
   const nodes=matches.map(m=>decode(m[1]));const text=nodes.join('');const edits=[];
   const replace=(regex,value)=>{for(const m of text.matchAll(regex))edits.push({start:m.index,end:m.index+m[0].length,value:typeof value==='function'?value(m):value});};
   const after=(regex,key)=>{for(const m of text.matchAll(regex))edits.push({start:m.index+m[0].length,end:m.index+m[0].length,value:' {='+key+'} '});};
   replace(/ABC CO\., LTD/g,'{=CustomerName}');
   after(/Contract \(Appendix\) No\.:/gi,'ContractNo');
   after(/Signing date:/gi,'ContractSignedDate');
   after(/Project manager:/gi,'ProjectManager');
   after(/Starting date:/gi,'ProjectStartDate');
   after(/Finishing date:/gi,'ProjectEndDate');
   replace(/(Contract number\s*)[.\s…]+/gi,m=>m[1]+'{=ContractNo} ');
   replace(/(signed on\s*)[.\s…,]+/gi,m=>m[1]+'{=ContractSignedDate} ');
   replace(/^(Today,\s*)[\s\S]*?(?=in |we include:)/g,m=>m[1]+'{=DocumentDate}, ');
   for(const edit of edits.sort((a,b)=>b.start-a.start)) {
    let pos=0;const starts=nodes.map(n=>{const offset=pos;pos+=n.length;return offset;});
    let first=nodes.findIndex((n,i)=>edit.start>=starts[i]&&edit.start<starts[i]+n.length);
    if(first<0&&edit.start===text.length)first=nodes.length-1;
    if(first<0)continue;
    let last=edit.start===edit.end?first:nodes.findIndex((n,i)=>edit.end>starts[i]&&edit.end<=starts[i]+n.length);
    if(last<first)last=first;
    nodes[first]=nodes[first].slice(0,edit.start-starts[first])+edit.value+nodes[last].slice(edit.end-starts[last]);
    for(let i=first+1;i<=last;i++)nodes[i]='';
   }
   let i=0;return p.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g,()=>`<w:t xml:space="preserve">${escape(nodes[i++])}</w:t>`);
  });
  zip.file(f.name,xml,{date:new Date('2026-01-01T00:00:00Z')});
 }
 zip.file('[Content_Types].xml',zip.file('[Content_Types].xml').asText().replace(/wordprocessingml\.template\.main\+xml/g,'wordprocessingml.document.main+xml'),{date:new Date('2026-01-01T00:00:00Z')});
 const bytes=zip.generate({type:'nodebuffer',compression:'DEFLATE'}),file=t.code+'.v2.docx';
 const variables=[...new Set(Object.values(zip.files).filter(f=>/^word\/.*\.xml$/.test(f.name)).flatMap(f=>[...f.asText().matchAll(/\{=([A-Za-z][A-Za-z0-9.]*)\}/g)].map(m=>m[1])))].sort();
 const version_id=crypto.randomUUID(),checksum=crypto.createHash('sha256').update(bytes).digest('hex');
 await fs.writeFile('templates/'+file,bytes);
 sql.push(`insert into public.template_versions(id,template_id,version,storage_key,variables,checksum,original_name) values('${version_id}','${t.id}',2,'bundled/${file}','${JSON.stringify(variables)}'::jsonb,'${checksum}','${t.original_name.replaceAll("'","''")}');\nupdate public.templates set current_version_id='${version_id}' where id='${t.id}';`);
 Object.assign(t,{file,variables,version_id,checksum,version:2});
 console.log(t.code+': '+variables.join(', '));
}
await fs.writeFile('templates/catalog.json',JSON.stringify(catalog,null,2)+'\n');
await fs.writeFile('supabase/english-template-v2.sql',sql.join('\n')+'\n');
