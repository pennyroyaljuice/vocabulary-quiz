import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './vocabulary-generator.js';
const dictionaryHint = '候補1\n読み: せいぶつ\n品詞: n\n意味: living thing; organism; biology\n\n候補2\n読み: なまもの\n品詞: n\n意味: raw food; perishables';
async function generate(input, outputs = [{ meaning: '生命をもつもの。', description: '' }]) {
    const calls = [];
    const response = await worker.fetch(new Request('https://example.test', {
        method: 'POST', headers: { Origin: 'http://localhost:5500', 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: '生物', readingHint: 'せいぶつ', dictionaryHint, ...input })
    }), { AI: { run: async (model, options) => {
        calls.push(options);
        return { response: outputs[Math.min(calls.length - 1, outputs.length - 1)] };
    } } });
    return { response, body: await response.json(), calls };
}
test('context selects one gloss and translation cannot merge other senses', async () => {
    const { body, calls } = await generate({ contextHint: '生物学' }, [{ id: 2 }, { meaning: '生命や生き物を研究する学問。' }]);
    const selection = JSON.parse(calls[0].messages[1].content);
    assert.equal(selection.contextHint, '生物学');
    const input = JSON.parse(calls[1].messages[1].content);
    assert.deepEqual(input.glosses, ['biology']);
    assert.equal(input.contextHint, undefined);
    assert.equal(input.word, undefined);
    assert.equal(body.vocabulary.reading, 'せいぶつ');
});
test('without context only the first dictionary gloss is translated', async () => {
    const { calls, body } = await generate({});
    assert.deepEqual(JSON.parse(calls[0].messages[1].content).glosses, ['living thing']);
    assert.equal(calls.length, 1);
    assert.equal(body.vocabulary.needsReview, true);
    assert.match(body.vocabulary.comparisonNote, /living thing/);
});
test('invalid selection cannot reach translation', async () => {
    for (const id of [-1, 999, '2', 0.5]) {
        const { calls, response } = await generate({ contextHint: '生物学' }, [{ id }]);
        assert.equal(response.status, 422);
        assert.equal(calls.length, 1);
    }
});
test('raw food keeps dictionary reading and category regardless of AI extra fields', async () => {
    const { body } = await generate({ readingHint: 'なまもの' }, [{ meaning: '加熱していない食品や、傷みやすい食品。', reading: 'せいぶつ', category: '動詞', description: '創作した補足' }]);
    assert.equal(body.vocabulary.reading, 'なまもの');
    assert.equal(body.vocabulary.category, '名詞');
    assert.equal(body.vocabulary.description, '');
    assert.match(body.vocabulary.meaning, /加熱/);
});
test('katakana hints are normalized', async () => {
    const { body } = await generate({ readingHint: 'セイブツ' });
    assert.equal(body.vocabulary.reading, 'せいぶつ');
});
test('unknown terms do not call AI', async () => {
    const { response, calls } = await generate({ dictionaryHint: '' });
    assert.equal(response.status, 422);
    assert.equal(calls.length, 0);
});
test('unmatched reading does not call AI', async () => {
    const { response, calls } = await generate({ readingHint: 'しょうぶつ' });
    assert.equal(response.status, 422);
    assert.equal(calls.length, 0);
});
test('multiple readings require a hint', async () => {
    const { response, calls } = await generate({ readingHint: '' });
    assert.equal(response.status, 422);
    assert.equal(calls.length, 0);
});
test('unique reading works without a hint', async () => {
    const { body } = await generate({ readingHint: '', dictionaryHint: '読み: せいぶつ\n品詞: n\n意味: living thing' });
    assert.equal(body.vocabulary.reading, 'せいぶつ');
});
test('repeated headword triggers a correction and can recover', async () => {
    const { response, calls } = await generate({}, [{ meaning: '「生物」。' }, { meaning: '生命をもつもの。' }]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.ok(JSON.parse(calls[1].messages[1].content).correction);
});
test('invalid translations stop after two attempts', async () => {
    for (const meaning of ['', '生物', 'living thing', { bad: true }]) {
        const { response, calls } = await generate({}, [{ meaning }]);
        assert.equal(response.status, 422);
        assert.equal(calls.length, 2);
    }
});
