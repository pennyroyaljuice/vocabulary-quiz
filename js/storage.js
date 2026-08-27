"use strict";

const STORAGE_KEY = "vocabularyQuizV7";
const STORAGE_VERSION = 7;

const Storage = (() => {
    const DEFAULT_SETTINGS = {
        questionCount: 10,
        readingQuiz: true,
        darkMode: "auto",
        animation: true
    };

    function createDefaultData() {
        return {
            version: STORAGE_VERSION,

            stats: {},

            settings: {
                ...DEFAULT_SETTINGS
            },

            activity: {},

            vocabulary: [],

            pendingWords: [],

            unifiedVocabularyVersion: 1
        };
    }

    function createDefaultWordStats() {
        return {
            asked: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            lastSeen: null,
            lastCorrect: null,
            lastWrong: null
        };
    }

    function load() {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return createDefaultData();
        }

        try {
            const parsed = JSON.parse(raw);
            return migrate(parsed);
        } catch (error) {
            console.warn(
                "学習データを読み込めなかったため、初期状態を使用します。",
                error
            );

            return createDefaultData();
        }
    }

    function migrate(source) {
        const migrated = {
            version: STORAGE_VERSION,

            stats:
                source &&
                typeof source.stats === "object" &&
                source.stats !== null
                    ? source.stats
                    : {},

            settings: {
                ...DEFAULT_SETTINGS,
                ...(
                    source &&
                    typeof source.settings === "object" &&
                    source.settings !== null
                        ? source.settings
                        : {}
                )
            },

            activity:
                source &&
                typeof source.activity === "object" &&
                source.activity !== null
                    ? source.activity
                    : {},

            vocabulary:
                source &&
                Array.isArray(source.vocabulary)
                    ? source.vocabulary
                    : [],

            pendingWords:
                source &&
                Array.isArray(source.pendingWords)
                    ? source.pendingWords
                    : [],

            unifiedVocabularyVersion:
                source &&
                Number.isFinite(
                    source.unifiedVocabularyVersion
                )
                    ? source.unifiedVocabularyVersion
                    : 0
        };

        // 旧版では darkMode が boolean の場合がある
        if (migrated.settings.darkMode === true) {
            migrated.settings.darkMode = "dark";
        }

        if (migrated.settings.darkMode === false) {
            migrated.settings.darkMode = "auto";
        }

        for (const [wordId, stats] of Object.entries(migrated.stats)) {
            migrated.stats[wordId] = {
                ...createDefaultWordStats(),
                ...stats
            };
        }

        return migrated;
    }

    function save(data) {
        const normalized = migrate(data);

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(normalized)
        );
    }

    function getStats() {
        return load().stats;
    }

    function getWordStats(wordId) {
        const stats = getStats();

        return {
            ...createDefaultWordStats(),
            ...(
                stats[wordId] ||
                stats[String(wordId)] ||
                {}
            )
        };
    }

    function getSettings() {
        return load().settings;
    }

    function updateSetting(key, value) {
        const data = load();

        data.settings = {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            [key]: value
        };

        save(data);
    }

    function updateStats(wordId, correct) {
        const data = load();
        const key = String(wordId);
        const now = Date.now();

        data.stats[key] = {
            ...createDefaultWordStats(),
            ...(data.stats[key] || {})
        };

        const stats = data.stats[key];

        stats.asked += 1;
        stats.lastSeen = now;

        if (correct) {
            stats.correct += 1;
            stats.streak += 1;
            stats.lastCorrect = now;
        } else {
            stats.wrong += 1;
            stats.streak = 0;
            stats.lastWrong = now;
        }

        recordDailyActivity(
            data,
            correct
        );

        save(data);

        return { ...stats };
    }

    function recordDailyActivity(data, correct) {
        const dateKey = getLocalDateKey();

        data.activity[dateKey] = {
            answered:
                Number(
                    data.activity[dateKey]?.answered
                ) || 0,
            correct:
                Number(
                    data.activity[dateKey]?.correct
                ) || 0
        };

        data.activity[dateKey].answered += 1;

        if (correct) {
            data.activity[dateKey].correct += 1;
        }
    }

    function getTodayActivity() {
        const data = load();
        const today =
            data.activity[getLocalDateKey()];

        return {
            answered:
                Number(today?.answered) || 0,
            correct:
                Number(today?.correct) || 0
        };
    }

    function exportData() {
        return JSON.stringify(
            load(),
            null,
            2
        );
    }

    function exportBackup() {
        const data =
            load();

        const backup = {
            backupFormatVersion:
                2,

            exportedAt:
                new Date()
                    .toISOString(),

            appStorageVersion:
                STORAGE_VERSION,

            data: {
                stats:
                    data.stats,

                settings:
                    data.settings,

                activity:
                    data.activity,

                // 新しい統合語彙形式
                vocabulary:
                    Array.isArray(
                        data.vocabulary
                    )
                        ? data.vocabulary
                        : [],

                pendingWords:
                    Array.isArray(
                        data.pendingWords
                    )
                        ? data.pendingWords
                        : [],

                unifiedVocabularyVersion:
                    Number(
                        data.unifiedVocabularyVersion
                    ) || 0
            }
        };

        return JSON.stringify(
            backup,
            null,
            2
        );
    }

    function previewBackupMerge(
        backupSource
    ) {
        const backup =
            typeof backupSource === "string"
                ? JSON.parse(backupSource)
                : backupSource;

        if (
            !backup ||
            typeof backup !== "object" ||
            !backup.data ||
            typeof backup.data !== "object"
        ) {
            throw new Error(
                "バックアップ形式が不正です。"
            );
        }

        const data =
            load();

        const result = {
            vocabulary: {
                added: [],
                updated: []
            },

            pendingWords: {
                added: [],
                updated: []
            },

            statsChangedCount: 0,
            activityChangedCount: 0,
            settingsChanged: []
        };

        /*
        * 正式語彙
        */
        const localVocabularyByKey =
            new Map(
                (
                    Array.isArray(
                        data.vocabulary
                    )
                        ? data.vocabulary
                        : []
                ).map(
                    (item) => [
                        normalizeWordKey(
                            item.word
                        ),
                        item
                    ]
                )
            );

        for (
            const importedItem
            of (
                Array.isArray(
                    backup.data.vocabulary
                )
                    ? backup.data.vocabulary
                    : []
            )
        ) {
            if (
                !importedItem ||
                typeof importedItem !==
                    "object"
            ) {
                continue;
            }

            const word =
                cleanWordName(
                    importedItem.word
                );

            const key =
                normalizeWordKey(word);

            if (!key) {
                continue;
            }

            const existing =
                localVocabularyByKey.get(
                    key
                );

            if (!existing) {
                result.vocabulary.added.push(
                    word
                );

                continue;
            }

            if (
                getWordUpdateTime(
                    importedItem
                ) >
                getWordUpdateTime(
                    existing
                )
            ) {
                result.vocabulary.updated.push(
                    word
                );
            }
        }

        /*
        * 登録待ち
        */
        const localPendingByKey =
            new Map(
                (
                    Array.isArray(
                        data.pendingWords
                    )
                        ? data.pendingWords
                        : []
                ).map(
                    (item) => [
                        normalizeWordKey(
                            item.word
                        ),
                        item
                    ]
                )
            );

        const vocabularyKeys =
            new Set(
                (
                    Array.isArray(
                        data.vocabulary
                    )
                        ? data.vocabulary
                        : []
                ).map(
                    (item) =>
                        normalizeWordKey(
                            item.word
                        )
                )
            );

        for (
            const importedItem
            of (
                Array.isArray(
                    backup.data.pendingWords
                )
                    ? backup.data.pendingWords
                    : []
            )
        ) {
            if (
                !importedItem ||
                typeof importedItem !==
                    "object"
            ) {
                continue;
            }

            const word =
                cleanWordName(
                    importedItem.word
                );

            const key =
                normalizeWordKey(word);

            if (
                !key ||
                vocabularyKeys.has(key)
            ) {
                continue;
            }

            const existing =
                localPendingByKey.get(
                    key
                );

            if (!existing) {
                result.pendingWords.added.push(
                    word
                );

                continue;
            }

            if (
                getWordUpdateTime(
                    importedItem
                ) >
                getWordUpdateTime(
                    existing
                )
            ) {
                result.pendingWords.updated.push(
                    word
                );
            }
        }

        /*
        * 学習履歴
        */
        const importedStats =
            backup.data.stats &&
            typeof backup.data.stats ===
                "object"
                ? backup.data.stats
                : {};

        for (
            const [key, value]
            of Object.entries(
                importedStats
            )
        ) {
            if (
                JSON.stringify(
                    data.stats?.[key]
                ) !==
                JSON.stringify(value)
            ) {
                result.statsChangedCount +=
                    1;
            }
        }

        /*
        * 日別学習履歴
        */
        const importedActivity =
            backup.data.activity &&
            typeof backup.data.activity ===
                "object"
                ? backup.data.activity
                : {};

        for (
            const [key, value]
            of Object.entries(
                importedActivity
            )
        ) {
            if (
                JSON.stringify(
                    data.activity?.[key]
                ) !==
                JSON.stringify(value)
            ) {
                result.activityChangedCount +=
                    1;
            }
        }

        /*
        * 設定
        */
        const importedSettings =
            backup.data.settings &&
            typeof backup.data.settings ===
                "object"
                ? backup.data.settings
                : {};

        for (
            const [key, value]
            of Object.entries(
                importedSettings
            )
        ) {
            if (
                JSON.stringify(
                    data.settings?.[key]
                ) !==
                JSON.stringify(value)
            ) {
                result.settingsChanged.push(
                    key
                );
            }
        }

        return result;
    }

    function mergeBackup(
        backupSource
    ) {
        const backup =
            typeof backupSource === "string"
                ? JSON.parse(backupSource)
                : backupSource;

        if (
            !backup ||
            typeof backup !== "object" ||
            Array.isArray(backup)
        ) {
            throw new Error(
                "バックアップ形式が不正です。"
            );
        }

        if (
            !backup.data ||
            typeof backup.data !== "object" ||
            Array.isArray(backup.data)
        ) {
            throw new Error(
                "バックアップデータが見つかりません。"
            );
        }

        /*
        * 現行バックアップ形式のみ対応
        */
        const backupVersion =
            Number(
                backup.backupFormatVersion
            );

        if (
            !Number.isFinite(backupVersion) ||
            backupVersion < 2
        ) {
            throw new Error(
                "このバックアップは古い形式のため読み込めません。"
            );
        }

        const data =
            load();

        /*
        * ==================================================
        * 正式語彙 vocabulary
        * ==================================================
        */

        const importedVocabulary =
            Array.isArray(
                backup.data.vocabulary
            )
                ? backup.data.vocabulary
                : [];

        const localVocabulary =
            Array.isArray(
                data.vocabulary
            )
                ? data.vocabulary
                : [];

        const vocabularyByKey =
            new Map();

        const usedVocabularyIds =
            new Set();

        for (
            const item
            of localVocabulary
        ) {
            if (
                !item ||
                typeof item !== "object"
            ) {
                continue;
            }

            const key =
                normalizeWordKey(
                    item.word
                );

            if (!key) {
                continue;
            }

            vocabularyByKey.set(
                key,
                {
                    ...item
                }
            );

            usedVocabularyIds.add(
                String(item.id)
            );
        }

        let vocabularyAddedCount = 0;
        let vocabularyUpdatedCount = 0;
        let vocabularySkippedCount = 0;

        for (
            const importedItem
            of importedVocabulary
        ) {
            if (
                !importedItem ||
                typeof importedItem !==
                    "object"
            ) {
                vocabularySkippedCount += 1;
                continue;
            }

            const word =
                cleanWordName(
                    importedItem.word
                );

            const key =
                normalizeWordKey(word);

            if (!key) {
                vocabularySkippedCount += 1;
                continue;
            }

            const existing =
                vocabularyByKey.get(key);

            if (existing) {
                const localTime =
                    getWordUpdateTime(
                        existing
                    );

                const importedTime =
                    getWordUpdateTime(
                        importedItem
                    );

                if (
                    importedTime >
                    localTime
                ) {
                    vocabularyByKey.set(
                        key,
                        {
                            ...existing,
                            ...importedItem,

                            // 同じ語ならローカルIDを維持
                            id:
                                existing.id,

                            word,

                            status:
                                "ready"
                        }
                    );

                    vocabularyUpdatedCount += 1;
                } else {
                    vocabularySkippedCount += 1;
                }

                continue;
            }

            let importedId =
                String(
                    importedItem.id || ""
                );

            if (
                !importedId ||
                usedVocabularyIds.has(
                    importedId
                )
            ) {
            importedId =
                createVocabularyId();
            }

            vocabularyByKey.set(
                key,
                {
                    ...importedItem,

                    id:
                        importedId,

                    word,

                    status:
                        "ready"
                }
            );

            usedVocabularyIds.add(
                importedId
            );

            vocabularyAddedCount += 1;
        }

        data.vocabulary =
            [...vocabularyByKey.values()];

        /*
        * ==================================================
        * 登録待ち pendingWords
        * ==================================================
        */

        const importedPendingWords =
            Array.isArray(
                backup.data.pendingWords
            )
                ? backup.data.pendingWords
                : [];

        const localPendingWords =
            Array.isArray(
                data.pendingWords
            )
                ? data.pendingWords
                : [];

        const pendingByKey =
            new Map();

        const usedPendingIds =
            new Set();

        for (
            const item
            of localPendingWords
        ) {
            if (
                !item ||
                typeof item !== "object"
            ) {
                continue;
            }

            const key =
                normalizeWordKey(
                    item.word
                );

            if (!key) {
                continue;
            }

            /*
            * 正式語彙に存在するものは
            * pendingには残さない
            */
            if (
                vocabularyByKey.has(key)
            ) {
                continue;
            }

            pendingByKey.set(
                key,
                {
                    ...item
                }
            );

            usedPendingIds.add(
                String(item.id)
            );
        }

        let pendingAddedCount = 0;
        let pendingUpdatedCount = 0;
        let pendingSkippedCount = 0;

        for (
            const importedItem
            of importedPendingWords
        ) {
            if (
                !importedItem ||
                typeof importedItem !==
                    "object"
            ) {
                pendingSkippedCount += 1;
                continue;
            }

            const word =
                cleanWordName(
                    importedItem.word
                );

            const key =
                normalizeWordKey(word);

            if (!key) {
                pendingSkippedCount += 1;
                continue;
            }

            /*
            * 正式語彙に存在するものを
            * pendingへ戻さない
            */
            if (
                vocabularyByKey.has(key)
            ) {
                pendingSkippedCount += 1;
                continue;
            }

            const existing =
                pendingByKey.get(key);

            if (existing) {
                const localTime =
                    getWordUpdateTime(
                        existing
                    );

                const importedTime =
                    getWordUpdateTime(
                        importedItem
                    );

                if (
                    importedTime >
                    localTime
                ) {
                    pendingByKey.set(
                        key,
                        {
                            ...existing,
                            ...importedItem,

                            id:
                                existing.id,

                            word,

                            status:
                                importedItem.status ||
                                "pending"
                        }
                    );

                    pendingUpdatedCount += 1;
                } else {
                    pendingSkippedCount += 1;
                }

                continue;
            }

            let importedId =
                String(
                    importedItem.id || ""
                );

            if (
                !importedId ||
                usedPendingIds.has(
                    importedId
                ) ||
                usedVocabularyIds.has(
                    importedId
                )
            ) {
                importedId =
                    createVocabularyId();
            }

            pendingByKey.set(
                key,
                {
                    ...importedItem,

                    id:
                        importedId,

                    word,

                    status:
                        "pending"
                }
            );

            usedPendingIds.add(
                importedId
            );

            pendingAddedCount += 1;
        }

        data.pendingWords =
            [...pendingByKey.values()];

        /*
        * ==================================================
        * 学習履歴
        * ==================================================
        */

        if (
            backup.data.stats &&
            typeof backup.data.stats ===
                "object" &&
            !Array.isArray(
                backup.data.stats
            )
        ) {
            data.stats = {
                ...data.stats,
                ...backup.data.stats
            };
        }

        /*
        * ==================================================
        * 日別学習履歴
        * ==================================================
        */

        if (
            backup.data.activity &&
            typeof backup.data.activity ===
                "object" &&
            !Array.isArray(
                backup.data.activity
            )
        ) {
            data.activity = {
                ...data.activity,
                ...backup.data.activity
            };
        }

        /*
        * ==================================================
        * 設定
        * ==================================================
        */

        if (
            backup.data.settings &&
            typeof backup.data.settings ===
                "object" &&
            !Array.isArray(
                backup.data.settings
            )
        ) {
            data.settings = {
                ...data.settings,
                ...backup.data.settings
            };
        }

        /*
        * 統合語彙形式
        */
        data.unifiedVocabularyVersion =
            Math.max(
                Number(
                    data.unifiedVocabularyVersion
                ) || 0,

                Number(
                    backup.data
                        .unifiedVocabularyVersion
                ) || 1,

                1
            );

        save(data);

        return {
            backupFormatVersion:
                backupVersion,

            vocabulary: {
                addedCount:
                    vocabularyAddedCount,

                updatedCount:
                    vocabularyUpdatedCount,

                skippedCount:
                    vocabularySkippedCount,

                totalCount:
                    data.vocabulary.length
            },

            pendingWords: {
                addedCount:
                    pendingAddedCount,

                updatedCount:
                    pendingUpdatedCount,

                skippedCount:
                    pendingSkippedCount,

                totalCount:
                    data.pendingWords.length
            }
        };
    }

    function getVocabulary() {
    const data = load();

    return Array.isArray(data.vocabulary)
        ? data.vocabulary.map(
            (item) => ({
                ...item
            })
        )
        : [];
}

    function getPendingWords() {
        const data = load();

        return Array.isArray(data.pendingWords)
            ? data.pendingWords.map(
                (item) => ({
                    ...item
                })
            )
            : [];
    }

    function updateVocabularyWord(
        wordId,
        changes
    ) {
        const data = load();

        if (!Array.isArray(data.vocabulary)) {
            throw new Error(
                "統合語彙データがまだ作成されていません。"
            );
        }

        const index =
            data.vocabulary.findIndex(
                (item) =>
                    String(item.id) ===
                    String(wordId)
            );

        if (index < 0) {
            throw new Error(
                "語彙が見つかりません。"
            );
        }

        data.vocabulary[index] = {
            ...data.vocabulary[index],
            ...changes,

            id:
                data.vocabulary[index].id,

            updatedAt:
                Date.now()
        };

        save(data);

        return {
            ...data.vocabulary[index]
        };
    }

    function removeVocabularyWord(
        wordId
    ) {
        const data = load();

        if (!Array.isArray(data.vocabulary)) {
            return false;
        }

        const before =
            data.vocabulary.length;

        data.vocabulary =
            data.vocabulary.filter(
                (item) =>
                    String(item.id) !==
                    String(wordId)
            );

        if (
            data.vocabulary.length ===
            before
        ) {
            return false;
        }

        save(data);

        return true;
    }

    function getWordUpdateTime(
        item
    ) {
        return (
            Number(item?.updatedAt) ||
            Number(item?.createdAt) ||
            0
        );
    }

    function importData(json) {
        const parsed =
            typeof json === "string"
                ? JSON.parse(json)
                : json;

        validateImport(parsed);
        save(parsed);
    }

    function validateImport(data) {
        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            throw new Error(
                "バックアップの形式が不正です。"
            );
        }

        if (
            data.stats !== undefined &&
            (
                typeof data.stats !== "object" ||
                data.stats === null ||
                Array.isArray(data.stats)
            )
        ) {
            throw new Error(
                "学習履歴の形式が不正です。"
            );
        }

        if (
            data.settings !== undefined &&
            (
                typeof data.settings !== "object" ||
                data.settings === null ||
                Array.isArray(data.settings)
            )
        ) {
            throw new Error(
                "設定の形式が不正です。"
            );
        }
    }
    

    function cleanWordName(value) {
        return String(value || "")
            .replace(/^[\s・•●○□■\-–—]+/u, "")
            .replace(/[（(][^）)]*[）)]/gu, "")
            .trim();
    }

    function normalizeWordKey(value) {
        return cleanWordName(value)
            .normalize("NFKC")
            .toLowerCase()
            .replace(/[\s・･\-–—_＿]/gu, "");
    }

    function createVocabularyId() {
        return (
            "custom-" +
            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 8)
        );
    }

    function reset() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function getLocalDateKey(date = new Date()) {
        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function finalizePendingWord(
        wordId,
        changes
    ) {
        const data = load();

        if (!Array.isArray(data.vocabulary)) {
            throw new Error(
                "統合語彙データがまだ作成されていません。"
            );
        }

        const pendingIndex =
            data.pendingWords.findIndex(
                (item) =>
                    String(item.id) ===
                    String(wordId)
            );

        if (pendingIndex < 0) {
            throw new Error(
                "登録待ち語彙が見つかりません。"
            );
        }

        const original =
            data.pendingWords[pendingIndex];

        const word =
            cleanWordName(
                changes.word ||
                original.word
            );

        const key =
            normalizeWordKey(word);

        const duplicate =
            data.vocabulary.find(
                (item) =>
                    normalizeWordKey(
                        item.word
                    ) === key
            );

        if (duplicate) {
            throw new Error(
                `「${duplicate.word}」はすでに登録されています。`
            );
        }

        const finalized = {
            ...original,
            ...changes,

            id:
                original.id,

            word,

            status:
                "ready",

            updatedAt:
                Date.now()
        };

        data.pendingWords.splice(
            pendingIndex,
            1
        );

        data.vocabulary.push(
            finalized
        );

        save(data);

        return {
            ...finalized
        };
    }

    function addUnifiedPendingWords(
        entries
    ) {
        const data =
            load();

        if (
            !Array.isArray(
                data.vocabulary
            )
        ) {
            throw new Error(
                "統合語彙データがまだ作成されていません。"
            );
        }

        if (
            !Array.isArray(
                data.pendingWords
            )
        ) {
            data.pendingWords = [];
        }

        const existingKeys =
            new Set([
                ...data.vocabulary.map(
                    (item) =>
                        normalizeWordKey(
                            item.word
                        )
                ),

                ...data.pendingWords.map(
                    (item) =>
                        normalizeWordKey(
                            item.word
                        )
                )
            ]);

        const added = [];
        const duplicates = [];

        for (const source of entries) {
            const entry =
                typeof source === "string"
                    ? {
                        word: source,
                        readingHint: "",
                        contextHint: ""
                    }
                    : source;

            const word =
                cleanWordName(
                    entry.word
                );

            const key =
                normalizeWordKey(
                    word
                );

            if (!key) {
                continue;
            }

            if (
                existingKeys.has(key)
            ) {
                duplicates.push(
                    word
                );

                continue;
            }

            const readingHint =
                String(
                    entry.readingHint ||
                    ""
                ).trim();

            const contextHint =
                String(
                    entry.contextHint ||
                    ""
                ).trim();

            const item = {
                id:
                    createVocabularyId(),

                word,

                reading:
                    readingHint,

                readingHint,

                contextHint,

                meaning: "",
                description: "",
                category: "",
                quizTypes: [],

                sources: [],
                comparisonNote: "",
                needsReview: true,

                status:
                    "pending",

                createdAt:
                    Date.now(),

                updatedAt:
                    null
            };

            data.pendingWords.push(
                item
            );

            existingKeys.add(
                key
            );

            added.push({
                ...item
            });
        }

        save(data);

        return {
            added,
            duplicates
        };
    }

    function updatePendingWord(
        wordId,
        changes
    ) {
        const data =
            load();

        const index =
            data.pendingWords.findIndex(
                (item) =>
                    String(item.id) ===
                    String(wordId)
            );

        if (index < 0) {
            throw new Error(
                "登録待ち語彙が見つかりません。"
            );
        }

        data.pendingWords[index] = {
            ...data.pendingWords[index],
            ...changes,

            id:
                data.pendingWords[index].id,

            updatedAt:
                Date.now()
        };

        save(data);

        return {
            ...data.pendingWords[index]
        };
    }

    function removePendingWord(
        wordId
    ) {
        const data =
            load();

        const before =
            data.pendingWords.length;

        data.pendingWords =
            data.pendingWords.filter(
                (item) =>
                    String(item.id) !==
                    String(wordId)
            );

        if (
            data.pendingWords.length ===
            before
        ) {
            return false;
        }

        save(data);

        return true;
    }

return {
    load,
    save,

    getVocabulary,
    getPendingWords,
    updateVocabularyWord,
    removeVocabularyWord,

    getStats,
    getWordStats,
    getSettings,
    updateSetting,
    updateStats,
    getTodayActivity,

    normalizeWordKey,

    finalizePendingWord,
    addUnifiedPendingWords,
    updatePendingWord,
    removePendingWord,

    export: exportData,
    exportBackup,
    mergeBackup,
    previewBackupMerge,

    import: importData,
    reset
};
})();