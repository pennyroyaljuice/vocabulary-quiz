import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import worker from '../worker/vocabulary-sharing.js';

const FORMAT = globalThis.VocabularyShareFormat;
const schema = await readFile(new URL('../worker/sharing-schema.sql', import.meta.url), 'utf8');
const storageSource = await readFile(new URL('../js/storage.js', import.meta.url), 'utf8');
const formatSource = await readFile(new URL('../js/share-format.js', import.meta.url), 'utf8');
const sample = { word: '敷衍', reading: 'ふえん', meaning: '趣旨を詳しく説明すること。', description: '例：議論を敷衍する。', category: '一般', quizTypes: ['wordToMeaning', 'meaningToWord', 'reading'] };
function environment() {
    const database = new DatabaseSync(':memory:');
    database.exec(schema);
    const prepare = (sql, values = []) => ({
        bind: (...args) => prepare(sql, args),
        first: async () => database.prepare(sql).get(...values) || null,
        run: async () => ({ meta: { changes: database.prepare(sql).run(...values).changes } })
    });
    return { DB: { prepare }, close: () => database.close() };
}
function request(path, method = 'GET', body, headers = {}) {
    return new Request('https://sharing.test' + path, { method, headers: { Origin: 'https://pennyroyaljuice.github.io', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function user() {
    const values = new Map();
    const context = vm.createContext({ console, URL, TextEncoder, localStorage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)
    } });
    vm.runInContext(formatSource, context);
    vm.runInContext(storageSource, context);
    return vm.runInContext('Storage', context);
}

test('publish, download, import and remove preserve recipient vocabulary and stats', async () => {
    const env = environment();
    try {
        const source = { ...sample, id: 'sender-id', packId: 'beginner-100', stats: { correct: 999 }, favorite: true };
        const response = await worker.fetch(request('/shares', 'POST', { name: '読書メモ', words: [source, { ...sample, word: '韜晦', reading: 'とうかい' }], syncSecret: 'must-not-share' }), env);
        assert.equal(response.status, 201);
        const created = await response.json();
        assert.match(created.code, /^\d{24}$/);
        const downloaded = await (await worker.fetch(request(`/shares/${created.code}`), env)).json();
        assert.equal(downloaded.deleteToken, undefined);
        assert.equal(downloaded.owner_hash, undefined);
        assert.equal(downloaded.syncSecret, undefined);
        assert.equal(downloaded.words[0].id, undefined);
        assert.equal(downloaded.words[0].packId, undefined);
        assert.equal(downloaded.words[0].favorite, undefined);
        assert.equal(downloaded.words[0].stats, undefined);
        const recipient = user();
        recipient.addVocabularyPack({ packId: 'mine', words: [{ ...sample, description: '自分の補足' }] });
        const own = recipient.getVocabulary()[0];
        recipient.updateStats(own.id, true);
        const result = recipient.addSharedVocabulary(downloaded);
        assert.equal(result.addedCount, 1);
        assert.equal(result.skippedCount, 1);
        assert.equal(recipient.getSharedVocabularyPacks()[0].count, 1);
        assert.equal(recipient.addSharedVocabulary(downloaded).addedCount, 0);
        const imported = recipient.getVocabulary().find(word => word.word === '韜晦');
        assert.notEqual(imported.id, 'sender-id');
        recipient.updateStats(imported.id, false);
        recipient.updateVocabularyWord(imported.id, { description: '取り込み後の編集' });
        assert.equal(recipient.removeSharedVocabulary(created.code).removedCount, 1);
        assert.equal(recipient.getVocabulary().length, 1);
        assert.equal(recipient.getVocabulary()[0].description, '自分の補足');
        assert.equal(recipient.getStats()[own.id].correct, 1);
        assert.equal(recipient.getStats()[imported.id], undefined);
        assert.equal(recipient.getSharedVocabularyPacks().length, 0);
        // 受信者のローカル削除で公開元は消えない。
        assert.equal((await worker.fetch(request(`/shares/${created.code}`), env)).status, 200);
        assert.equal((await worker.fetch(request(`/shares/${created.code}`, 'DELETE'), env)).status, 403);
        assert.equal((await worker.fetch(request(`/shares/${created.code}`, 'DELETE', null, { 'X-Delete-Token': 'a'.repeat(64) }), env)).status, 404);
        assert.equal((await worker.fetch(request(`/shares/${created.code}`, 'DELETE', null, { 'X-Delete-Token': created.deleteToken }), env)).status, 200);
        assert.equal((await worker.fetch(request(`/shares/${created.code}`), env)).status, 404);
    } finally { env.close(); }
});

test('separate uploads get separate immutable codes', async () => {
    const env = environment();
    try {
        const first = await (await worker.fetch(request('/shares', 'POST', { name: '版1', words: [sample] }), env)).json();
        const second = await (await worker.fetch(request('/shares', 'POST', { name: '版2', words: [{ ...sample, meaning: '更新後の意味。' }] }), env)).json();
        assert.notEqual(first.code, second.code);
        const old = await (await worker.fetch(request(`/shares/${first.code}`), env)).json();
        assert.equal(old.words[0].meaning, sample.meaning);
    } finally { env.close(); }
});

test('shared origin survives backup export/import and another set is not removed', () => {
    const recipient = user();
    const first = { name: 'A', code: '0'.repeat(24), words: [sample] };
    const second = { name: 'B', code: '1'.repeat(24), words: [sample, { ...sample, word: '斟酌' }] };
    recipient.addSharedVocabulary(first);
    assert.equal(recipient.addSharedVocabulary(second).skippedCount, 1);
    const restored = user();
    restored.mergeBackup(recipient.exportBackup());
    assert.equal(restored.getSharedVocabularyPacks().length, 2);
    restored.removeSharedVocabulary(first.code);
    assert.equal(restored.getVocabulary().length, 1);
    assert.equal(restored.getVocabulary()[0].word, '斟酌');
});

test('pending words are not overwritten by a shared set', () => {
    const recipient = user();
    recipient.addUnifiedPendingWords([{ word: sample.word }]);
    assert.equal(recipient.addSharedVocabulary({ name: 'A', code: '2'.repeat(24), words: [sample] }).addedCount, 0);
    assert.equal(recipient.getPendingWords().length, 1);
    assert.equal(recipient.getSharedVocabularyPacks().length, 0);
});

test('format strips internal data and unsafe source URLs, supports formatted codes', () => {
    const pack = FORMAT.normalizePack({ name: '共有', words: [{ ...sample, note: '旧メモ', deleteToken: 'secret', sources: [
        { title: '不正', url: 'javascript:alert(1)' }, { title: '辞書', url: 'https://example.com/word' }
    ] }] });
    assert.equal(pack.words[0].deleteToken, undefined);
    assert.equal(pack.words[0].sources.length, 1);
    assert.equal(FORMAT.normalizeCode('００００-１１１１-２２２２-３３３３-４４４４-５５５５'), '000011112222333344445555');
    assert.throws(() => FORMAT.normalizeCode('1234'));
});

test('invalid/oversized input, disallowed origin and rate limits fail without storing', async () => {
    const env = environment();
    try {
        for (const body of [{ name: '空', words: [] }, { name: '多すぎる', words: Array(2001).fill(sample) }, { name: '不正', words: [{ ...sample, meaning: '' }] }]) {
            assert.equal((await worker.fetch(request('/shares', 'POST', body), env)).status, 400);
        }
        const oversized = new Request('https://sharing.test/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(1000001) });
        assert.equal((await worker.fetch(oversized, env)).status, 400);
        assert.equal((await worker.fetch(request('/shares', 'POST', { name: 'A', words: [sample] }, { Origin: 'https://untrusted.example' }), env)).status, 403);
        env.UPLOAD_LIMIT = { limit: async () => ({ success: false }) };
        assert.equal((await worker.fetch(request('/shares', 'POST', { name: 'A', words: [sample] }), env)).status, 429);
        assert.equal(await env.DB.prepare('SELECT code FROM shared_vocabulary LIMIT 1').first(), null);
    } finally { env.close(); }
});
