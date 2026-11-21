import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const roots=['src','templates','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','next.config.ts','tsconfig.json','next-env.d.ts'];
const files=[];
function walk(file){const stat=fs.statSync(file);if(stat.isDirectory()){for(const child of fs.readdirSync(file))walk(path.join(file,child));}else{const bytes=fs.readFileSync(file);files.push({file:file.replaceAll('\\','/'),sha:crypto.createHash('sha1').update(bytes).digest('hex'),size:bytes.length});}}
for(const root of roots)walk(root);
if(process.argv[2]==='list')console.log(JSON.stringify(files));
else if(process.argv[2]==='chunk') {
 const file=process.argv[3],offset=Number(process.argv[4]||0),length=Number(process.argv[5]||32768);
 if(!files.some(f=>f.file===file))throw new Error('File not included in deployment');
 console.log(fs.readFileSync(file).subarray(offset,offset+length).toString('base64'));
}else if(process.argv[2]==='text') {
 const file=process.argv[3];if(!files.some(f=>f.file===file))throw new Error('File not included');console.log(JSON.stringify(fs.readFileSync(file,'utf8')));
}
