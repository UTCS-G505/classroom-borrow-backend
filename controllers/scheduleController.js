const pool = require('../db');
const { validateFieldLengths } = require('../utils/fieldLimits');

exports.getSchedule = async (req, res) => {
  try {
    const { date, start_date, end_date, classroom_id } = req.query;
    let requestSql;
    let requestValues;

    // Filter for valid bookings (Approved or Pending)
    const statusCondition = `status IN ('核准', '教師核准', '審核中', '已預約')`;

    if (start_date && end_date) {
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
      requestValues = [
        classroom_id,
        start_date,
        end_date,
        end_date,
        start_date,
      ];
    } else {
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

    // Helper to calculate occurrences
    const queryStart = start_date ? new Date(start_date) : new Date(date);
    const queryEnd = end_date ? new Date(end_date) : new Date(date);

    requestRows.forEach((req) => {
      const start = req.start_time.substring(0, 5);
      const end = req.end_time.substring(0, 5);

      let frontendStatus = req.status;
      if (req.status === '核准' || req.status === '已預約')
        frontendStatus = '已預約'; // Green
      else if (req.status === '教師核准')
        frontendStatus = '教師核准'; // Purple
      else if (req.status === '審核中') frontendStatus = '審核中'; // Blue

      if (req.borrow_type === '單次借用') {
        formattedRequests.push({
          schedule_id: req.request_id,
          classroom_id: req.classroom_id,
          date: req.start_date,
          time_slot: `${start}-${end}`,
          event_name: req.event_name,
          status: frontendStatus,
        });
      } else if (req.borrow_type === '多次借用') {
        const bookingStart = new Date(req.start_date);
        const bookingEnd = req.end_date
          ? new Date(req.end_date)
          : new Date(req.start_date);

        // Query range
        const queryStart = start_date
          ? new Date(start_date)
          : date
            ? new Date(date)
            : bookingStart;
        const queryEnd = end_date
          ? new Date(end_date)
          : date
            ? new Date(date)
            : bookingEnd;

        // Determine which dates this recurring booking occurs on
        const occurrenceDates = [];

        if (req.repeat_frequency === '每天') {
          let currentDate = new Date(Math.max(bookingStart, queryStart));
          const endDate = new Date(Math.min(bookingEnd, queryEnd));

          while (currentDate <= endDate) {
            occurrenceDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else if (req.repeat_frequency === '每周') {
          let currentDate = new Date(bookingStart);

          // Find first occurrence within or after query range
          while (currentDate < queryStart) {
            currentDate.setDate(currentDate.getDate() + 7);
          }

          // Add all occurrences within range
          while (currentDate <= bookingEnd && currentDate <= queryEnd) {
            if (currentDate >= queryStart)
              occurrenceDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 7);
          }
        } else {
          if (bookingStart >= queryStart && bookingStart <= queryEnd) {
            occurrenceDates.push(new Date(bookingStart));
          }
        }

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

    // NOW fetch from class_schedules
    let classScheduleSql = `SELECT * FROM class_schedules WHERE classroom_id = ? AND semester_start_date <= ? AND semester_end_date >= ?`;
    let csValues = [classroom_id, end_date || date, start_date || date];

    // We will expand these over the queried date range matching the weekday
    const [csRows] = await pool.query(classScheduleSql, csValues);

    csRows.forEach((cs) => {
      const start = cs.start_time.substring(0, 5);
      const end = cs.end_time.substring(0, 5);

      let currentDate = new Date(
        Math.max(queryStart, new Date(cs.semester_start_date))
      );
      const endDate = new Date(
        Math.min(queryEnd, new Date(cs.semester_end_date))
      );

      while (currentDate <= endDate) {
        if (currentDate.getDay() === cs.weekday) {
          formattedRequests.push({
            schedule_id: 'cs_' + cs.schedule_id,
            classroom_id: cs.classroom_id,
            date: currentDate.toISOString().split('T')[0],
            time_slot: `${start}-${end}`,
            event_name: `${cs.course_name} (${cs.teacher_name})`,
            status: '課程使用',
            is_class: true,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    res.json(formattedRequests);
  } catch (err) {
    console.error('序列 error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.getAllSchedules = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM class_schedules ORDER BY classroom_id, weekday, start_time'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.clearSchedules = async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE class_schedules');
    res.json({ message: 'Schedules cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.deleteSemesterSchedules = async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date)
    return res.status(400).json({ error: 'Missing dates' });
  try {
    await pool.query(
      'DELETE FROM class_schedules WHERE semester_start_date = ? AND semester_end_date = ?',
      [start_date, end_date]
    );
    res.json({ message: 'Semester schedules deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.importSchedule = async (req, res) => {
  const { schedules, start_date, end_date } = req.body;
  if (!schedules || !Array.isArray(schedules) || !start_date || !end_date) {
    return res
      .status(400)
      .json({ error: 'Missing schedules array, start_date, or end_date' });
  }

  // Validate VARCHAR field lengths to avoid DB "Data too long" errors
  for (const s of schedules) {
    const lengthError = validateFieldLengths('class_schedules', s);
    if (lengthError) {
      return res.status(400).json({ error: lengthError });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Delete ONLY the schedules for the uploaded semester to avoid duplicates or clearing other semesters
    await connection.query(
      'DELETE FROM class_schedules WHERE semester_start_date = ? AND semester_end_date = ?',
      [start_date, end_date]
    );

    for (const s of schedules) {
      await connection.query(
        'INSERT INTO class_schedules (classroom_id, course_name, teacher_name, weekday, start_time, end_time, semester_start_date, semester_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          s.classroom_id,
          s.course_name,
          s.teacher_name,
          s.weekday,
          s.start_time,
          s.end_time,
          start_date,
          end_date,
        ]
      );
    }

    await connection.commit();
    res.json({ message: 'Import successful' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    connection.release();
  }
};
