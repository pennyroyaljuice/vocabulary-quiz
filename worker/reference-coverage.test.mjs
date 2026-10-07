import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./vocabulary-generator.js', import.meta.url), 'utf8');
const { parseJapaneseReference: parse, generateFromJapaneseReference: generate } = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { parseJapaneseReference, generateFromJapaneseReference };').toString('base64')}`);
const page = (head, meaning) => `=={{ja}}==\n==={{noun}}===\n${head}\n# ${meaning}`;
const draft = { reading: 'ためし', meaning: '試すこと。', description: '例：試しに使う。', category: '名詞' };
const env = (value = draft) => ({ AI: { run: async (_, o) => ({ response: (o.response_format.json_schema.schema || o.response_format.json_schema).properties.meaning ? value : { supplement: '' } }) } });
const lookup = records => async url => {
    if (url.includes('vocabulary-dictionary')) return Response.json({entries:[{word:'試し',readings:['ためし']}]});
    const word = new URL(url).searchParams.get('page');
    return Response.json(records[word] ? { parse: { title: word, wikitext: records[word] } } : { error: { code: 'missingtitle' } });
};
test('comma-separated and linked readings share a definition without requiring context', async () => {
    for (const head of ["{{jachar|釉|薬}}（ゆうやく、'''[[うわぐすり]]'''）", "'''[[叢]] [[雲]]''' ([[そううん]]、'''[[むらくも]]''')"]) {
        const text = page(head, '同じ意味。');
        assert.equal(parse(text, '試験').candidates.length, 2);
        const result = await generate(env(), { word: '試験' }, lookup({ 試験: text }));
        assert.equal(result.status, 200);
        assert.equal(result.body.vocabulary.referenceCheck, 'dictionary_verified');
    }
});
test('explicit kana references resolve without a user-provided reading', async () => {
    const result = await generate(env(), { word: '幼気' }, lookup({
        幼気: "=={{ja}}==\n===和語の漢字表記===\n#'''[[いたいけ]]''' 参照",
        いたいけ: page("'''いたいけ'''", '幼くかわいらしい様子。').replace('{{noun}}', '{{adjectivenoun}}')
    }));
    assert.equal(result.body.vocabulary.reading, 'いたいけ');
    assert.equal(result.body.vocabulary.referenceCheck, 'dictionary_verified');
});
test('reading-index lookup requires the original spelling in the Japanese headword', async () => {
    for (const spelling of ['試し', '別語']) {
        const pages = lookup({ ためし: page(`'''ためし'''【${spelling}】`, '辞書による意味。') });
        const result = await generate(env(), { word: '試し' }, async url => url.includes('vocabulary-dictionary')
            ? Response.json({ entries: [{ word: '試し', readings: ['ためし'], glosses: ['trial'] }] }) : pages(url));
        assert.equal(result.body.vocabulary.referenceCheck, spelling === '試し' ? 'dictionary_verified' : 'ai_unverified');
    }
});
test('new model chat completion format is decoded and supplied reading is enforced', async () => {
    const model = { AI: { run: async (_, options) => {
        assert.equal(JSON.parse(options.messages[1].content.split('\n').at(-1)).readingHint, 'ためし');
        return { choices: [{ message: { content: JSON.stringify({...draft, reading:'べつのよみ'}) } }] };
    } } };
    const result = await generate(model, { word: '試し', readingHint: 'ためし' }, lookup({}));
    assert.equal(result.body.vocabulary.reading, 'ためし');
});
test('iteration mark spelling finds the dictionary entry without hardcoded vocabulary', async () => {
    const result = await generate(env(), { word: '皓々' }, lookup({ 皓皓: page("'''皓皓'''（こうこう）", '白く輝く様子。') }));
    assert.equal(result.body.vocabulary.reading, 'こうこう');
    assert.equal(result.body.vocabulary.referenceCheck, 'dictionary_verified');
});
test('missing dictionary produces a labeled draft with no invented sources', async () => {
    const result = await generate(env(), { word: '試し' }, lookup({}));
    assert.equal(result.status, 200);
    assert.equal(result.body.vocabulary.referenceCheck, 'ai_unverified');
    assert.equal(result.body.vocabulary.needsReview, true);
    assert.deepEqual(result.body.vocabulary.sources, []);
    assert.match(result.body.vocabulary.comparisonNote, /辞書未確認/);
});
test('fallback uses only the first gloss for the exact word and reading', async () => {
    const model = { AI: { run: async (_, options) => {
        const input = JSON.parse(options.messages[1].content.split('\n').at(-1));
        assert.deepEqual(input.senseHints, ['trial']);
        return { response: draft };
    } } };
    model.DICTIONARY = { fetch: async () => Response.json({entries:[
        {word:'別語',readings:['ためし'],glosses:['wrong word']},
        {word:'試し',readings:['べつ'],glosses:['wrong reading']},
        {word:'試し',readings:['ためし'],glosses:['trial','unrelated second sense']}
    ]}) };
    const result = await generate(model, {word:'試し',readingHint:'ためし'},lookup({}));
    assert.equal(result.body.vocabulary.referenceCheck,'ai_unverified');
});
test('unknown words, mismatched readings and failed review never return a draft', async () => {
    assert.equal(await generate(env(), { word: '架空語' }, lookup({})), null);
    assert.equal((await generate(env(), { word: '試し', readingHint: 'べつ' }, lookup({}))).status, 422);
    assert.equal(await generate(env({ ...draft, meaning: '' }), { word: '試し' }, lookup({})), null);
    let calls = 0;
    const unstable = { AI: { run: async () => { if (++calls === 2) throw Error('offline'); return { response: draft }; } } };
    assert.equal(await generate(unstable, { word: '試し' }, lookup({})), null);
    assert.equal(calls, 2);
});
