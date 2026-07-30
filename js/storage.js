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
            settings: { ...DEFAULT_SETTINGS },
            activity: {}
        };
    }

    function createDefaultWordStats() {
        return {
            asked: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            favorite: false,
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
                    : {}
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

    function toggleFavorite(wordId) {
        const data = load();
        const key = String(wordId);

        data.stats[key] = {
            ...createDefaultWordStats(),
            ...(data.stats[key] || {})
        };

        data.stats[key].favorite =
            !data.stats[key].favorite;

        save(data);

        return data.stats[key].favorite;
    }

    function exportData() {
        return JSON.stringify(
            load(),
            null,
            2
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
        toggleFavorite,
        export: exportData,
        import: importData,
        reset
    };
})();