const db = require('../database/db');

class AssignmentManager {
  // Gán nhân viên phụ trách độc quyền cho một hội thoại
  assignThread(threadId, userId) {
    const thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(threadId);
    if (!thread) {
      return { success: false, error: 'Không tìm thấy hội thoại' };
    }

    if (thread.assigned_user_id && thread.assigned_user_id !== userId) {
      const current = db.prepare('SELECT username FROM users WHERE id = ?').get(thread.assigned_user_id);
      return {
        success: false,
        error: `Hội thoại đã được phân công cho nhân viên: ${current?.username}`
      };
    }

    db.prepare(`
      UPDATE threads
      SET assigned_user_id = ?, status = 'ASSIGNED'
      WHERE id = ?
    `).run(userId, threadId);

    return { success: true, thread_id: threadId, assigned_user_id: userId };
  }

  // Nhân viên hoàn thành hội thoại (đánh dấu Đã chốt)
  completeThread(threadId) {
    db.prepare(`
      UPDATE threads SET status = 'COMPLETED' WHERE id = ?
    `).run(threadId);
    return { success: true, thread_id: threadId, status: 'COMPLETED' };
  }

  // Lấy danh sách hội thoại theo tab/filter
  getThreadsByFilter(userId, role, tab = 'ALL') {
    let query = `
      SELECT t.*, c.phone, c.email, c.lead_captured, c.avatar_url
      FROM threads t
      LEFT JOIN contacts c ON c.thread_id = t.id
    `;
    const params = [];

    if (tab === 'ASSIGNED') {
      query += ' WHERE t.status = ? AND t.assigned_user_id = ?';
      params.push('ASSIGNED', userId);
    } else if (tab === 'UNPROCESSED') {
      query += ' WHERE t.status = ?';
      params.push('UNPROCESSED');
    } else if (tab === 'COMPLETED') {
      query += ' WHERE t.status = ?';
      params.push('COMPLETED');
    } else {
      // Tab ALL: staff chỉ thấy thread của mình + chưa xử lý; admin thấy tất cả
      if (role !== 'ADMIN') {
        query += ' WHERE (t.assigned_user_id = ? OR t.status = ?)';
        params.push(userId, 'UNPROCESSED');
      }
    }

    query += ' ORDER BY t.last_activity DESC';
    return db.prepare(query).all(...params);
  }
}

module.exports = new AssignmentManager();
