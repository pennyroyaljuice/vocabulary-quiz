import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const packs = await Promise.all(['beginner', 'intermediate', 'advanced'].map(async level =>
    JSON.parse(await readFile(new URL(`packs/${level}-100.json`, root), 'utf8'))));
const sources = await Promise.all(['utils', 'storage', 'quiz', 'word-packs'].map(name =>
    readFile(new URL(`js/${name}.js`, root), 'utf8')));

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}
function app() {
    const context = vm.createContext({ console, localStorage: memoryStorage(), sessionStorage: memoryStorage() });
    for (const source of sources) vm.runInContext(source, context);
    return vm.runInContext('({ Storage, Quiz, WordPacks, createQuiz })', context);
}

test('three packs contain 300 distinct words and valid quiz metadata', () => {
    const { Storage, WordPacks } = app();
    const keys = new Set();
    for (const pack of packs) {
        assert.equal(pack.words.length, 100, pack.packId);
        assert.ok(WordPacks.getPack(pack.packId));
        for (const word of pack.words) {
            const key = Storage.normalizeWordKey(word.word);
            assert.ok(!keys.has(key), `Duplicate: ${word.word}`);
            keys.add(key);
            // 初級の仮名だけの見出しには、読みを省略した既存データがある。
            if (word.reading || pack.packId !== 'beginner-100' || word.quizTypes.includes('reading')) {
                assert.match(word.reading, /^[ぁ-ゖー]+$/u, word.word);
            }
            assert.ok(word.meaning.trim().length > 5, word.word);
            assert.ok(word.category, word.word);
            assert.ok(word.quizTypes.includes('wordToMeaning'));
            assert.ok(word.quizTypes.includes('meaningToWord'));
            assert.ok(word.quizTypes.every(type => ['wordToMeaning', 'meaningToWord', 'reading'].includes(type)));
            if (pack.packId !== 'beginner-100') {
                assert.ok(word.description.includes('例：'), word.word);
                assert.notEqual(word.description, word.meaning, word.word);
            }
        }
    }
    assert.equal(keys.size, 300);
});

test('adding all packs preserves descriptions and repeated additions do not duplicate words', () => {
    const { Storage } = app();
    for (const pack of packs) {
        const result = Storage.addVocabularyPack(pack);
        assert.equal(result.addedCount, 100);
        assert.equal(result.skippedCount, 0);
        assert.equal(Storage.getVocabularyPackStatus(pack.packId).installedCount, 100);
        const repeated = Storage.addVocabularyPack(pack);
        assert.equal(repeated.addedCount, 0);
        assert.equal(repeated.skippedCount, 100);
    }
    const saved = Storage.getVocabulary();
    assert.equal(saved.length, 300);
    for (const pack of packs.slice(1)) {
        for (const word of pack.words) {
            const entry = saved.find(item => item.word === word.word);
            assert.equal(entry.description, word.description);
            assert.equal(entry.reading, word.reading);
        }
    }
});

test('an existing edited entry is preserved when expanding a pack', () => {
    const { Storage } = app();
    const pack = packs[1];
    const existing = { ...pack.words[0], meaning: '利用者が編集した意味。', description: '利用者のメモ。' };
    Storage.addVocabularyPack({ ...pack, words: [existing] });
    const result = Storage.addVocabularyPack(pack);
    assert.equal(result.addedCount, 99);
    assert.equal(result.skippedCount, 1);
    const saved = Storage.getVocabulary().find(item => item.word === existing.word);
    assert.equal(saved.meaning, existing.meaning);
    assert.equal(saved.description, existing.description);
});

test('new packs can complete meaning, word and reading quizzes with explanations intact', () => {
    for (const pack of packs.slice(1)) {
        for (const type of ['wordToMeaning', 'meaningToWord', 'reading']) {
            const { Storage, Quiz } = app();
            Storage.addVocabularyPack(pack);
            const words = Storage.getVocabulary().filter(word => word.quizTypes.includes(type))
                .map(word => ({ ...word, quizTypes: [type] }));
            Quiz.initialize(words);
            let question = Quiz.start({ questionCount: words.length });
            let count = 0;
            while (question) {
                assert.equal(question.type, type);
                assert.equal(question.choices.length, 4);
                assert.equal(new Set(question.choices).size, 4);
                assert.ok(question.choices.includes(question.correctAnswer));
                const result = Quiz.answer(question.correctAnswer);
                assert.equal(result.correct, true);
                assert.ok(result.description.includes('例：'));
                count++;
                question = Quiz.next();
            }
            assert.equal(count, words.length);
            assert.equal(Quiz.getResult().score, words.length);
        }
    }
});

test('trial quizzes leave storage, session history and the normal quiz untouched', () => {
    const values = new Map();
    const sessionValues = new Map([['vocabularyQuizPreviousWords', '["existing-id"]']]);
    const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
    const context = vm.createContext({ console, localStorage: storage(values), sessionStorage: storage(sessionValues) });
    for (const source of sources) vm.runInContext(source, context);
    const { Storage, Quiz, createQuiz } = vm.runInContext('({ Storage, Quiz, createQuiz })', context);
    Storage.addVocabularyPack(packs[0]);
    Quiz.initialize(Storage.getVocabulary());
    Quiz.start({ questionCount: 5 });
    const normalQuestion = JSON.stringify(Quiz.getCurrentQuestion());
    const beforeLocal = [...values.entries()];
    const beforeSession = [...sessionValues.entries()];
    for (const pack of packs) {
        const trial = createQuiz({ practice: true });
        trial.initialize(pack.words.map((word, index) => ({ ...word, id: `trial-${index}` })));
        trial.start({ questionCount: 100 });
        let question = trial.getCurrentQuestion();
        const ids = new Set();
        while (question) {
            ids.add(question.word.id);
            // 間違えた場合も普段の苦手語に追加しない。
            trial.answer(question.number % 2 ? question.correctAnswer : '不正解の回答');
            question = trial.next();
        }
        assert.equal(ids.size, 100);
        assert.equal(trial.getResult().score, 50);
    }
    assert.deepEqual([...values.entries()], beforeLocal);
    assert.deepEqual([...sessionValues.entries()], beforeSession);
    assert.equal(JSON.stringify(Quiz.getCurrentQuestion()), normalQuestion);
    Quiz.answer(Quiz.getCurrentQuestion().correctAnswer);
    assert.notDeepEqual([...values.entries()], beforeLocal);
});
