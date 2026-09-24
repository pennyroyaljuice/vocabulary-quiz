const { chromium } = require(process.env.VOCAB_TEST_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage();
  const calls = [];
  if(process.env.VOCAB_TEST_LOCAL_SCRIPT) for(const name of ['storage','settings','addWords']) await page.route(`**/js/${name}.js*`,r=>r.fulfill({path:`js/${name}.js`,contentType:'application/javascript'}));
  await page.route('https://vocabulary-dictionary.*/**',r=>r.fulfill({json:{found:false}}));
  await page.route('https://vocabulary-generator.*/**', async r=>{
   const {word} = r.request().postDataJSON(); calls.push(word);
   await r.fulfill(word === '失敗語' ? {status:500,json:{error:'試験用の失敗'}} : {json:{vocabulary:{word,reading:'かくにん',meaning:'意味の確認。',description:'具体的には、使う場面の説明。例：試してみる。',quizTypes:['wordToMeaning']}}});
  });
  await page.goto('https://pennyroyaljuice.github.io/vocabulary-quiz/');
  await page.getByRole('button',{name:'設定',exact:true}).click();
  assert.equal(await page.locator('#autoGenerateWordsToggle').isChecked(),true);
  await page.evaluate(()=>Router.show('addWords'));
  await page.locator('#newWordsInput').fill('試験語\n試験語\n失敗語\n確認語');
  await page.locator('#checkNewWordsButton').click();
  await page.waitForFunction(()=>Storage.getPendingWords().filter(w=>w.status==='generated').length===2);
  assert.deepEqual(calls,['試験語','失敗語','確認語']);
  assert.equal(await page.evaluate(()=>Storage.getPendingWords().find(w=>w.word==='試験語').description),'使う場面の説明。例：試してみる。');
  assert.equal(await page.evaluate(()=>Storage.getVocabulary().length),0);
  await page.getByText(/生成できませんでした。開いて再試行/).waitFor();
  await page.evaluate(()=>Router.show('settings'));
  await page.locator('#autoGenerateWordsToggle').uncheck();
  await page.reload();
  await page.getByRole('button',{name:'設定',exact:true}).click();
  assert.equal(await page.locator('#autoGenerateWordsToggle').isChecked(),false);
  await page.evaluate(()=>Router.show('addWords'));
  await page.locator('#newWordsInput').fill('手動語');
  await page.locator('#checkNewWordsButton').click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(calls.length,3);
  assert.equal(await page.evaluate(()=>Storage.getPendingWords().find(w=>w.word==='手動語').meaning),'');
  console.log('PASS: automatic sequential generation, duplicate skip, failure recovery, prefix cleanup, persisted OFF');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
