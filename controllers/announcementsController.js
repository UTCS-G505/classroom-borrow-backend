const pool = require('../db');
const dayjs = require('dayjs');

// Get all announcements (Public/User view - only active? or Admin view - all?)
// Ideally: Admin sees all, User sees only active (not expired).
// For now, let's make a general get that can filter?
// Simplified: Users usually just need "current valid announcements".
// Admin needs "all".
// Let's implement getAll for Admin, and getActive for Users?
// Or just getAll with a query param?
// Let's stick to: list all for now, maybe filter in frontend or add query param later.
// Actually, for security/cleanliness, let's defaults to ALL for admin, and Active for public if we separate.
// But mostly commonly, a simple getAll is fine, maybe with ?active=true support.

exports.getAllAnnouncements = async (req, res) => {
  try {
    // defaults: order by created_at desc
    let sql = 'SELECT * FROM announcements ORDER BY created_at DESC';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('Get announcements error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.getAnnouncementById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM announcements WHERE announcement_id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到該公告' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Get announcement error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.createAnnouncement = async (req, res) => {
  const { title, content, expired_at } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: '標題與內容為必填' });
  }

  const sql = `INSERT INTO announcements (title, content, expired_at) VALUES (?, ?, ?)`;

  try {
    const [result] = await pool.query(sql, [
      title,
      content,
      expired_at || null,
    ]);
    res.status(201).json({
      message: '公告已建立',
      announcement_id: result.insertId,
      title,
      content,
      expired_at,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'), // approximation
    });
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.updateAnnouncement = async (req, res) => {
  const { id } = req.params;
  const { title, content, expired_at } = req.body;

  if (!title && !content && expired_at === undefined) {
    return res.status(400).json({ error: '無更新內容' });
  }

  // Let's do dynamic SQL generation for flexibility
  const fields = [];
  const values = [];

  if (title !== undefined) {
    fields.push('title = ?');
    values.push(title);
  }
  if (content !== undefined) {
    fields.push('content = ?');
    values.push(content);
  }
  if (expired_at !== undefined) {
    fields.push('expired_at = ?');
    values.push(expired_at);
  }

  if (fields.length === 0) return res.status(400).json({ error: '無更新欄位' });

  values.push(id);
  const sql = `UPDATE announcements SET ${fields.join(', ')} WHERE announcement_id = ?`;

  try {
    const [result] = await pool.query(sql, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到該公告' });
    }
    res.json({ message: '公告已更新' });
  } catch (err) {
    console.error('Update announcement error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM announcements WHERE announcement_id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到該公告' });
    }
    res.json({ message: '公告已刪除' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
