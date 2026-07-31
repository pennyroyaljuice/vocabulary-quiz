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
            customWords: [],
            wordOverrides: {},
            hiddenWordIds: []
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

            customWords:
                source &&
                Array.isArray(source.customWords)
                    ? source.customWords
                    : [],

           wordOverrides:
                    source &&
                    typeof source.wordOverrides ===
                        "object" &&
                    source.wordOverrides !== null &&
                    !Array.isArray(
                        source.wordOverrides
                    )
                        ? source.wordOverrides
                        : {},

            hiddenWordIds:
                source &&
                Array.isArray(source.hiddenWordIds)
                ? source.hiddenWordIds.map(String)
                : []
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
                1,

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

                customWords:
                    data.customWords,

                wordOverrides:
                    data.wordOverrides,

                hiddenWordIds:
                    data.hiddenWordIds
            }
        };

        return JSON.stringify(
            backup,
            null,
            2
        );
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

    const importedWords =
        Array.isArray(
            backup.data.customWords
        )
            ? backup.data.customWords
            : [];

    const data =
        load();

    const localWords =
        Array.isArray(data.customWords)
            ? data.customWords
            : [];

    const wordsByKey =
        new Map();

    const usedIds =
        new Set(
            localWords.map(
                (item) =>
                    String(item.id)
            )
        );

    for (const item of localWords) {
        const key =
            normalizeWordKey(
                item.word
            );

        if (!key) {
            continue;
        }

        wordsByKey.set(
            key,
            {
                ...item
            }
        );
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (
        const importedItem
        of importedWords
    ) {
        if (
            !importedItem ||
            typeof importedItem !==
                "object"
        ) {
            skippedCount += 1;
            continue;
        }

        const word =
            cleanWordName(
                importedItem.word
            );

        const key =
            normalizeWordKey(word);

        if (!key) {
            skippedCount += 1;
            continue;
        }

        const existing =
            wordsByKey.get(key);

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
                wordsByKey.set(
                    key,
                    {
                        ...existing,
                        ...importedItem,

                        // 同じ語彙の場合は、
                        // 現在の端末側のIDを維持する
                        id:
                            existing.id,

                        word
                    }
                );

                updatedCount += 1;
            } else {
                skippedCount += 1;
            }

            continue;
        }

        let importedId =
            String(
                importedItem.id || ""
            );

        if (
            !importedId ||
            usedIds.has(importedId)
        ) {
            importedId =
                createCustomWordId();
        }

        const newItem = {
            ...importedItem,
            id:
                importedId,
            word,

            reading:
                String(
                    importedItem.reading ||
                    ""
                ).trim(),

            readingHint:
                String(
                    importedItem
                        .readingHint ||
                    importedItem.reading ||
                    ""
                ).trim(),

            contextHint:
                String(
                    importedItem
                        .contextHint ||
                    ""
                ).trim(),

            meaning:
                String(
                    importedItem.meaning ||
                    ""
                ).trim(),

            description:
                String(
                    importedItem
                        .description ||
                    ""
                ).trim(),

            category:
                String(
                    importedItem.category ||
                    ""
                ).trim(),

            quizTypes:
                Array.isArray(
                    importedItem.quizTypes
                )
                    ? [
                        ...importedItem.quizTypes
                    ]
                    : [],

            status:
                importedItem.status ||
                "pending",

            createdAt:
                Number(
                    importedItem.createdAt
                ) ||
                Date.now(),

            updatedAt:
                Number(
                    importedItem.updatedAt
                ) ||
                null
        };

        wordsByKey.set(
            key,
            newItem
        );

        usedIds.add(
            importedId
        );

        addedCount += 1;
    }

    data.customWords =
        [...wordsByKey.values()];

        const importedOverrides =
            backup.data.wordOverrides &&
            typeof backup.data.wordOverrides ===
                "object" &&
            !Array.isArray(
                backup.data.wordOverrides
            )
                ? backup.data.wordOverrides
                : {};

        let overrideAddedCount = 0;
        let overrideUpdatedCount = 0;
        let overrideSkippedCount = 0;

        for (
            const [
                wordId,
                importedOverride
            ]
            of Object.entries(
                importedOverrides
            )
        ) {
            if (
                !importedOverride ||
                typeof importedOverride !==
                    "object" ||
                Array.isArray(
                    importedOverride
                )
            ) {
                overrideSkippedCount += 1;
                continue;
            }

            const key =
                String(wordId);

            const localOverride =
                data.wordOverrides[key];

            if (!localOverride) {
                data.wordOverrides[key] = {
                    ...importedOverride
                };

                overrideAddedCount += 1;
                continue;
            }

            const localTime =
                Number(
                    localOverride.updatedAt
                ) || 0;

            const importedTime =
                Number(
                    importedOverride.updatedAt
                ) || 0;

            if (
                importedTime >
                localTime
            ) {
                data.wordOverrides[key] = {
                    ...localOverride,
                    ...importedOverride
                };

                overrideUpdatedCount += 1;
            } else {
                overrideSkippedCount += 1;
            }
        }

        const importedHiddenIds =
            Array.isArray(
                backup.data.hiddenWordIds
            )
                ? backup.data.hiddenWordIds
                : [];

        data.hiddenWordIds = [
            ...new Set([
                ...data.hiddenWordIds.map(
                    String
                ),
                ...importedHiddenIds.map(
                    String
                )
            ])
        ];

    save(data);

        return {
            customWords: {
                addedCount,
                updatedCount,
                skippedCount,
                totalCount:
                    data.customWords.length
            },

            wordOverrides: {
                addedCount:
                    overrideAddedCount,

                updatedCount:
                    overrideUpdatedCount,

                skippedCount:
                    overrideSkippedCount,

                totalCount:
                    Object.keys(
                        data.wordOverrides
                    ).length
            },

            hiddenWordIds: {
                totalCount:
                    data.hiddenWordIds.length
            }
        };
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

    function getCustomWords() {
        return load().customWords;
    }

    function addPendingWords(entries) {
        const data = load();

        const existingKeys = new Set(
            data.customWords.map(
                (item) =>
                    normalizeWordKey(
                        item.word
                    )
            )
        );

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
                normalizeWordKey(word);

            if (!key) {
                continue;
            }

            if (existingKeys.has(key)) {
                duplicates.push(word);
                continue;
            }

            const readingHint =
                String(
                    entry.readingHint || ""
                ).trim();

            const contextHint =
                String(
                    entry.contextHint || ""
                ).trim();

            const item = {
                id:
                    createCustomWordId(),

                word,

                reading:
                    readingHint,

                readingHint,

                contextHint,

                meaning: "",
                description: "",
                category: "",
                quizTypes: [],

                status:
                    "pending",

                createdAt:
                    Date.now(),

                updatedAt:
                    null
            };

            data.customWords.push(item);
            existingKeys.add(key);
            added.push(item);
        }

        save(data);

        return {
            added,
            duplicates
        };
    }

    function getReadyCustomWords() {
        return load().customWords.filter(
            (item) =>
                item.status === "ready" &&
                item.word &&
                item.meaning
        );
    }

    function removeCustomWord(wordId) {
        const data = load();

        data.customWords =
            data.customWords.filter(
                (item) =>
                    String(item.id) !==
                    String(wordId)
            );

        save(data);
    }

    function updateCustomWord(wordId, changes) {
        const data = load();

        const index =
            data.customWords.findIndex(
                (item) =>
                    String(item.id) ===
                    String(wordId)
            );

        if (index < 0) {
            throw new Error(
                "追加語彙が見つかりません。"
            );
        }

        data.customWords[index] = {
            ...data.customWords[index],
            ...changes,
            id: data.customWords[index].id
        };

        save(data);

        return {
            ...data.customWords[index]
        };
    }
    
    function getWordOverrides() {
    return {
        ...load().wordOverrides
    };
}

    function getWordOverride(wordId) {
        const overrides =
            load().wordOverrides;

        return overrides[
            String(wordId)
        ] || null;
    }

    function updateWordOverride(
        wordId,
        changes
    ) {
        const data = load();
        const key = String(wordId);

        const allowedChanges = {
            word:
                String(
                    changes.word || ""
                ).trim(),

            reading:
                String(
                    changes.reading || ""
                ).trim(),

            meaning:
                String(
                    changes.meaning || ""
                ).trim(),

            description:
                String(
                    changes.description || ""
                ).trim(),

            category:
                String(
                    changes.category ||
                    "未分類"
                ).trim(),

            quizTypes:
                Array.isArray(
                    changes.quizTypes
                )
                    ? [
                        ...changes.quizTypes
                    ]
                    : [],

            updatedAt:
                Date.now()
        };

        data.wordOverrides[key] = {
            ...(
                data.wordOverrides[key] ||
                {}
            ),
            ...allowedChanges
        };

        save(data);

        return {
            ...data.wordOverrides[key]
        };
    }

    function removeWordOverride(
        wordId
    ) {
        const data = load();
        const key = String(wordId);

        delete data.wordOverrides[key];

        save(data);
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

    function createCustomWordId() {
        return (
            "custom-" +
            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 8)
        );
    }

    function getHiddenWordIds() {
        return load().hiddenWordIds.map(String);
    }

    function isWordHidden(wordId) {
        return getHiddenWordIds()
            .includes(String(wordId));
    }

    function hideWord(wordId) {
        const data = load();
        const key = String(wordId);

        if (!data.hiddenWordIds.includes(key)) {
            data.hiddenWordIds.push(key);
        }

        save(data);
    }

    function restoreWord(wordId) {
        const data = load();
        const key = String(wordId);

        data.hiddenWordIds =
            data.hiddenWordIds.filter(
                (id) => String(id) !== key
            );

        save(data);
    }

    function hideAllStandardWords(wordIds) {
        const data = load();

        data.hiddenWordIds = [
            ...new Set([
                ...data.hiddenWordIds.map(String),
                ...wordIds.map(String)
            ])
        ];

        save(data);
    }

    function restoreAllHiddenWords() {
        const data = load();

        data.hiddenWordIds = [];

        save(data);
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

    return {
        load,
        save,
        getStats,
        getWordStats,
        getSettings,
        updateSetting,
        updateStats,
        getTodayActivity,
        getCustomWords,
        getReadyCustomWords,
        addPendingWords,
        removeCustomWord,
        updateCustomWord,
        normalizeWordKey,
        getHiddenWordIds,
        isWordHidden,
        hideWord,
        restoreWord,
        hideAllStandardWords,
        restoreAllHiddenWords,
        getWordOverrides,
        getWordOverride,
        updateWordOverride,
        removeWordOverride,
        export: exportData,
        exportBackup,
        mergeBackup,
        import: importData,
        reset
    };
})();