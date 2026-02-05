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
      // Query for bookings that overlap with the date range
      requestSql = `
        SELECT * FROM borrow_requests 
        WHERE classroom_id = ?
          AND ${statusCondition}
          AND (
            (borrow_type = '單次借用' AND start_date >= ? AND start_date <= ?)
            OR
            (borrow_type = '多次借用' AND start_date <= ? AND (end_date >= ? OR end_date IS NULL))
          )
      `;
      requestValues = [classroom_id, start_date, end_date, end_date, start_date];
    } else {
      // Query for single date
      requestSql = `
        SELECT * FROM borrow_requests 
        WHERE classroom_id = ?
          AND ${statusCondition}
          AND (
            (borrow_type = '單次借用' AND start_date = ?)
            OR
            (borrow_type = '多次借用' AND start_date <= ? AND (end_date >= ? OR end_date IS NULL))
          )
      `;
      requestValues = [classroom_id, date, date, date];
    }

    const [requestRows] = await pool.query(requestSql, requestValues);

    const formattedRequests = [];

    requestRows.forEach((req) => {
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

      if (req.borrow_type === '單次借用') {
        // Single booking: add one entry
        formattedRequests.push({
          schedule_id: req.request_id,
          classroom_id: req.classroom_id,
          date: req.start_date,
          time_slot: `${start}-${end}`,
          event_name: req.event_name,
          status: frontendStatus,
        });
      } else if (req.borrow_type === '多次借用') {
        // Recurring booking: expand into multiple entries
        const bookingStart = new Date(req.start_date);
        const bookingEnd = req.end_date ? new Date(req.end_date) : new Date(req.start_date);
        
        // Query range
        const queryStart = start_date ? new Date(start_date) : (date ? new Date(date) : bookingStart);
        const queryEnd = end_date ? new Date(end_date) : (date ? new Date(date) : bookingEnd);

        // Determine which dates this recurring booking occurs on
        const occurrenceDates = [];
        
        if (req.repeat_frequency === '每天') {
          // Daily: every day from start to end within query range
          let currentDate = new Date(Math.max(bookingStart, queryStart));
          const endDate = new Date(Math.min(bookingEnd, queryEnd));
          
          while (currentDate <= endDate) {
            occurrenceDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else if (req.repeat_frequency === '每周') {
          // Weekly: same day of week, every 7 days
          let currentDate = new Date(bookingStart);
          
          // Find first occurrence within or after query range
          while (currentDate < queryStart) {
            currentDate.setDate(currentDate.getDate() + 7);
          }
          
          // Add all occurrences within range
          while (currentDate <= bookingEnd && currentDate <= queryEnd) {
            if (currentDate >= queryStart) {
              occurrenceDates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 7);
          }
        } else {
          // No frequency specified or unknown: treat as single occurrence on start_date
          if (bookingStart >= queryStart && bookingStart <= queryEnd) {
            occurrenceDates.push(new Date(bookingStart));
          }
        }

        // Create a schedule entry for each occurrence
        occurrenceDates.forEach((occurrenceDate) => {
          formattedRequests.push({
            schedule_id: req.request_id,
            classroom_id: req.classroom_id,
            date: occurrenceDate.toISOString().split('T')[0],
            time_slot: `${start}-${end}`,
            event_name: req.event_name,
            status: frontendStatus,
          });
        });
      }
    });

    res.json(formattedRequests);
  } catch (err) {
    console.error('序列 error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
