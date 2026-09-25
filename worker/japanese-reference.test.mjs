import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as deployedModule from './vocabulary-generator.js';
// 補助関数の公開はテスト用のメモリー上のコピーにだけ追加する。
const workerSource = await readFile(new URL('./vocabulary-generator.js', import.meta.url), 'utf8');
const testSource = workerSource + '\nexport { parseJapaneseReference, generateFromJapaneseReference };';
const { parseJapaneseReference, generateFromJapaneseReference } = await import(
    `data:text/javascript;base64,${Buffer.from(testSource).toString('base64')}`
);
test('deployable module exposes only the default Worker handler', () => {
    assert.deepEqual(Object.keys(deployedModule), ['default']);
    assert.equal(typeof deployedModule.default.fetch, 'function');
});
const records = JSON.parse(await readFile(new URL('./evaluation/japanese-reference.json', import.meta.url), 'utf8'));
const lookup = (word) => records.find((record) => record.word === word)?.response;
const fetcher = async (url) => Response.json(lookup(new URL(url).searchParams.get('page')) || { error: { code: 'missingtitle' } });
const parsed = (word) => parseJapaneseReference(lookup(word)?.parse?.wikitext, word);
test('all ten known reference pages contain usable Japanese reading-definition pairs', () => {
    for (const record of records.filter((record) => record.response.parse)) {
        assert.ok(parsed(record.word).candidates.length > 0, record.word);
    }
});
test('organism and biology remain separate and foreign-language definitions are excluded', () => {
    const { candidates, redirects } = parsed('生物');
    assert.ok(candidates.some((item) => item.reading === 'せいぶつ' && item.meaning.startsWith('生命')));
    assert.ok(candidates.some((item) => item.meaning.includes('生物学の略語')));
    assert.ok(!candidates.some((item) => item.meaning.includes('日本語の語義')));
    assert.ok(redirects.includes('なまもの'));
});
test('modern Japanese excludes Old Japanese entries', () => {
    const { candidates } = parsed('なまもの');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].reading, 'なまもの');
    assert.match(candidates[0].meaning, /加工/);
});
test('multiple Japanese readings require context instead of silently selecting one', async () => {
    const result = await generateFromJapaneseReference({ AI: { run: async () => ({ response: { id: 0 } }) } }, { word: '生物' }, fetcher);
    assert.equal(result.status, 422);
    assert.match(result.body.error, /読みで意味が変わる/);
    assert.equal(result.body.vocabulary, undefined);
});
test('kanji reference to the requested kana entry resolves without mixing senses', async () => {
    const result = await generateFromJapaneseReference({ AI: { run: async () => { throw new Error('No selection needed'); } } }, { word: '生物', readingHint: 'なまもの' }, fetcher);
    assert.equal(result.status, 200);
    assert.equal(result.body.vocabulary.reading, 'なまもの');
    assert.match(result.body.vocabulary.meaning, /加熱/);
});
test('incorrect meanings in model output cannot replace the selected definition', async () => {
    const result = await generateFromJapaneseReference({ AI: { run: async () => ({ response: { id: 1, meaning: '能力が不足している' } }) } }, { word: '役不足' }, fetcher);
    assert.match(result.body.vocabulary.meaning, /軽すぎる/);
    assert.equal(result.body.vocabulary.reading, 'やくぶそく');
});
test('unknown word and unavailable service report no Japanese reference', async () => {
    const env = { AI: { run: async () => { throw new Error('Must not invent unknown words'); } } };
    assert.equal(await generateFromJapaneseReference(env, { word: '雲菓量子ぽよ' }, fetcher), null);
    assert.equal(await generateFromJapaneseReference(env, { word: '生物' }, async () => { throw new Error('offline'); }), null);
});
test('invalid context selection is not silently replaced with an unrelated sense', async () => {
    const result = await generateFromJapaneseReference({ AI: { run: async () => ({ response: { id: 999 } }) } }, { word: '生物', contextHint: '授業' }, fetcher);
    assert.equal(result.status, 422);
});

test('supplement uses the selected definition and preserves attribution and reading', async () => {
    const result = await generateFromJapaneseReference({ AI: { run: async (_model, options) => {
        const input = JSON.parse(options.messages[1].content);
        assert.match(input.meaning, /次第/);
        assert.equal(input.reading, 'ぜんじ');
        return { response: { supplement: '少しずつ変化する場面で使います。例：状況は漸次改善した。', meaning: '別の意味', reading: 'ぜんじつ' } };
    } } }, { word: '漸次' }, fetcher);
    assert.match(result.body.vocabulary.description, /補足（AI生成）：/);
    assert.match(result.body.vocabulary.description, /出典：/);
    assert.match(result.body.vocabulary.meaning, /次第/);
    assert.equal(result.body.vocabulary.reading, 'ぜんじ');
});

test('supplement failure does not discard dictionary results', async () => {
    const result = await generateFromJapaneseReference({ AI: { run: async () => { throw new Error('AI unavailable'); } } }, { word: '漸次' }, fetcher);
    assert.equal(result.status, 200);
    assert.match(result.body.vocabulary.meaning, /次第/);
    assert.match(result.body.vocabulary.description, /^出典：/);
});

test('only the reviewed supplement is returned and rejected drafts are omitted', async () => {
    for (const corrected of ['変化の進み方を説明するときに使います。例：状況は漸次改善した。', '']) {
        let calls = 0;
        const draft = '未校閲の説明。例：漸次。';
        const result = await generateFromJapaneseReference({ AI: { run: async (_model, options) => {
            calls++;
            if (calls === 1) return { response: { supplement: draft } };
            assert.equal(JSON.parse(options.messages[1].content).draft, draft);
            return { response: { supplement: corrected } };
        } } }, { word: '漸次' }, fetcher);
        assert.equal(calls, 2);
        assert.ok(!result.body.vocabulary.description.includes(draft));
        assert.equal(result.body.vocabulary.description.includes('補足（AI生成）'), Boolean(corrected));
        if (corrected) assert.ok(result.body.vocabulary.description.includes(corrected));
        assert.match(result.body.vocabulary.meaning, /次第/);
    }
});

test('review outage never exposes an unreviewed draft', async () => {
    let calls = 0;
    const result = await generateFromJapaneseReference({ AI: { run: async () => {
        if (++calls === 1) return { response: { supplement: '未校閲の補足。' } };
        throw new Error('Review unavailable');
    } } }, { word: '漸次' }, fetcher);
    assert.equal(result.status, 200);
    assert.match(result.body.vocabulary.description, /^出典：/);
});
