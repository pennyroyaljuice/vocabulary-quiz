"use strict";

// ブラウザーとWorkerで同じ共有形式を使用する。ローカルIDや学習履歴は許可しない。
globalThis.VocabularyShareFormat = (() => {
    const MAX_WORDS = 2000;
    const MAX_BYTES = 1000000;
    const TYPES = ["wordToMeaning", "meaningToWord", "reading"];
    function text(value, limit, label, required = false) {
        if (value == null && !required) return "";
        if (typeof value !== "string") throw new Error(`${label}の形式が不正です。`);
        const result = value.trim();
        if ((required && !result) || result.length > limit) throw new Error(`${label}の長さを確認してください（最大${limit}文字）。`);
        return result;
    }
    function key(word) {
        return word.replace(/^[\s・•●○□■\-–—]+/u, "").replace(/[（(][^）)]*[）)]/gu, "")
            .trim().normalize("NFKC").toLowerCase().replace(/[\s・･\-–—_＿]/gu, "");
    }
    function normalizePack(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("共有データの形式が不正です。");
        const name = text(input.name, 80, "セット名", true);
        if (!Array.isArray(input.words) || !input.words.length || input.words.length > MAX_WORDS) {
            throw new Error(`共有できる語彙は1〜${MAX_WORDS}語です。`);
        }
        const seen = new Set();
        const words = [];
        for (const item of input.words) {
            if (!item || typeof item !== "object") throw new Error("語彙の形式が不正です。");
            const word = text(item.word, 100, "語彙", true);
            const wordKey = key(word);
            if (!wordKey) throw new Error("空の語彙は共有できません。");
            const reading = text(item.reading, 200, "読み");
            const meaning = text(item.meaning, 2000, "意味", true);
            const description = text(item.description || item.note, 4000, "補足説明");
            const category = text(item.category, 80, "カテゴリ") || "未分類";
            const quizTypes = Array.isArray(item.quizTypes)
                ? [...new Set(item.quizTypes.filter(type => TYPES.includes(type) && (type !== "reading" || reading)))] : [];
            if (!quizTypes.length) quizTypes.push("wordToMeaning", "meaningToWord");
            const sources = [];
            if (Array.isArray(item.sources)) {
                for (const source of item.sources.slice(0, 10)) {
                    if (!source || typeof source.url !== "string") continue;
                    let url;
                    try { url = new URL(source.url); } catch { continue; }
                    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || source.url.length > 2000) continue;
                    sources.push({ title: text(source.title, 200, "出典名") || "出典", url: url.href });
                }
            }
            if (seen.has(wordKey)) continue;
            seen.add(wordKey);
            words.push({ word, reading, meaning, description, category, quizTypes, sources });
        }
        const pack = { name, words };
        if (new TextEncoder().encode(JSON.stringify(pack)).length > MAX_BYTES) throw new Error("共有データが大きすぎます（最大1MB）。");
        return pack;
    }
    function normalizeCode(value) {
        const code = String(value || "").normalize("NFKC").replace(/[\s-]/gu, "");
        if (!/^\d{24}$/.test(code)) throw new Error("共有コードは24桁の数字で入力してください。");
        return code;
    }
    return Object.freeze({ normalizePack, normalizeCode, MAX_WORDS, MAX_BYTES });
})();
