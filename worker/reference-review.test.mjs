import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from './vocabulary-generator.js';
const source = await readFile(new URL('./vocabulary-generator.js', import.meta.url), 'utf8');
const { translateDictionaryEntry, generateFromJapaneseReference } = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { translateDictionaryEntry, generateFromJapaneseReference };').toString('base64')}`);
test('御斎 and spelling variants use a reviewed Japanese definition without AI', async () => {
 for (const word of ['御斎','お斎','御齋']) {
  const response = await worker.fetch(new Request('https://example.test',{method:'POST',headers:{Origin:'http://localhost:5500','Content-Type':'application/json'},body:JSON.stringify({word})}),{AI:{run(){throw Error('must not call AI');}}});
  const {vocabulary:v} = await response.json();
  assert.equal(response.status,200); assert.equal(v.reading,'おとき');
  assert.match(v.meaning,/仏事/); assert.doesNotMatch(v.meaning+v.description,/キリスト|聖餐|断食/);
  assert.equal(v.referenceCheck,'editor_verified'); assert.equal(v.sources.length,2);
 }
});
test('a religious mistranslation is rejected, retried against the original and never returned', async () => {
 const input={word:'試験語',readingHint:'しけんご',contextHint:'',dictionaryHint:'読み: しけんご\n品詞: n\n意味: meal after a Buddhist service'};
 for(const mode of ['reject','malformed','offline','recover']) {
  let translations=0; let reviews=0;
  const result=await translateDictionaryEntry({AI:{run:async (_,o)=>{
   const fields=o.response_format.json_schema.properties;
   if(fields.approved){reviews++;const i=JSON.parse(o.messages[1].content);assert.match(i.referenceGloss,/Buddhist/);
    if(mode==='offline')throw Error('offline');
    return {response:mode==='malformed'?{approved:'true'}:{approved:mode==='recover'&&reviews===2,reason:'仏教をキリスト教に取り違えている'}};
   }
   if(fields.meaning){translations++;return {response:{meaning:translations===2&&mode==='recover'?'仏事の後に取る食事。':'キリスト教の聖餐。',description:''}};}
   return {response:{supplement:''}};
  }}},input);
  assert.equal(translations,2);assert.equal(reviews,2);
  assert.equal(result.status,mode==='recover'?200:422);
  if(mode==='recover')assert.match(result.body.vocabulary.meaning,/仏事/);else assert.equal(result.body.vocabulary,undefined);
 }
});
test('斎 requires a reading and the とき sense stays Buddhist even with misleading English',async()=>{
 for(const readingHint of ['', 'とき', 'トキ']){
  const response=await worker.fetch(new Request('https://example.test',{method:'POST',headers:{Origin:'http://localhost:5500','Content-Type':'application/json'},body:JSON.stringify({word:'斎',readingHint,dictionaryHint:'読み: とき\n品詞: n\n意味: meals exchanged by parishioners and priests'})}),{AI:{run(){throw Error('must not call AI');}}});
  const body=await response.json();assert.equal(response.status,readingHint?200:422);
  if(readingHint){assert.equal(body.vocabulary.reading,'とき');assert.match(body.vocabulary.meaning,/仏事/);assert.doesNotMatch(body.vocabulary.meaning,/司祭|教区|キリスト/);}
  else assert.match(body.error,/読みで意味が変わります/);
 }
});
test('failed Japanese selection without context never falls back to the first definition',async()=>{
 const fetcher=async()=>Response.json({parse:{title:'試験語',wikitext:"==日本語==\n===名詞===\n'''試験語'''（しけんご）\n# 第一の意味。\n# 第二の意味。"}});
 const result=await generateFromJapaneseReference({AI:{run:async()=>({response:{id:-1}})}},{word:'試験語'},fetcher);
 assert.equal(result.status,422);
});
