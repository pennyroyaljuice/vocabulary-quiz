const { chromium } = require(process.env.VOCAB_TEST_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const base = process.env.VOCAB_TEST_URL || 'http://127.0.0.1:5500';
    const errors = [];
    let management;
    try {
        const sender = await browser.newContext({ viewport: { width: 1200, height: 900 } });
        const receiver = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const owner = await sender.newPage();
        const guest = await receiver.newPage();
        for (const page of [owner, guest]) page.on('pageerror', error => errors.push(error.message));
        await owner.goto(base);
        await owner.getByRole('button', { name: '設定', exact: true }).click();
        await owner.getByRole('button', { name: '語彙を共有', exact: true }).waitFor();
        await owner.evaluate(async () => {
            Storage.addVocabularyPack({ packId: 'test-source', words: [
                { word: '共有試験既存語', reading: 'きぞんご', meaning: '動作確認用の既存語。', description: '送信者の補足。', category: '試験' },
                { word: '共有試験追加語', reading: 'ついかご', meaning: '動作確認用の追加語。', description: '例：動作確認のための語です。', category: '試験' }
            ] });
            await App.reloadWords();
        });
        await owner.getByRole('button', { name: '語彙を共有', exact: true }).click();
        await owner.locator('#shareName').fill('動作確認 <b>共有セット</b>');
        await owner.getByRole('button', { name: '現在の2語を公開する', exact: true }).click();
        await owner.locator('#publishResult').filter({ hasText: '公開しました。' }).waitFor({ timeout: 40000 });
        const message = await owner.locator('#publishResult').innerText();
        const code = message.match(/(?:\d{4}-){5}\d{4}/)[0];
        management = await owner.evaluate(() => JSON.parse(localStorage.getItem('vocabularyQuizPublishedSharesV1')).at(-1));
        assert.equal(await owner.locator('#publishedShares h4').innerText(), '動作確認 <b>共有セット</b>');
        assert.equal(await owner.locator('#publishedShares h4 b').count(), 0);
        await guest.goto(base);
        await guest.getByRole('button', { name: '設定', exact: true }).click();
        await guest.getByRole('button', { name: '語彙を共有', exact: true }).waitFor();
        await guest.evaluate(async () => {
            Storage.addVocabularyPack({ packId: 'existing', words: [{ word: '共有試験既存語', reading: 'きぞんご', meaning: '受信者自身の意味。', description: '消してはいけない補足。', category: '自分' }] });
            Storage.updateStats(Storage.getVocabulary()[0].id, true);
            await App.reloadWords();
        });
        await guest.getByRole('button', { name: '語彙を共有', exact: true }).click();
        await guest.locator('#shareCode').fill(code);
        await guest.getByRole('button', { name: '内容を確認する' }).click();
        await guest.getByRole('button', { name: 'このセットを取り込む' }).waitFor({ timeout: 40000 });
        assert.match(await guest.locator('#sharePreview').innerText(), /新しく追加：1語 · 重複：1語/);
        await guest.getByRole('button', { name: 'このセットを取り込む' }).click();
        await guest.locator('#sharePreview .share-message').filter({ hasText: '1語を追加しました。' }).waitFor();
        assert.equal(await guest.evaluate(() => Storage.getVocabulary().length), 2);
        // 再読込後も、取り込み元を追跡できる。
        await guest.reload();
        await guest.getByRole('button', { name: '設定', exact: true }).click();
        await guest.getByRole('button', { name: '語彙を共有', exact: true }).click();
        await fs.mkdir('tests/artifacts', { recursive: true });
        await guest.screenshot({ path: 'tests/artifacts/sharing-mobile.png', fullPage: true, animations: 'disabled' });
        assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        guest.on('dialog', dialog => dialog.accept());
        await guest.getByRole('button', { name: 'このセットの語彙を削除', exact: true }).click();
        await guest.locator('#importedShares').filter({ hasText: '1語を削除しました。' }).waitFor();
        const kept = await guest.evaluate(() => ({ words: Storage.getVocabulary(), stats: Storage.getStats() }));
        assert.equal(kept.words.length, 1);
        assert.equal(kept.words[0].description, '消してはいけない補足。');
        assert.equal(kept.stats[kept.words[0].id].correct, 1);
        await owner.screenshot({ path: 'tests/artifacts/sharing-desktop.png', fullPage: true, animations: 'disabled' });
        owner.on('dialog', dialog => dialog.accept());
        await owner.getByRole('button', { name: '公開を停止', exact: true }).click();
        await owner.locator('#publishedShares').filter({ hasText: '公開したセットはありません。' }).waitFor({ timeout: 40000 });
        management = null;
        await guest.locator('#shareCode').fill(code);
        await guest.getByRole('button', { name: '内容を確認する' }).click();
        await guest.locator('#sharePreview').filter({ hasText: '共有セットが見つかりません。' }).waitFor({ timeout: 40000 });
        assert.deepEqual(errors, []);
        console.log('PASS: publish -> preview -> import (deduplicate) -> reload -> remove locally -> revoke -> unavailable; desktop/mobile; no page errors');
    } finally {
        if (management) {
            const response = await fetch(`https://vocabulary-sharing.pennyroyal-juice.workers.dev/shares/${management.code}`, { method: 'DELETE', headers: { 'X-Delete-Token': management.deleteToken } });
            if (!response.ok) console.error('Test share cleanup failed:', response.status);
        }
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
