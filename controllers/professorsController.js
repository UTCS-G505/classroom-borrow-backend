const pool = require('../db');

exports.getProfessors = async (req, res) => {
  const { keyword } = req.query;

  try {
    let sql =
      'SELECT professor_id, name, department, phone, email FROM professors';
    const values = [];

    if (keyword) {
      sql +=
        ' WHERE name LIKE ? OR department LIKE ? OR phone LIKE ? OR email LIKE ?';
      const q = `%${keyword}%`;
      values.push(q, q, q, q);
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await pool.query(sql, values);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.createProfessor = async (req, res) => {
  const { name, department, phone, email } = req.body;
  const missing = [];

  if (!name) missing.push('name');
  if (!email) missing.push('email');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `缺少必要欄位: ${missing.join(', ')}`,
    });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO professors (name, department, phone, email) VALUES (?, ?, ?, ?)',
      [name, department || null, phone || null, email]
    );

    res.json({ message: '教授資料已新增', professor_id: result.insertId });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.updateProfessor = async (req, res) => {
  const professorId = req.params.id;
  const { name, department, phone, email } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (department !== undefined) {
    updates.push('department = ?');
    values.push(department);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '沒有可更新的欄位' });
  }

  values.push(professorId);

  try {
    const [result] = await pool.query(
      `UPDATE professors SET ${updates.join(', ')} WHERE professor_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到教授資料' });
    }

    res.json({ message: '教授資料已更新', professor_id: professorId });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.deleteProfessor = async (req, res) => {
  const professorId = req.params.id;

  try {
    const [result] = await pool.query(
      'DELETE FROM professors WHERE professor_id = ?',
      [professorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到教授資料' });
    }

    res.json({ message: '教授資料已刪除', professor_id: professorId });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
