const { chromium } = require(process.env.VOCAB_TEST_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.env.VOCAB_TEST_URL || 'http://127.0.0.1:5500');
        await page.getByRole('button', { name: '設定', exact: true }).click();
        await page.getByRole('button', { name: '語彙パック', exact: true }).click();
        const original = await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), normalWords: Quiz.getWords().length }));
        for (const pack of ['beginner-100', 'intermediate-100', 'advanced-100']) {
            await page.locator(`[data-pack-preview="${pack}"]`).click();
            await page.getByText('100語中 100語を表示', { exact: true }).waitFor();
            assert.equal(await page.locator('.pack-word-preview > li').count(), 100);
            await page.locator('#packSearch').fill('存在しない検索語xyz');
            await page.getByText('一致する語彙はありません。', { exact: true }).waitFor();
            await page.locator('#packSearch').fill('');
            assert.equal(await page.locator('.pack-word-preview > li').count(), 100);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.getByRole('button', { name: '語彙パックへ戻る', exact: true }).click();
            await page.locator(`[data-pack-trial="${pack}"]`).click();
            for (let index = 0; index < 10; index++) {
                await page.locator('[data-choice="0"]').click();
                await page.locator('.pack-trial-feedback h3').waitFor();
                if (pack === 'intermediate-100' && index === 0) {
                    await fs.mkdir('tests/artifacts', { recursive: true });
                    await page.screenshot({ path: 'tests/artifacts/pack-trial-mobile.png', fullPage: true, animations: 'disabled' });
                }
                await page.getByRole('button', { name: index === 9 ? '結果を見る' : '次の問題へ', exact: true }).click();
            }
            await page.getByRole('heading', { name: /お試し結果/ }).waitFor();
            assert.equal(await page.locator('.pack-word-preview > li').count(), 10);
            const after = await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), normalWords: Quiz.getWords().length }));
            assert.deepEqual(after, original);
            await page.getByRole('button', { name: '100語の一覧へ', exact: true }).click();
            await page.getByRole('combobox', { name: 'お試しの問題数' }).selectOption('100');
            await page.getByRole('button', { name: 'お試しクイズを始める', exact: true }).click();
            await page.getByText(/1 \/ 100問/).waitFor();
            await page.getByRole('button', { name: 'お試しを終了して一覧へ', exact: true }).click();
            await page.getByRole('button', { name: '語彙パックへ戻る', exact: true }).click();
        }
        // 一覧からの追加は明示的なボタン操作の時だけ行う。
        await page.setViewportSize({ width: 1200, height: 900 });
        await page.locator('[data-pack-preview="intermediate-100"]').click();
        await page.getByText('100語中 100語を表示', { exact: true }).waitFor();
        await page.locator('#packSearch').fill('ふえん');
        assert.equal(await page.locator('.pack-word-preview > li').count(), 1);
        await page.getByText('補足説明', { exact: true }).click();
        await page.screenshot({ path: 'tests/artifacts/pack-list-desktop.png', fullPage: true, animations: 'disabled' });
        await page.getByRole('button', { name: 'この100語を追加する', exact: true }).click();
        await page.getByText('100語を追加しました。登録済み・登録待ちの0語は追加していません。', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => Storage.getVocabulary().length), 100);
        assert.equal(await page.evaluate(() => Quiz.getWords().length), 100);
        await page.getByRole('button', { name: '語彙パックへ戻る', exact: true }).click();
        await page.route('**/packs/advanced-100.json', route => route.fulfill({ status: 503, body: '{}' }));
        await page.locator('[data-pack-preview="advanced-100"]').click();
        await page.getByText('語彙パックを読み込めませんでした。(503)', { exact: true }).waitFor();
        await page.getByRole('button', { name: '語彙パックへ戻る', exact: true }).click();
        assert.deepEqual(errors, []);
        console.log('PASS: all 300 words, search, 3 trial quizzes, feedback/results, 100-question mode, no storage changes, explicit add, fetch failure');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
