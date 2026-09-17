import "../js/share-format.js";

const FORMAT = globalThis.VocabularyShareFormat;
const RELEASE = "2026-09-17-sharing-v1";
const ORIGINS = new Set(["https://pennyroyaljuice.github.io", "http://localhost:5500", "http://127.0.0.1:5500"]);

function randomCode() {
    let value = "";
    while (value.length < 24) {
        for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
            if (byte < 250 && value.length < 24) value += String(byte % 10);
        }
    }
    return value;
}
async function hash(value) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function readBody(request) {
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new Error("JSON形式で送信してください。");
    if (Number(request.headers.get("Content-Length")) > FORMAT.MAX_BYTES) throw new Error("共有データが大きすぎます（最大1MB）。");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("共有データがありません。");
    const decoder = new TextDecoder();
    let content = "", length = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > FORMAT.MAX_BYTES) {
                await reader.cancel();
                throw new Error("共有データが大きすぎます（最大1MB）。");
            }
            content += decoder.decode(value, { stream: true });
        }
        return JSON.parse(content + decoder.decode());
    } finally { reader.releaseLock(); }
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin");
        const headers = {
            "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff", "Vary": "Origin",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Delete-Token"
        };
        if (ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
        const json = (body, status = 200) => new Response(JSON.stringify({ ...body, release: RELEASE }), { status, headers });
        if (origin && !ORIGINS.has(origin)) return json({ error: "このサイトからは利用できません。" }, 403);
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
        const path = new URL(request.url).pathname;
        if (path === "/health" && request.method === "GET") {
            try {
                await env.DB.prepare("SELECT code FROM shared_vocabulary LIMIT 1").first();
                return json({ status: "ok" });
            } catch { return json({ error: "共有の保存先がまだ準備されていません。" }, 503); }
        }
        if (!env.DB) return json({ error: "共有の保存先が設定されていません。" }, 503);
        try {
            const limiter = request.method === "POST" ? env.UPLOAD_LIMIT : env.READ_LIMIT;
            if (limiter && !(await limiter.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" })).success) {
                return json({ error: "短時間の操作が多いため、1分ほど待って再度お試しください。" }, 429);
            }
            if (path === "/shares" && request.method === "POST") {
                let pack;
                try { pack = FORMAT.normalizePack(await readBody(request)); }
                catch (error) { return json({ error: error instanceof SyntaxError ? "共有データのJSONを読み取れません。" : error.message }, 400); }
                const createdAt = new Date().toISOString();
                const deleteToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
                const ownerHash = await hash(deleteToken);
                for (let attempt = 0; attempt < 3; attempt++) {
                    const code = randomCode();
                    const result = await env.DB.prepare("INSERT OR IGNORE INTO shared_vocabulary (code, name, created_at, payload, owner_hash) VALUES (?, ?, ?, ?, ?)")
                        .bind(code, pack.name, createdAt, JSON.stringify(pack.words), ownerHash).run();
                    if (result.meta.changes === 1) return json({ code, name: pack.name, count: pack.words.length, createdAt, deleteToken }, 201);
                }
                return json({ error: "共有コードを発行できませんでした。再度お試しください。" }, 503);
            }
            const match = path.match(/^\/shares\/(\d{24})$/);
            if (!match) return json({ error: "共有コードまたはURLが正しくありません。" }, 404);
            const code = match[1];
            if (request.method === "GET") {
                const row = await env.DB.prepare("SELECT name, created_at, payload FROM shared_vocabulary WHERE code = ?").bind(code).first();
                if (!row) return json({ error: "共有セットが見つかりません。コードが違うか、公開が停止されています。" }, 404);
                return json({ code, name: row.name, createdAt: row.created_at, words: JSON.parse(row.payload) });
            }
            if (request.method === "DELETE") {
                const token = request.headers.get("X-Delete-Token") || "";
                if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "公開を停止する権限がありません。" }, 403);
                const result = await env.DB.prepare("DELETE FROM shared_vocabulary WHERE code = ? AND owner_hash = ?").bind(code, await hash(token)).run();
                if (result.meta.changes !== 1) return json({ error: "公開済みセットがないか、公開停止の権限がありません。" }, 404);
                return json({ deleted: true });
            }
            return json({ error: "対応していない操作です。" }, 405);
        } catch (error) {
            console.error("Sharing request failed", error?.name);
            return json({ error: "共有サーバーでエラーが発生しました。時間をおいて再度お試しください。" }, 503);
        }
    }
};
