const { chromium } = require(process.env.VOCAB_TEST_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        if (process.env.VOCAB_TEST_LOCAL_SCRIPT) {
            for (const name of ['storage', 'addWords', 'pack-preview']) {
                await page.route(`**/js/${name}.js*`, route => route.fulfill({ path: `js/${name}.js`, contentType: 'application/javascript' }));
            }
        }
        await page.goto('https://pennyroyaljuice.github.io/vocabulary-quiz/');
        await page.getByRole('button', { name: '設定', exact: true }).waitFor();
        const cleaned = await page.evaluate(() => {
            const source = { title: '辞書', url: 'https://example.com' };
            Storage.addVocabularyPack({ packId: 'test', words: [{ word: '確認', meaning: '確かめる。\n出典：辞書', description: '補足（AI生成）：例：確認する。\n\n出典：辞書\nhttps://example.com', sources: [source] }] });
            const word = Storage.getVocabulary()[0];
            Storage.removeVocabularyPack('test');
            return word;
        });
        assert.equal(cleaned.meaning, '確かめる。');
        assert.equal(cleaned.description, '例：確認する。');
        assert.equal(cleaned.sources[0].url, 'https://example.com');
        await page.evaluate(() => Router.show('packPreview', { packId: 'beginner-100', trial: true }));
        for (let i = 0; i < 10; i++) {
            await page.locator('[data-choice]').first().click();
            if (i === 0) {
                await page.locator('[data-add-word]').click();
                await page.getByText('自分の語彙に追加済み', { exact: true }).waitFor();
                assert.equal(await page.locator('[data-add-word]').isDisabled(), true);
                assert.equal(await page.evaluate(() => Storage.getVocabulary().length), 1);
                assert.equal(await page.evaluate(() => Quiz.getWords().length), 1);
            }
            await page.getByRole('button', { name: i === 9 ? '結果を見る' : '次の問題へ', exact: true }).click();
        }
        assert.equal(await page.locator('[data-add-word]:disabled').count(), 1);
        await page.locator('[data-add-word]:enabled').first().click();
        await page.waitForFunction(() => Storage.getVocabulary().length === 2);
        assert.equal(await page.evaluate(() => Storage.getVocabulary().every(word => word.packId === 'beginner-100')), true);
        await page.evaluate(() => Storage.removeVocabularyPack('beginner-100'));
        assert.equal(await page.evaluate(() => Storage.getVocabulary().length), 0);
        console.log('PASS: saved attribution cleanup, individual trial and result imports, duplicate prevention, quiz reload, pack removal');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
