"use strict";

const Quiz = (() => {
    const QUESTION_TYPES = {
        WORD_TO_MEANING: "wordToMeaning",
        MEANING_TO_WORD: "meaningToWord",
        READING: "reading"
    };

    let words = [];
    let questions = [];
    let currentIndex = 0;
    let score = 0;
    let answers = [];
    let startedAt = null;
    let answered = false;

    function initialize(wordData) {
        if (!Array.isArray(wordData)) {
            throw new TypeError("語彙データは配列である必要があります。");
        }

        words = deduplicateWords(wordData);
    }

    function deduplicateWords(wordData) {
        const seen = new Set();

        return wordData.filter((item) => {
            if (!item || !item.word) {
                return false;
            }

            const key = Utils.normalize(item.word)
                .normalize("NFKC")
                .toLowerCase()
                .replace(/\s+/g, "");

            if (!key || seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });
    }

    function start(options = {}) {
        if (words.length < 4) {
            throw new Error("クイズには4語以上の語彙データが必要です。");
        }

        const settings = Storage.getSettings();
        const requestedCount =
            Number(options.questionCount) ||
            Number(settings.questionCount) ||
            10;

        const questionCount = Math.min(
            Math.max(requestedCount, 1),
            words.length
        );

        const sourceWords = Array.isArray(options.words)
            ? options.words
            : words;

        const selectedWords = selectWeightedWords(
            sourceWords,
            questionCount
        );

        questions = selectedWords.map((word) =>
            createQuestion(word)
        );

        currentIndex = 0;
        score = 0;
        answers = [];
        startedAt = Date.now();
        answered = false;

        return getCurrentQuestion();
    }

    function selectWeightedWords(sourceWords, count) {
        const remaining = [...sourceWords];
        const selected = [];
        const previousIds = getPreviousQuizWordIds();

        while (selected.length < count && remaining.length > 0) {
            const weightedItems = remaining.map((word) => ({
                word,
                weight: calculateWeight(word, previousIds)
            }));

            const selectedItem = weightedRandom(weightedItems);

            if (!selectedItem) {
                break;
            }

            selected.push(selectedItem.word);

            const index = remaining.findIndex(
                (word) => String(word.id) === String(selectedItem.word.id)
            );

            if (index >= 0) {
                remaining.splice(index, 1);
            }
        }

        savePreviousQuizWordIds(selected.map((word) => word.id));

        return selected;
    }

function calculateWeight(word, previousIds = []) {
        const stat =
            Storage.getWordStats(word.id);

        // 未出題語は高確率
        if (!stat.asked) {
            return 12;
        }

        const asked =
            Number(stat.asked) || 0;

        const correct =
            Number(stat.correct) || 0;

        const wrong =
            Number(stat.wrong) || 0;

        const streak =
            Number(stat.streak) || 0;

        const accuracy =
            asked > 0
                ? correct / asked
                : 0;

        let weight = 2.5;

        // 誤答数による優先度
        weight += Math.min(
            wrong * 2,
            14
        );

        // 正答率が低い語ほど優先
        weight +=
            (1 - accuracy) * 9;

        // 直近で間違えた語は優先
        if (stat.lastWrong) {
            const daysSinceWrong =
                (
                    Date.now() -
                    Number(stat.lastWrong)
                ) /
                (1000 * 60 * 60 * 24);

            if (daysSinceWrong < 1) {
                weight += 2;
            } else if (daysSinceWrong < 4) {
                weight += 4;
            } else if (daysSinceWrong < 14) {
                weight += 2;
            }
        }

        // 長く出題されていない語を再浮上させる
        if (stat.lastSeen) {
            const daysSinceSeen =
                (
                    Date.now() -
                    Number(stat.lastSeen)
                ) /
                (1000 * 60 * 60 * 24);

            weight += Math.min(
                daysSinceSeen / 5,
                5
            );
        }

        // 連続正解している語は出にくくする
        weight -= Math.min(
            streak * 1.15,
            7
        );

        // 十分に習得した語は低確率
        if (
            asked >= 5 &&
            accuracy >= 0.9 &&
            streak >= 3
        ) {
            weight *= 0.25;
        } else if (
            accuracy >= 0.75 &&
            streak >= 2
        ) {
            weight *= 0.55;
        }

        // 前回出題された語は抑制
        if (
            previousIds
                .map(String)
                .includes(String(word.id))
        ) {
            weight *= 0.35;
        }

        return Math.max(
            weight,
            0.2
        );
    }

    function weightedRandom(items) {
        const totalWeight = items.reduce(
            (sum, item) => sum + Math.max(item.weight, 0),
            0
        );

        if (totalWeight <= 0) {
            return items[
                Math.floor(Math.random() * items.length)
            ];
        }

        let random = Math.random() * totalWeight;

        for (const item of items) {
            random -= Math.max(item.weight, 0);

            if (random <= 0) {
                return item;
            }
        }

        return items[items.length - 1];
    }

    function createQuestion(word) {
        const availableTypes =
            getAvailableQuestionTypes(word);

        const type =
            availableTypes[
                Math.floor(
                    Math.random() *
                    availableTypes.length
                )
            ];

        switch (type) {
            case QUESTION_TYPES.MEANING_TO_WORD:
                return createMeaningToWordQuestion(word);

            case QUESTION_TYPES.READING:
                return createReadingQuestion(word);

            case QUESTION_TYPES.WORD_TO_MEANING:
            default:
                return createWordToMeaningQuestion(word);
        }
    }

        function getAvailableQuestionTypes(word) {
            if (
                Array.isArray(word.quizTypes) &&
                word.quizTypes.length > 0
            ) {
                const types =
                    word.quizTypes.filter((type) => {
                        if (
                            type ===
                            QUESTION_TYPES.READING
                        ) {
                            return canAskReadingQuestion(
                                word
                            );
                        }

                        return Object.values(
                            QUESTION_TYPES
                        ).includes(type);
                    });

                if (types.length > 0) {
                    return types;
                }
            }

            return [
                QUESTION_TYPES.WORD_TO_MEANING,
                QUESTION_TYPES.MEANING_TO_WORD
            ];
        }

    function canAskReadingQuestion(word) {
        if (!word.reading) {
            return false;
        }

        // 漢字を含まない語では読み問題を出さない
        if (!/[\u3400-\u9FFF々〆ヵヶ]/u.test(word.word)) {
            return false;
        }

        // 慣用句・ことわざ・文章的な表現は読み問題を出さない
        const excludedCategories = [
            "慣用句",
            "ことわざ",
            "故事成語",
            "婉曲表現",
            "宗教"
        ];

        if (
            excludedCategories.some(
                (category) =>
                    String(word.category || "")
                        .includes(category)
            )
        ) {
            return false;
        }

        // 助詞を含む長い表現は、文章・成句として扱う
        if (
            /(?:が|を|に|へ|と|の|は|も|で|から|まで)/u.test(
                word.word
            ) &&
            word.word.length >= 6
        ) {
            return false;
        }

        return true;
    }
    function createWordToMeaningQuestion(word) {
        const distractors = selectMeaningDistractors(word, 3);
        const choices = Utils.shuffle([
            word.meaning,
            ...distractors.map((item) => item.meaning)
        ]);

        return {
            id: createQuestionId(word.id),
            word,
            type: QUESTION_TYPES.WORD_TO_MEANING,
            typeLabel: "意味問題",
            prompt: "次の言葉の意味として最も適切なものは？",
            text: word.word,
            choices,
            correctAnswer: word.meaning
        };
    }

    function createMeaningToWordQuestion(word) {
        const distractors = selectWordDistractors(word, 3);
        const choices = Utils.shuffle([
            word.word,
            ...distractors.map((item) => item.word)
        ]);

        return {
            id: createQuestionId(word.id),
            word,
            type: QUESTION_TYPES.MEANING_TO_WORD,
            typeLabel: "単語問題",
            prompt: "次の意味に当てはまる言葉は？",
            text: word.meaning,
            choices,
            correctAnswer: word.word
        };
    }

    function createReadingQuestion(word) {
        const distractors =
            selectReadingDistractors(
                word,
                3
            );

        const choices = Utils.shuffle([
            word.reading,
            ...distractors.map(
                (item) => item.reading
            )
        ]);

        return {
            id: createQuestionId(word.id),
            word,
            type: QUESTION_TYPES.READING,
            typeLabel: "読み問題",
            prompt: "次の言葉の読みとして正しいものは？",
            text: maskOkurigana(word.word),
            choices,
            correctAnswer: word.reading
        };
    }

        function maskOkurigana(word) {
        return Array.from(word)
            .map((character) => {
                // 漢字・々などはそのまま表示
                if (
                    /[\u3400-\u9FFF々〆ヵヶ]/u.test(
                        character
                    )
                ) {
                    return character;
                }

                // 区切り記号や空白も残す
                if (
                    /[\s・\-ー]/u.test(
                        character
                    )
                ) {
                    return character;
                }

                // 送り仮名などを隠す
                return "＿";
            })
            .join("");
    }

    function selectWordDistractors(correctWord, count) {
        return selectBestDistractors(
            correctWord,
            count,
            (candidate) =>
                candidate.word &&
                candidate.word !== correctWord.word,
            wordSimilarityScore
        );
    }

    function selectMeaningDistractors(correctWord, count) {
        return selectBestDistractors(
            correctWord,
            count,
            (candidate) =>
                candidate.meaning &&
                candidate.meaning !== correctWord.meaning,
            meaningSimilarityScore
        );
    }

    function selectReadingDistractors(
        correctWord,
        count
    ) {
        const correctEnding =
            getReadingEnding(correctWord);

        const candidates = words
            .filter((candidate) => {
                if (
                    String(candidate.id) ===
                    String(correctWord.id)
                ) {
                    return false;
                }

                if (
                    !candidate.reading ||
                    candidate.reading ===
                        correctWord.reading
                ) {
                    return false;
                }

                return canAskReadingQuestion(
                    candidate
                );
            })
            .map((candidate) => {
                let score =
                    readingSimilarityScore(
                        correctWord,
                        candidate
                    );

                const candidateEnding =
                    getReadingEnding(candidate);

                // 送り仮名がある語は、同じ語尾を優先
                if (
                    correctEnding &&
                    candidateEnding ===
                        correctEnding
                ) {
                    score += 12;
                }

                // 読みの文字数が同じものを優先
                if (
                    candidate.reading.length ===
                    correctWord.reading.length
                ) {
                    score += 7;
                }

                return {
                    candidate,
                    score:
                        score +
                        Math.random() * 1.5
                };
            })
            .sort(
                (a, b) =>
                    b.score - a.score
            );

        const selected = [];
        const usedReadings = new Set();

        for (const item of candidates) {
            if (
                usedReadings.has(
                    item.candidate.reading
                )
            ) {
                continue;
            }

            selected.push(
                item.candidate
            );

            usedReadings.add(
                item.candidate.reading
            );

            if (
                selected.length >= count
            ) {
                break;
            }
        }

        return selected.slice(0, count);
    }

        function getReadingEnding(word) {
        const match =
            String(word.word || "")
                .match(
                    /([ぁ-ゖ]+)$/u
                );

        if (!match) {
            return "";
        }

        const okurigana =
            match[1];

        // 読みの末尾から、送り仮名と同じ部分を取得
        if (
            String(word.reading || "")
                .endsWith(okurigana)
        ) {
            return okurigana;
        }

        return "";
    }

    function selectBestDistractors(
        correctWord,
        count,
        filterFunction,
        scoreFunction
    ) {
        const candidates = words
            .filter(
                (candidate) =>
                    String(candidate.id) !==
                        String(correctWord.id) &&
                    filterFunction(candidate)
            )
            .map((candidate) => ({
                candidate,
                score:
                    scoreFunction(correctWord, candidate) +
                    Math.random() * 1.5
            }))
            .sort((a, b) => b.score - a.score);

        const selected = [];
        const usedValues = new Set();

        for (const item of candidates) {
            const candidate = item.candidate;
            const value =
                candidate.word ||
                candidate.reading ||
                candidate.meaning;

            if (usedValues.has(value)) {
                continue;
            }

            selected.push(candidate);
            usedValues.add(value);

            if (selected.length >= count) {
                break;
            }
        }

        if (selected.length < count) {
            const fallback = Utils.shuffle(
                words.filter(
                    (candidate) =>
                        String(candidate.id) !==
                            String(correctWord.id) &&
                        filterFunction(candidate) &&
                        !selected.some(
                            (selectedWord) =>
                                String(selectedWord.id) ===
                                String(candidate.id)
                        )
                )
            );

            while (
                selected.length < count &&
                fallback.length > 0
            ) {
                selected.push(fallback.shift());
            }
        }

        return selected.slice(0, count);
    }

    function wordSimilarityScore(correct, candidate) {
        let score = 0;

        if (correct.category === candidate.category) {
            score += 8;
        }

        if (
            getScriptType(correct.word) ===
            getScriptType(candidate.word)
        ) {
            score += 7;
        }

        const lengthDifference = Math.abs(
            correct.word.length - candidate.word.length
        );

        score += Math.max(0, 5 - lengthDifference);

        if (
            getFirstCharacterGroup(correct.word) ===
            getFirstCharacterGroup(candidate.word)
        ) {
            score += 1;
        }

        return score;
    }

    function meaningSimilarityScore(correct, candidate) {
        let score = 0;

        if (correct.category === candidate.category) {
            score += 9;
        }

        const lengthDifference = Math.abs(
            correct.meaning.length -
            candidate.meaning.length
        );

        score += Math.max(0, 6 - lengthDifference / 8);

        return score;
    }

    function readingSimilarityScore(correct, candidate) {
        let score = 0;

        if (correct.category === candidate.category) {
            score += 6;
        }

        const lengthDifference = Math.abs(
            correct.reading.length -
            candidate.reading.length
        );

        score += Math.max(0, 7 - lengthDifference);

        return score;
    }

    function getScriptType(text) {
        if (/^[ァ-ヶー・]+$/u.test(text)) {
            return "katakana";
        }

        if (/^[ぁ-ゖー・]+$/u.test(text)) {
            return "hiragana";
        }

        if (/^[A-Za-z\s-]+$/u.test(text)) {
            return "latin";
        }

        if (/[\u3400-\u9FFF々〆ヵヶ]/u.test(text)) {
            return "kanji";
        }

        return "mixed";
    }

    function getFirstCharacterGroup(text) {
        const first = text.charAt(0);

        if (/[ア-オァ-ォ]/u.test(first)) return "a";
        if (/[カ-ゴヵヶ]/u.test(first)) return "ka";
        if (/[サ-ゾ]/u.test(first)) return "sa";
        if (/[タ-ド]/u.test(first)) return "ta";
        if (/[ナ-ノ]/u.test(first)) return "na";
        if (/[ハ-ポ]/u.test(first)) return "ha";
        if (/[マ-モ]/u.test(first)) return "ma";
        if (/[ヤ-ヨャュョ]/u.test(first)) return "ya";
        if (/[ラ-ロ]/u.test(first)) return "ra";
        if (/[ワ-ンヲ]/u.test(first)) return "wa";

        return first;
    }

    function answer(selectedAnswer) {
        if (answered) {
            return null;
        }

        const question = questions[currentIndex];

        if (!question) {
            return null;
        }

        answered = true;

        const isCorrect =
            selectedAnswer === question.correctAnswer;

        if (isCorrect) {
            score += 1;
        }

        Storage.updateStats(
            question.word.id,
            isCorrect
        );

        const answerRecord = {
            questionId: question.id,
            wordId: question.word.id,
            word: question.word.word,
            selectedAnswer,
            correctAnswer: question.correctAnswer,
            correct: isCorrect,
            type: question.type,
            meaning: question.word.meaning,
            reading: question.word.reading,
            description: question.word.description || "",
            category: question.word.category || ""
        };

        answers.push(answerRecord);

        return {
            correct: isCorrect,
            correctAnswer: question.correctAnswer,
            word: question.word,
            meaning: question.word.meaning,
            reading: question.word.reading,
            description: question.word.description || ""
        };
    }

    function next() {
        if (!answered) {
            return getCurrentQuestion();
        }

        currentIndex += 1;
        answered = false;

        if (currentIndex >= questions.length) {
            return null;
        }

        return getCurrentQuestion();
    }

    function getCurrentQuestion() {
        const question = questions[currentIndex];

        if (!question) {
            return null;
        }

        return {
            ...question,
            index: currentIndex,
            number: currentIndex + 1,
            total: questions.length
        };
    }

    function getResult() {
        const total = questions.length;
        const elapsedMilliseconds = startedAt
            ? Date.now() - startedAt
            : 0;

        return {
            score,
            total,
            accuracy: Utils.percentage(score, total),
            answers: [...answers],
            wrongAnswers: answers.filter(
                (answer) => !answer.correct
            ),
            elapsedMilliseconds,
            elapsedSeconds: Math.floor(
                elapsedMilliseconds / 1000
            )
        };
    }

    function isFinished() {
        return currentIndex >= questions.length;
    }

    function getWords() {
        return [...words];
    }

    function getQuestionCount() {
        return questions.length;
    }

    function createQuestionId(wordId) {
        return `${wordId}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`;
    }

    function getPreviousQuizWordIds() {
        try {
            const value = sessionStorage.getItem(
                "vocabularyQuizPreviousWords"
            );

            return value ? JSON.parse(value) : [];
        } catch {
            return [];
        }
    }

    function savePreviousQuizWordIds(ids) {
        try {
            sessionStorage.setItem(
                "vocabularyQuizPreviousWords",
                JSON.stringify(ids)
            );
        } catch {
            // sessionStorageが利用できない環境では無視
        }
    }

    return {
        QUESTION_TYPES,
        initialize,
        start,
        answer,
        next,
        getCurrentQuestion,
        getResult,
        getWords,
        getQuestionCount,
        isFinished,
        calculateWeight
    };
})();