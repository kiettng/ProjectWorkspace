import test from 'node:test';
import assert from 'node:assert/strict';
import { moveId } from '../src/lib/reorder';

test('moving rows up and down keeps every sibling exactly once',()=>{
 const ids=['one','two','three','four'];
 assert.deepEqual(moveId(ids,'four','two'),['one','four','two','three']);
 assert.deepEqual(moveId(ids,'one','three'),['two','three','one','four']);
 assert.deepEqual(ids,['one','two','three','four']);
});

test('unknown or same row does not change order',()=>{
 const ids=['one','two'];
 assert.equal(moveId(ids,'one','one'),ids);
 assert.equal(moveId(ids,'missing','two'),ids);
});
