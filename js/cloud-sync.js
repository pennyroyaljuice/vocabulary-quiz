"use strict";

const CloudSync = (() => {
    const ENDPOINT =
        "https://vocabulary-sync.pennyroyal-juice.workers.dev/backup";

    const SECRET_STORAGE_KEY =
        "vocabularyQuizSyncSecret";

    function getEndpoint() {
        return ENDPOINT;
    }

    function getSecret() {
        return (
            localStorage.getItem(
                SECRET_STORAGE_KEY
            ) || ""
        );
    }

    function setSecret(secret) {
        const normalized =
            String(secret || "")
                .trim();

        if (!normalized) {
            localStorage.removeItem(
                SECRET_STORAGE_KEY
            );

            return;
        }

        localStorage.setItem(
            SECRET_STORAGE_KEY,
            normalized
        );
    }

    async function uploadBackup() {
        const secret =
            getSecret();

        if (!secret) {
            throw new Error(
                "クラウド同期用のキーが設定されていません。"
            );
        }

        const backup =
            Storage.exportBackup();

        const response =
            await fetch(
                ENDPOINT,
                {
                    method:
                        "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "X-Sync-Secret":
                            secret
                    },

                    body:
                        backup
                }
            );

        const result =
            await readJsonResponse(
                response
            );

        if (!response.ok) {
            throw new Error(
                result?.error ||
                `クラウド保存に失敗しました。 HTTP ${response.status}`
            );
        }

        return result;
    }

async function downloadBackup() {
    const secret =
        getSecret();

    if (!secret) {
        throw new Error(
            "クラウド同期用のキーが設定されていません。"
        );
    }

    const response =
        await fetch(
            ENDPOINT,
            {
                method:
                    "GET",

                headers: {
                    "X-Sync-Secret":
                        secret
                }
            }
        );

    const result =
        await readJsonResponse(
            response
        );

    if (!response.ok) {
        throw new Error(
            result?.error ||
            `クラウド取得に失敗しました。 HTTP ${response.status}`
        );
    }

    if (
        !result?.exists ||
        !result?.backup
    ) {
        return {
            exists:
                false,

            mergeResult:
                null
        };
    }

    const mergeResult =
        Storage.mergeBackup(
            result.backup
        );

    return {
        exists:
            true,

        backup:
            result.backup,

        mergeResult
    };
}
    async function readJsonResponse(
        response
    ) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    return {
    getEndpoint,
    getSecret,
    setSecret,
    uploadBackup,
    downloadBackup
};
    };
})();