const { chromium } = require(process.env.VOCAB_TEST_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        if (process.env.VOCAB_TEST_LOCAL_SCRIPT) {
            await page.route('**/js/addWords.js*', route => route.fulfill({ path: 'js/addWords.js', contentType: 'application/javascript' }));
        }
        await page.route('https://vocabulary-dictionary.*/**', route => route.fulfill({ json: { found: false } }));
        await page.route('https://vocabulary-generator.*/**', route => route.fulfill({ json: { vocabulary: {
            word: '確認用語', reading: 'かくにんようご', meaning: '動作を確認するための語。',
            description: '補足（AI生成）：動作確認で使う。例：確認用語を入力する。', quizTypes: ['wordToMeaning']
        } } }));
        await page.goto('https://pennyroyaljuice.github.io/vocabulary-quiz/');
        await page.getByRole('button', { name: '設定', exact: true }).waitFor();
        await page.evaluate(() => {
            Storage.updateSetting('autoGenerateWords', false);
            Storage.addVocabularyPack({ packId: 'feedback-test', name: '確認用', words: [
                { word: '既存語', reading: 'きそんご', meaning: '既存の意味 <確認>', quizTypes: ['wordToMeaning'] }
            ] });
            Router.show('addWords');
        });
        await page.locator('#newWordsInput').fill('既存語\n確認用語\n確認用語');
        await page.locator('#checkNewWordsButton').click();
        const duplicates = await page.locator('.duplicate-group').innerText();
        assert.match(duplicates, /既存語：既存の意味 <確認>/);
        assert.match(duplicates, /確認用語：意味は未登録です（登録待ち）/);
        await page.locator('[data-edit-custom-word]').first().click();
        await page.locator('#regenerateWordButton').click();
        await page.getByText('AI生成が完了しました。内容を確認してください。', { exact: true }).waitFor();
        assert.equal(await page.locator('[data-field="description"]').inputValue(), '動作確認で使う。例：確認用語を入力する。');
        await page.locator('[data-field="word"]').fill('既存語');
        await page.locator('#finalizeWordButton').click();
        await page.getByText('「既存語」と重複しています。', { exact: false }).waitFor();
        assert.match(await page.locator('.custom-word-message').innerText(), /既存の意味 <確認>/);
        console.log('PASS: duplicate meanings, pending fallback, safe text, AI supplement label removal, editor duplicate');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
