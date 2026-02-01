const pool = require('../db');

exports.getSchedule = async (req, res) => {
  try {
    const { date, start_date, end_date, classroom_id } = req.query;
    let requestSql;
    let requestValues;

    // Filter for valid bookings (Approved or Pending)
    // Statuses: '核准' (Admin/TA), '教師核准' (Teacher), '審核中' (Pending), '已預約' (Legacy/Admin)
    // We explicitly exclude '退件', '已取消', '已歸還'
    const statusCondition = `status IN ('核准', '教師核准', '審核中', '已預約')`;

    if (start_date && end_date) {
      requestSql = `
        SELECT * FROM borrow_requests 
        WHERE start_date >= ? AND start_date <= ? 
          AND classroom_id = ?
          AND ${statusCondition}
      `;
      requestValues = [start_date, end_date, classroom_id];
    } else {
      requestSql = `
        SELECT * FROM borrow_requests 
        WHERE start_date = ? 
          AND classroom_id = ?
          AND ${statusCondition}
      `;
      requestValues = [date, classroom_id];
    }

    const [requestRows] = await pool.query(requestSql, requestValues);

    // Transform requestRows to the expected frontend format
    const formattedRequests = requestRows.map((req) => {
      const start = req.start_time.substring(0, 5);
      const end = req.end_time.substring(0, 5);

      // Determine standardized status for frontend
      let frontendStatus = req.status;
      if (req.status === '核准' || req.status === '已預約') {
        frontendStatus = '已預約'; // Green
      } else if (req.status === '教師核准') {
        frontendStatus = '教師核准'; // Purple
      } else if (req.status === '審核中') {
        frontendStatus = '審核中'; // Blue
      }

      return {
        schedule_id: req.request_id, // Use unique request_id
        classroom_id: req.classroom_id,
        date: req.start_date,
        time_slot: `${start}-${end}`,
        event_name: req.event_name,
        status: frontendStatus,
      };
    });

    res.json(formattedRequests);
  } catch (err) {
    console.error('序列 error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
