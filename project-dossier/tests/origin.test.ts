import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameRequestOrigin} from '../src/lib/request-origin';

test('A normalized local request accepts the actual browser host',()=>{
 const request=new Request('http://localhost:3000/api/action',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}});
 assert.equal(sameRequestOrigin(request),true);
});
test('Production same-origin mutations remain valid',()=>{
 assert.equal(sameRequestOrigin(new Request('https://dossier.example/api/action',{headers:{host:'dossier.example',origin:'https://dossier.example'}})),true);
});
test('Missing, null and foreign origins are rejected',()=>{
 for(const origin of ['', 'null','https://attacker.example','https://dossier.example.attacker.example']){
  assert.equal(sameRequestOrigin(new Request('https://dossier.example/api/action',{headers:{host:'dossier.example',...(origin?{origin}:{})}})),false);
 }
});
test('A different scheme or port is rejected',()=>{
 for(const origin of ['http://dossier.example','https://dossier.example:3000']){
  assert.equal(sameRequestOrigin(new Request('https://dossier.example/api/action',{headers:{host:'dossier.example',origin}})),false);
 }
});
