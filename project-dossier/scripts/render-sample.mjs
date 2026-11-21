import fs from 'node:fs/promises';
import { renderWord } from '../src/lib/word.ts';
await fs.mkdir('tmp/qa',{recursive:true});
const values={CustomerName:'Công ty Kiểm Thử',ContractNo:'BRAVO/TEST/2026/001',ContractSignedDate:'21/11/2026',DocumentDate:'21/11/2026',DocumentNo:'KTKS/TEST/20261121-01',ProjectManager:'Người kiểm thử',ProjectStartDate:'21/11/2026',ProjectEndDate:'21/12/2026'};
for(const code of ['BM.40.08','PL.40.02.01'])await fs.writeFile(`tmp/qa/${code}.docx`,renderWord(await fs.readFile(`templates/${code}.docx`),values));
console.log('QA documents written.');
