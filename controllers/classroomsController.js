const pool = require('../db');

exports.getAllClassrooms = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM classrooms');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.getClassroomsById = async (req, res) => {
  try {
    const value = req.params.id;
    const sql = 'SELECT * FROM classrooms WHERE classroom_id = ?';
    const [rows] = await pool.query(sql, [value]);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.postClassrooms = async (req, res) => {
  const { classroom_id, name, type, capacity, description, image_url } =
    req.body;

  const missing = [];
  if (!classroom_id) missing.push('classroom_id');
  if (!name) missing.push('name');
  if (!capacity) missing.push('capacity');
  if (!description) missing.push('description');
  if (!image_url) missing.push('image_url');
  if (!type) missing.push('type');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `缺少必要欄位: ${missing.join(', ')}`,
    });
  }

  const sql = `
        INSERT INTO classrooms 
        ( classroom_id , name , type , capacity , description , image_url )
        VALUES
        ( ? , ? , ? , ? , ? , ? )`;
  const values = [classroom_id, name, type, capacity, description, image_url];

  try {
    await pool.query(sql, values);
    res.json({ message: '已新增教室' });
  } catch (err) {
    console.error('新增資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.updateClassrooms = async (req, res) => {
  const classroom_id = req.params.id;
  const { name, type, capacity, description, image_url } = req.body;

  if (
    !classroom_id ||
    !name ||
    !type ||
    !capacity ||
    !description ||
    !image_url
  ) {
    return res.status(400).json({ error: '缺少必要欄位' });
  }

  const sql = `
        UPDATE classrooms
        SET name = ?,
        type = ?,
        capacity = ?,
        description = ?,
        image_url = ?
        WHERE classroom_id = ?;`;
  const values = [name, type, capacity, description, image_url, classroom_id];

  try {
    await pool.query(sql, values);
    res.json({ message: '教室資訊更新' });
  } catch (err) {
    console.error('資料更新失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.deleteClassrooms = async (req, res) => {
  const sql = `
        DELETE FROM classrooms
        WHERE classroom_id = ?;`;
  const values = req.params.id;

  try {
    await pool.query(sql, [values]);
    res.json({ message: '教室已刪除' });
  } catch (err) {
    console.error('資料更新失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
