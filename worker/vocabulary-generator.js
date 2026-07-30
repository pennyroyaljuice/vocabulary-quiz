const ALLOWED_ORIGINS = new Set([
    "https://pennyroyaljuice.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
]);

const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

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
                headers: corsHeaders
            });
        }

        // ブラウザでURLを直接開いた際の確認用
        if (request.method === "GET") {
            return jsonResponse(
                {
                    status: "ok",
                    message:
                        "Vocabulary Generator API is running."
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

        try {
            const body =
                await request.json();

            const word =
                cleanWord(body.word);

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
- readingは原則ひらがな。
- カタカナ語や英字語のreadingは空文字でよい。
- descriptionは用法、由来、注意点などの短い補足。
- categoryは簡潔な日本語分類にする。
- wordToMeaningとmeaningToWordは原則含める。
- カタカナ語、英字語、慣用句、ことわざ、長い文章表現ではreadingを含めない。
- 入力された見出し語の表記を変更しない。
- JSON以外の文章を出力しない。
                                `.trim()
                            },
                            {
                                role: "user",
                                content:
                                    `見出し語：${word}`
                            }
                        ],

                        response_format: {
                            type: "json_schema",
                            json_schema: {
                                name:
                                    "vocabulary_entry",
                                strict: true,
                                schema:
                                    VOCABULARY_SCHEMA
                            }
                        },

                        temperature: 0.2,
                        max_tokens: 700
                    }
                );

            const generated =
                extractVocabulary(result);

            generated.word = word;

            return jsonResponse(
                {
                    vocabulary:
                        generated
                },
                200,
                corsHeaders
            );
        } catch (error) {
            console.error(error);

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
            .replace(/^```json\s*/u, "")
            .replace(/^```\s*/u, "")
            .replace(/\s*```$/u, "")
            .trim();

    return JSON.parse(cleaned);
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

    if (ALLOWED_ORIGINS.has(origin)) {
        headers[
            "Access-Control-Allow-Origin"
        ] = origin;

        headers.Vary = "Origin";
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