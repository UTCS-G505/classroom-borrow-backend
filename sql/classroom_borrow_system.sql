DROP DATABASE IF EXISTS classroom_borrow_system;
CREATE DATABASE classroom_borrow_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE classroom_borrow_system;

-- users（使用者）
CREATE TABLE users (
  user_id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  role INT NOT NULL DEFAULT 6,
  department VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- classrooms（教室）
CREATE TABLE classrooms (
  classroom_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(30),
  capacity INT,
  description TEXT,
  image_url VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- borrow_requests（借用申請）
CREATE TABLE borrow_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  classroom_id VARCHAR(10) NOT NULL,
  borrow_type ENUM('單次借用','多次借用') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  people_count INT,
  teacher_name VARCHAR(50),
  reason TEXT,
  status ENUM('審核中','核准','退件','已歸還','已取消') DEFAULT '審核中',
  reject_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- 以下為申請當下快照（避免使用者資料改變導致紀錄不同）
  teacher_department VARCHAR(50),
  teacher_phone VARCHAR(20),
  teacher_email VARCHAR(100),
  borrower_department VARCHAR(50),
  borrower_phone VARCHAR(20),
  borrower_email VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(classroom_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- announcements（公告）
CREATE TABLE announcements (
  announcement_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expired_at DATETIME NULL
);

-- blacklist（違規名單）
CREATE TABLE blacklist (
  blacklist_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expired_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- schedule（教室時段資料）
CREATE TABLE schedule (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  classroom_id VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  booked_by VARCHAR(36),
  borrow_request_id INT,
  event_name VARCHAR(100),
  status ENUM('已預約','已取消') DEFAULT '已預約',
  FOREIGN KEY (classroom_id) REFERENCES classrooms(classroom_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (booked_by) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (borrow_request_id) REFERENCES borrow_requests(request_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (classroom_id, date, time_slot)
);

-- 索引（加速查詢）
CREATE INDEX idx_borrow_status ON borrow_requests(status);
CREATE INDEX idx_schedule_date_classroom ON schedule(classroom_id, date);

-- 檢查建立結果
SHOW TABLES;

-- classrooms（教室）
INSERT INTO classrooms (classroom_id, name, type, capacity, description, image_url)
VALUES
  ('G312','G312 會議室','會議室',20,NULL,NULL),
  ('G313','G313 普通教室','普通教室',40,NULL,NULL),
  ('G314','G314 普通教室','普通教室',40,NULL,NULL),
  ('G315','G315 電腦教室','電腦教室',30,NULL,NULL),
  ('G316','G316 電腦教室','電腦教室',30,NULL,NULL),
  ('G501','G501 會議室','會議室',20,NULL,NULL),
  ('G508','G508 系圖書室','系圖書室',15,NULL,NULL),
  ('G509','G509 IOS教室','電腦教室',30,NULL,NULL),
  ('G516','G516 電腦教室','電腦教室',30,NULL,NULL);

-- 假資料：borrow_requests（借用申請）
-- 注意 borrower_id 參照上面 users 的自增 id (通常 1,2,3,...)
-- INSERT INTO borrow_requests (
--   borrower_id, classroom_id, borrow_type, start_date, end_date,
--   start_time, end_time, event_name, people_count, teacher_name,
--   reason, status, reject_reason,
--   teacher_department, teacher_phone, teacher_email,
--   borrower_department, borrower_phone, borrower_email
-- ) VALUES
-- -- 單次借用，審核中
-- (1, 'G509', '單次借用', '2025-11-20', NULL, '13:00:00', '16:00:00',
--  '程式設計期末報告', 30, '李老師', '期末演示', '審核中', NULL,
--  '資科系','02-1234-5678','teacher01@example.edu',
--  '資科系','0912-000001','s001@example.edu'
-- );

-- 假資料：schedule（時段表）
-- INSERT INTO schedule (classroom_id, date, time_slot, booked_by, borrow_request_id, event_name, status)
-- VALUES
-- ('G509','2025-11-20','13:00-16:00',1,1,'程式設計期末報告','已預約');

-- 假資料：announcements（公告）
INSERT INTO announcements (title, content, expired_at)
VALUES
  ('期末場地申請截止','請於 2025-11-30 前完成期末演出場地申請。', '2025-12-01 00:00:00'),
  ('防疫注意事項','進入教室請配戴口罩並完成手部消毒。', NULL),
  ('器材維修','C101 舞台燈光將於 2025-11-10 進行維修，當日部分功能會停用。', '2025-11-11 00:00:00');

-- 假資料：blacklist（違規名單）
INSERT INTO blacklist (user_id, reason, expired_at)
VALUES
  (1, '使用後未歸還教室鑰匙，且未按規定清理場地', '2026-05-01 00:00:00');

-- 檢查資料（簡單 SELECT 範例）
SELECT user_id,name,email,role FROM users;
SELECT classroom_id,name,type,capacity FROM classrooms;
SELECT request_id,user_id,classroom_id,borrow_type,start_date,start_time,end_time,status FROM borrow_requests;
SELECT * FROM schedule;
SELECT * FROM announcements;
SELECT * FROM blacklist;
