const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'crm_session';
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header = '') {
  return String(header).split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class AuthService {
  constructor(database) {
    this.db = database;
  }

  normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  validateCredentials(username, password) {
    const normalizedUsername = this.normalizeUsername(username);
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      throw new AuthError('INVALID_USERNAME', 'Tên đăng nhập phải có 3-32 ký tự: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
    }
    const passwordText = String(password || '');
    if (passwordText.length < 8 || Buffer.byteLength(passwordText, 'utf8') > 72) {
      throw new AuthError('INVALID_PASSWORD', 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte.');
    }
    return { username: normalizedUsername, password: passwordText };
  }

  register({ username, password }) {
    const credentials = this.validateCredentials(username, password);
    const passwordHash = bcrypt.hashSync(credentials.password, 12);
    try {
      const result = this.db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'STAFF')"
      ).run(credentials.username, passwordHash);
      return this.publicUser(this.db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(result.lastInsertRowid));
    } catch (error) {
      if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
        throw new AuthError('USERNAME_TAKEN', 'Tên đăng nhập đã được sử dụng.', 409);
      }
      throw error;
    }
  }

  login({ username, password }) {
    const normalizedUsername = this.normalizeUsername(username);
    const passwordText = String(password || '');
    const user = this.db.prepare(
      'SELECT id, username, password_hash, role FROM users WHERE lower(username) = ?'
    ).get(normalizedUsername);
    if (!user || !bcrypt.compareSync(passwordText, user.password_hash)) {
      throw new AuthError('INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.', 401);
    }
    return { user: this.publicUser(user), ...this.createSession(user.id) };
  }

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
    this.db.prepare(
      'INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(userId, hashToken(token), expiresAt);
    return { token, expiresAt };
  }

  getUserByToken(token) {
    if (!token) return null;
    const now = new Date().toISOString();
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
    const row = this.db.prepare(`
      SELECT session.id AS session_id, user.id, user.username, user.role
      FROM auth_sessions session
      JOIN users user ON user.id = session.user_id
      WHERE session.token_hash = ? AND session.expires_at > ?
    `).get(hashToken(token), now);
    if (!row) return null;
    this.db.prepare('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.session_id);
    return this.publicUser(row);
  }

  getRequestToken(req) {
    return parseCookies(req.headers.cookie || '')[COOKIE_NAME] || null;
  }

  getRequestUser(req) {
    return this.getUserByToken(this.getRequestToken(req));
  }

  revokeRequestSession(req) {
    const token = this.getRequestToken(req);
    if (token) this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token));
  }

  sessionCookie(token) {
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}`;
  }

  clearCookie() {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  }

  middleware() {
    return (req, res, next) => {
      const user = this.getRequestUser(req);
      if (!user) {
        return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập để tiếp tục.' });
      }
      req.user = user;
      next();
    };
  }

  publicUser(user) {
    return { id: Number(user.id), username: user.username, role: user.role };
  }
}

module.exports = { AuthService, AuthError, COOKIE_NAME, SESSION_LIFETIME_MS, hashToken, parseCookies };
