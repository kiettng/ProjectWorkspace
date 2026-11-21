import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import PizZip from 'pizzip';
import { inspectWord,renderWord,wordText,validateFile,checksum } from '../src/lib/word';
import { csvCell,documentProgress,missingVariables,resolveVariables } from '../src/lib/domain';
import type { Contract,Project,Task,Document,Template } from '../src/lib/types';

const values={CustomerName:'Công ty Kiểm Thử & Cộng sự',ContractNo:'BRAVO/TEST/2026/001',ContractSignedDate:'21/11/2026',
 DocumentDate:'21/11/2026',DocumentNo:'KTKS/TEST-001/20261121-01',ProjectManager:'Người kiểm thử',ProjectStartDate:'21/11/2026',ProjectEndDate:'21/12/2026',ProjectName:'Dự án kiểm thử',ProjectCode:'TEST-001'};
const catalog=JSON.parse(await readFile('templates/catalog.json','utf8')) as {file:string;code:string;variables:string[]}[];
function wordFixture(paragraphXml:string) {
 const zip=new PizZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphXml+'</w:body></w:document>');
 return zip.generate({type:'nodebuffer'});
}
for(const t of catalog) test(`Real template ${t.code}: fills fields and preserves structure`,{skip:!existsSync('templates/'+t.file)},async()=>{
 const bytes=await readFile('templates/'+t.file),before=new PizZip(bytes);
 assert.deepEqual(inspectWord(bytes).variables.toSorted(),t.variables.toSorted());
 const output=renderWord(bytes,values),after=new PizZip(output);
 const text=await wordText(output);
 assert.ok(text.includes(values.CustomerName));assert.ok(!text.includes('{='));
 assert.equal((after.file('word/document.xml')!.asText().match(/<w:tbl>/g)||[]).length,(before.file('word/document.xml')!.asText().match(/<w:tbl>/g)||[]).length);
 assert.deepEqual(after.file('word/styles.xml')?.asUint8Array(),before.file('word/styles.xml')?.asUint8Array());
 assert.equal(validateFile(output,'result.docx').extension,'docx');
});
test('Placeholders split across Word runs resolve correctly',()=>{
 const bytes=wordFixture('<w:p><w:r><w:t>{=Cus</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>tomerName}</w:t></w:r></w:p>');
 const out=renderWord(bytes,values);
 assert.ok(new PizZip(out).file('word/document.xml')!.asText().includes('Công ty Kiểm Thử &amp; Cộng sự'));
});
test('Required variables stop generation',async()=>{
 const bytes=wordFixture('<w:p><w:r><w:t>{=ContractSignedDate}</w:t></w:r></w:p>');
 assert.throws(()=>renderWord(bytes,{...values,ContractSignedDate:''}),/Thiếu dữ liệu/);
 if(existsSync('templates/BM.40.08.docx')) {
  const survey=await readFile('templates/BM.40.08.docx');
  assert.throws(()=>renderWord(survey,{...values,ContractSignedDate:''}),/Thiếu dữ liệu/);
 }
 assert.deepEqual(missingVariables(['A','B'],{A:'  ',B:'ok'}),['A']);
});
const englishPlan=catalog.find(t=>t.code==='BM.40.01.EN');
test('English labels receive the matching values before adjacent labels',{skip:!englishPlan||!existsSync('templates/'+englishPlan.file)},async()=>{
 const text=await wordText(renderWord(await readFile('templates/'+englishPlan!.file),values));
 const normalized=text.replace(/\s+/g,' ');
 assert.ok(normalized.includes('Contract (Appendix) No. : '+values.ContractNo));
 assert.ok(normalized.includes('Signing date : '+values.ContractSignedDate));
 assert.ok(normalized.includes('Project manager : '+values.ProjectManager));
 assert.ok(normalized.includes('Starting date : '+values.ProjectStartDate));
 assert.ok(normalized.includes('Finishing date : '+values.ProjectEndDate));
});
test('Resolver uses the explicitly selected primary contract',()=>{
 const p={id:'project',code:'P',name:'P',customer:'C',tax_code:'',manager:'PM',start_date:null,end_date:null,modules:[],integrations:[]} as unknown as Project;
 const contracts=[{project_id:'project',number:'Wrong',is_primary:false},{project_id:'project',number:'Right',signed_date:'2026-11-21',is_primary:true}] as Contract[];
 assert.equal(resolveVariables(p,contracts).ContractNo,'Right');
 assert.equal(resolveVariables(p,[]).ContractNo,'');
 assert.throws(()=>resolveVariables(p,[contracts[1],contracts[1]]),/nhiều hợp đồng/);
});
test('Document progress counts approved requirements and zero denominator',()=>{
 const tasks=[{required_template_codes:['A','B']}] as Task[];
 const templates=[{id:'a',code:'A'},{id:'b',code:'B'}] as Template[];
 const docs=[{template_id:'a',status:'Signed',deleted_at:null},{template_id:'b',status:'Draft',deleted_at:null}] as Document[];
 assert.deepEqual(documentProgress(tasks,docs,templates),{total:2,valid:1,percent:50});
 assert.deepEqual(documentProgress([],[],[]),{total:0,valid:0,percent:100});
});
test('Upload validation rejects mismatched bytes and unknown types',()=>{
 assert.throws(()=>validateFile(Buffer.from('<script>test</script>'),'a.pdf'),/không khớp/);
 assert.throws(()=>validateFile(Buffer.from('<svg/>'),'a.svg'),/Hỗ trợ/);
 assert.throws(()=>validateFile(Buffer.alloc(0),'a.txt'),/phải có nội dung/);
});
test('CSV neutralizes formula injection and checksum is deterministic',()=>{
 assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
 assert.equal(csvCell('ordinary'),'"ordinary"');
 assert.equal(checksum(Buffer.from('a')),checksum(Buffer.from('a')));
});
