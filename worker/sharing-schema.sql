CREATE TABLE IF NOT EXISTS shared_vocabulary (
    code TEXT PRIMARY KEY CHECK(length(code) = 24),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    owner_hash TEXT NOT NULL
);
