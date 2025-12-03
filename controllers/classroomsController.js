const pool = require('../db');

exports.getAllClassrooms = (req, res) => {
    pool.query(`SELECT * FROM classrooms `, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json(rows)
      }
    });
}
exports.getClassroomsByid = (req, res) => {
    const value = req.params.id;
    const sql = 'SELECT * FROM classrooms WHERE classroom_id = ?';
    pool.query(sql, value, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          res.status(500).send('資料庫錯誤');
        } else {
          res.json(rows);
        }
    });  
}
exports.postClassrooms = (req, res) => {
    const {
      classroom_id,
      name, 
      type,
      capacity,
      description,
      image_url
    } = req.body;


    const missing = [];
    if (!classroom_id) missing.push('classroom_id');
    if (!name) missing.push('type');
    if (!capacity) missing.push('capacity');
    if (!description) missing.push('tdescriptionype');
    if (!image_url) missing.push('capimage_urlacity');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `缺少必要欄位: ${missing.join(', ')}`
      });
    }
      /*
    if (!classroom_id || !name || !type || !capacity || !description || !image_url) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
      */

    const sql = `
        INSERT INTO classrooms 
        ( classroom_id , name , type , capacity , description , image_url )
        VALUES
        ( ? , ? , ? , ? , ? , ? )`
    const values = 
    [
      classroom_id,
      name, 
      type,
      capacity,
      description,
      image_url
    ]    
    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('新增資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '已新增教室'});
    });
}

exports.updateClassrooms = (req, res) => {
    const classroom_id = req.params.id;
    const {
      name, 
      type,
      capacity,
      description,
      image_url
    } = req.body;

    if (!classroom_id || !name || !type || !capacity || !description || !image_url) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    const sql = `
        UPDATE classrooms
        SET name = ?,
        type = ?,
        capacity = ?,
        description = ?,
        image_url = ?
        WHERE classroom_id = ?;`
    const values = 
    [      
      name, 
      type,
      capacity,
      description,
      image_url,
      classroom_id
    ]
    
    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('資料更新失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '教室資訊更新'});
    });
}

exports.deleteClassrooms = (req, res) => {
    const sql = `
        DELETE FROM classrooms
        WHERE classroom_id = ?;`
    const values = req.params.id;

    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('資料更新失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '教室已刪除' });
    });
}