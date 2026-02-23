const pool = require('../db');

exports.getSchedule = async (req, res) => {
  try {
    const { date, start_date, end_date, classroom_id } = req.query;
    let sql = 'SELECT * FROM schedule WHERE 1=1';
    const values = [];

    if (classroom_id) {
      sql += ' AND classroom_id = ?';
      values.push(classroom_id);
    }

    if (start_date && end_date) {
      sql += ' AND date BETWEEN ? AND ?';
      values.push(start_date, end_date);
    } else if (date) {
      sql += ' AND date = ?';
      values.push(date);
    }

    sql += ' ORDER BY date ASC, time_slot ASC';

    const [rows] = await pool.query(sql, values);
    res.json(rows);
  } catch (err) {
    console.error('getSchedule error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id) || Number(id) <= 0) {
      return res.status(400).json({ error: '無效的課表編號' });
    }

    const allowedFields = [
      'classroom_id',
      'date',
      'time_slot',
      'booked_by',
      'borrow_request_id',
      'event_name',
      'status',
    ];
    const allowedFieldSet = new Set(allowedFields);

    const updates = [];
    const values = [];

    Object.keys(req.body).forEach((field) => {
      if (!allowedFieldSet.has(field)) return;
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: '沒有可更新的欄位' });
    }

    values.push(id);
    const sql = `UPDATE schedule SET ${updates.join(', ')} WHERE schedule_id = ?`;
    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到該課表資料' });
    }

    res.json({ message: '課表已更新', schedule_id: Number(id) });
  } catch (err) {
    console.error('update schedule error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
