const ALLOWED_ORIGINS = new Set([
    "https://pennyroyaljuice.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
]);

const MODEL =
    "@cf/meta/llama-3.1-8b-instruct-fast";

const VOCABULARY_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        word: {
            type: "string"
        },

        reading: {
            type: "string"
        },

        meaning: {
            type: "string"
        },

        description: {
            type: "string"
        },

        category: {
            type: "string"
        },

        quizTypes: {
            type: "array",

            items: {
                type: "string",

                enum: [
                    "wordToMeaning",
                    "meaningToWord",
                    "reading"
                ]
            }
        }
    },

    required: [
        "word",
        "reading",
        "meaning",
        "description",
        "category",
        "quizTypes"
    ]
};

export default {
    async fetch(request, env) {
        const origin =
            request.headers.get("Origin") || "";

        const corsHeaders =
            createCorsHeaders(origin);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status:
                    ALLOWED_ORIGINS.has(origin)
                        ? 204
                        : 403,

                headers:
                    corsHeaders
            });
        }

        if (request.method === "GET") {
            return jsonResponse(
                {
                    status: "ok",

                    message:
                        "Vocabulary Generator API is running.",

                    model:
                        MODEL
                },

                200,

                corsHeaders
            );
        }

        if (request.method !== "POST") {
            return jsonResponse(
                {
                    error:
                        "POSTメソッドを使用してください。"
                },

                405,

                corsHeaders
            );
        }

        if (!ALLOWED_ORIGINS.has(origin)) {
            return jsonResponse(
                {
                    error:
                        "このWebサイトからのアクセスは許可されていません。"
                },

                403,

                corsHeaders
            );
        }

        if (!env.AI) {
            return jsonResponse(
                {
                    error:
                        "Workers AIのバインディングが設定されていません。"
                },

                500,

                corsHeaders
            );
        }

        try {
            const body =
                await request.json();

            const word =
                cleanWord(body.word);

            const readingHint =
                String(
                    body.readingHint || ""
                ).trim();

            const contextHint =
                String(
                    body.contextHint || ""
                ).trim();

            if (!word) {
                return jsonResponse(
                    {
                        error:
                            "語彙を入力してください。"
                    },

                    400,

                    corsHeaders
                );
            }

            if (word.length > 100) {
                return jsonResponse(
                    {
                        error:
                            "語彙が長すぎます。"
                    },

                    400,

                    corsHeaders
                );
            }

            const result =
                await env.AI.run(
                    MODEL,

                    {
                        messages: [
                            {
                                role: "system",

                                content: `
あなたは日本語辞典の編集者です。
入力された見出し語について、語彙学習クイズ用の辞書データを作成してください。

必須ルール：
- 意味は辞書的・簡潔・正確にする。
- 不確かな語源や出典を断定しない。
- readingは原則ひらがなにする。
- カタカナ語や英字語ではreadingを空文字にしてよい。
- descriptionには用法、由来、注意点などの短い補足を書く。
- categoryは簡潔な日本語分類にする。
- wordToMeaningとmeaningToWordは原則含める。
- カタカナ語、英字語、慣用句、ことわざ、長い文章表現ではreadingをquizTypesに含めない。
- 漢字を含む単独語や熟語では、読みを学ぶ価値がある場合のみreadingをquizTypesに含める。
- 入力された見出し語の表記を変更しない。
- JSON以外の文章を出力しない。
- 利用者が読みを指定した場合は、その読みを原則として使用する。
- 利用者が文脈や分野を指定した場合は、その文脈に適した意味を優先する。
- 指定された読みや文脈が見出し語と明らかに矛盾する場合は、無理に断定しない。
                                `.trim()
                            },

                           {
                            role: "user",

                            content: [
                                `見出し語：${word}`,

                                readingHint
                                    ? `利用者が指定した読み：${readingHint}`
                                    : "",

                                contextHint
                                    ? `利用者からの文脈・分野のヒント：${contextHint}`
                                    : "",

                                readingHint
                                    ? "指定された読みを原則として維持し、その読みで使われる語義を生成してください。"
                                    : "",

                                contextHint
                                    ? "補足ヒントに合う語義を優先してください。"
                                    : ""
                            ]
                                .filter(Boolean)
                                .join("\n")
                        }
                        ],

                        response_format: {
                            type:
                                "json_schema",

                            json_schema:
                                VOCABULARY_SCHEMA
                        },

                        temperature:
                            0.2,

                        max_tokens:
                            700
                    }
                );

            const generated =
                extractVocabulary(
                    result
                );

            const normalized =
                normalizeVocabulary(
                    generated,
                    word,
                    readingHint
                );

            return jsonResponse(
                {
                    vocabulary:
                        normalized
                },

                200,

                corsHeaders
            );
        } catch (error) {
            console.error(
                "AI ERROR:",
                error
            );

            console.error(
                "STACK:",
                error?.stack
            );

            return jsonResponse(
                {
                    error:
                        "語彙情報の生成中にエラーが発生しました。",

                    detail:
                        String(
                            error?.message ||
                            error
                        )
                },

                500,

                corsHeaders
            );
        }
    }
};

function extractVocabulary(result) {
    if (
        result &&
        typeof result.response === "object" &&
        result.response !== null
    ) {
        return result.response;
    }

    const text =
        typeof result?.response === "string"
            ? result.response
            : typeof result?.choices?.[0]?.text ===
                "string"
                ? result.choices[0].text
                : "";

    if (!text) {
        throw new Error(
            "AIの生成結果が空です。"
        );
    }

    const cleaned =
        text
            .replace(
                /^```json\s*/u,
                ""
            )
            .replace(
                /^```\s*/u,
                ""
            )
            .replace(
                /\s*```$/u,
                ""
            )
            .trim();

    return JSON.parse(
        cleaned
    );
}

function normalizeVocabulary(
    generated,
    originalWord,
    readingHint = "")
{
    const quizTypes =
        Array.isArray(
            generated.quizTypes
        )
            ? generated.quizTypes.filter(
                (type) =>
                    [
                        "wordToMeaning",
                        "meaningToWord",
                        "reading"
                    ].includes(type)
            )
            : [];

    const uniqueQuizTypes =
        [...new Set(quizTypes)];

    if (
        !uniqueQuizTypes.includes(
            "wordToMeaning"
        )
    ) {
        uniqueQuizTypes.unshift(
            "wordToMeaning"
        );
    }

    if (
        !uniqueQuizTypes.includes(
            "meaningToWord"
        )
    ) {
        uniqueQuizTypes.push(
            "meaningToWord"
        );
    }

    const reading =
        String(
            readingHint ||
            generated.reading ||
            ""
        ).trim();

    if (!reading) {
        const readingIndex =
            uniqueQuizTypes.indexOf(
                "reading"
            );

        if (readingIndex >= 0) {
            uniqueQuizTypes.splice(
                readingIndex,
                1
            );
        }
    }

    return {
        word:
            originalWord,

        reading,

        meaning:
            String(
                generated.meaning || ""
            ).trim(),

        description:
            String(
                generated.description || ""
            ).trim(),

        category:
            String(
                generated.category ||
                "未分類"
            ).trim(),

        quizTypes:
            uniqueQuizTypes
    };
}

function cleanWord(value) {
    return String(value || "")
        .replace(
            /^[\s・•●○□■\-–—]+/u,
            ""
        )
        .replace(
            /[（(][^）)]*[）)]/gu,
            ""
        )
        .trim();
}

function createCorsHeaders(origin) {
    const headers = {
        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type",

        "Access-Control-Max-Age":
            "86400",

        "Content-Type":
            "application/json; charset=utf-8"
    };

    if (
        ALLOWED_ORIGINS.has(origin)
    ) {
        headers[
            "Access-Control-Allow-Origin"
        ] = origin;

        headers.Vary =
            "Origin";
    }

    return headers;
}

function jsonResponse(
    data,
    status,
    headers
) {
    return new Response(
        JSON.stringify(data),

        {
            status,
            headers
        }
    );
}