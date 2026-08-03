-- 1. Bảng Người dùng hệ thống (Admin / Staff)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN', 'STAFF')) NOT NULL DEFAULT 'STAFF',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Tài khoản Facebook cá nhân
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT NOT NULL,
    profile_dir TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    broadcast_daily_count INTEGER DEFAULT 0,
    last_broadcast_date DATE DEFAULT (DATE('now')),
    status TEXT CHECK(status IN ('ACTIVE', 'DISCONNECTED', 'CHECKPOINT')) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Hội thoại (Threads)
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    thread_url TEXT,
    contact_name TEXT,
    last_message TEXT,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_unread BOOLEAN DEFAULT 1,
    status TEXT CHECK(status IN ('UNPROCESSED', 'ASSIGNED', 'COMPLETED')) DEFAULT 'UNPROCESSED',
    assigned_user_id INTEGER,
    ai_paused_until DATETIME,
    sync_status TEXT DEFAULT 'LOCAL',
    sync_cursor TEXT,
    sync_error TEXT,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Bảng Tin nhắn (Messages)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    fb_message_id TEXT UNIQUE,
    client_message_id TEXT,
    sender_id TEXT NOT NULL,
    content TEXT,
    media_type TEXT CHECK(media_type IN ('text', 'image', 'video', 'voice', 'file')) DEFAULT 'text',
    media_url TEXT,
    local_media_path TEXT,
    is_outgoing BOOLEAN NOT NULL DEFAULT 0,
    is_unsent BOOLEAN NOT NULL DEFAULT 0,
    delivery_status TEXT CHECK(delivery_status IN ('pending', 'sent', 'failed')) DEFAULT 'sent',
    delivery_error TEXT,
    timestamp_ms INTEGER DEFAULT 0,
    timestamp_source TEXT DEFAULT 'unknown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- 5. Bảng Tìm kiếm Toàn văn FTS5 (Full-Text Search)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    thread_id UNINDEXED,
    sender_id UNINDEXED,
    tokenize='unicode61'
);

-- Trigger tự động thêm tin nhắn vào FTS5
CREATE TRIGGER IF NOT EXISTS messages_ai_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content, thread_id, sender_id)
    VALUES (new.id, new.content, new.thread_id, new.sender_id);
END;

CREATE TRIGGER IF NOT EXISTS messages_ai_update AFTER UPDATE ON messages BEGIN
    UPDATE messages_fts SET content = new.content, thread_id = new.thread_id, sender_id = new.sender_id
    WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS messages_ai_delete AFTER DELETE ON messages BEGIN
    DELETE FROM messages_fts WHERE rowid = old.id;
END;

-- 6. Bảng Liên hệ / Lead khách hàng (Contacts)
CREATE TABLE IF NOT EXISTS contacts (
    thread_id TEXT PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    lead_captured BOOLEAN DEFAULT 0,
    tags TEXT DEFAULT '[]',
    notes TEXT,
    FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- 7. Bảng Cấu hình Auto Reply & AI
CREATE TABLE IF NOT EXISTS auto_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    created_by_staff_id INTEGER,
    trigger_keyword TEXT NOT NULL,
    response_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT UNIQUE NOT NULL,
    provider TEXT CHECK(provider IN ('LOCAL_OLLAMA', 'CLOUD_OPENAI', 'CLOUD_GEMINI')) NOT NULL,
    api_key TEXT,
    model_name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- INDICES TỐI ƯU
CREATE INDEX IF NOT EXISTS idx_threads_account ON threads(account_id);
CREATE INDEX IF NOT EXISTS idx_threads_assigned ON threads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
