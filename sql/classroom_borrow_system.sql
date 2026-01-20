DROP DATABASE IF EXISTS classroom_borrow_system;
CREATE DATABASE classroom_borrow_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE classroom_borrow_system;

-- users（使用者）
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','teacher','admin') NOT NULL,
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
  borrower_id INT NOT NULL,
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
  status ENUM('審核中','教師核准','核准','退件','已歸還','已取消') DEFAULT '審核中',
  reject_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- 以下為申請當下快照（避免使用者資料改變導致紀錄不同）
  teacher_department VARCHAR(50),
  teacher_phone VARCHAR(20),
  teacher_email VARCHAR(100),
  borrower_department VARCHAR(50),
  borrower_phone VARCHAR(20),
  borrower_email VARCHAR(100),
  FOREIGN KEY (borrower_id) REFERENCES users(user_id)
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
  user_id INT NOT NULL,
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
  booked_by INT,
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



-- 假資料：users（先建立使用者）
INSERT INTO users (name, email, password, role, department)
VALUES
  ('陳小明','s001@example.edu','pwd123','student','資訊系'),
  ('李老師','teacher01@example.edu','teachpass','teacher','音樂系'),
  ('王管理員','admin01@example.edu','adminpass','admin','教務處'),
  ('張學生','s002@example.edu','pwd456','student','外文系'),
  ('林老師','teacher02@example.edu','teach234','teacher','視覺設計系');

-- 假資料：classrooms（教室）
INSERT INTO classrooms (classroom_id, name, type, capacity, description, image_url)
VALUES
  ('C101','第一演奏廳','音樂教室',120,'有鋼琴與舞台','/images/C101.jpg'),
  ('C102','第二教室','一般教室',40,'投影、白板','/images/C102.jpg'),
  ('R201','多媒體室','電腦教室',30,'有多媒體電腦','/images/R201.jpg'),
  ('H01','視覺工作室','工作室',20,'繪畫、設備較多','/images/H01.jpg');

-- 假資料：borrow_requests（借用申請）
-- 注意 borrower_id 參照上面 users 的自增 id (通常 1,2,3,...)
INSERT INTO borrow_requests (
  borrower_id, classroom_id, borrow_type, start_date, end_date,
  start_time, end_time, event_name, people_count, teacher_name,
  reason, status, reject_reason,
  teacher_department, teacher_phone, teacher_email,
  borrower_department, borrower_phone, borrower_email
) VALUES
-- 單次借用，審核中
(1, 'C101', '單次借用', '2025-11-20', NULL, '13:00:00', '16:00:00',
 '弦樂四重奏期末演出', 50, '李老師', '期末演出排練與表演', '審核中', NULL,
 '音樂系','02-1234-5678','teacher01@example.edu',
 '資訊系','0912-000001','s001@example.edu'
),
-- 核准、已預約（同一天另一時段）
(4, 'C101', '單次借用', '2025-11-20', NULL, '09:00:00', '11:00:00',
 '英文戲劇社演出', 70, '林老師', '社團演出', '核准', NULL,
 '視覺設計系','02-2345-6789','teacher02@example.edu',
 '外文系','0912-222222','s002@example.edu'
),
-- 多次借用（週次範例）: 期中至期末的每週固定時段（end_date 設為結束日）
(1, 'R201', '多次借用', '2025-10-01', '2025-12-31', '18:00:00', '20:00:00',
 '程式設計作業輔導', 20, '李老師', '每週二晚間固定輔導', '核准', NULL,
 '音樂系','02-1234-5678','teacher01@example.edu',
 '資訊系','0912-000001','s001@example.edu'
),
-- 被退件的申請（含退件理由）
(1, 'H01', '單次借用', '2025-11-05', NULL, '10:00:00', '12:00:00',
 '大型繪畫工作坊', 25, '林老師', '活動需要較多空間', '退件', '場地與設備不可同時租借',
 '視覺設計系','02-2345-6789','teacher02@example.edu',
 '資訊系','0912-000001','s001@example.edu'
),
-- 已歸還（過去的借用）
(2, 'C102', '單次借用', '2025-09-15', NULL, '14:00:00', '16:00:00',
 '名師講座：音樂史導讀', 30, '李老師', '邀請外賓講座', '已歸還', NULL,
 '音樂系','02-1234-5678','teacher01@example.edu',
 '視覺設計系','0912-333333','teacher01@example.edu'
),
-- 申請後使用者取消
(4, 'C102', '單次借用', '2025-11-25', NULL, '10:00:00', '12:00:00',
 '學生讀書會', 15, '林老師', '讀書會', '已取消', NULL,
 '視覺設計系','02-2345-6789','teacher02@example.edu',
 '外文系','0912-222222','s002@example.edu'
);

-- 假資料：schedule（時段表）
-- 將部分 borrow_requests 連結到 schedule，檢驗 UNIQUE(classroom_id,date,time_slot) 約束
-- time_slot 以 "HH:MM-HH:MM" 格式存
INSERT INTO schedule (classroom_id, date, time_slot, booked_by, borrow_request_id, event_name, status)
VALUES
-- 對應上面第二筆核准在 C101 09:00-11:00（booked_by = 使用者 id 為 4，borrow_request_id = 2 假設）
('C101','2025-11-20','09:00-11:00',4,2,'英文戲劇社演出','已預約'),
-- 第一筆申請在 C101 13:00-16:00（避免時段衝突）
('C101','2025-11-20','13:00-16:00',1,1,'弦樂四重奏期末演出','已預約'),
-- R201 的多次借用（先加入一個週期的時段）
('R201','2025-11-04','18:00-20:00',1,3,'程式設計作業輔導','已預約'),
('R201','2025-11-11','18:00-20:00',1,3,'程式設計作業輔導','已預約'),
-- 已歸還的過去時段
('C102','2025-09-15','14:00-16:00',2,5,'名師講座：音樂史導讀','已預約');

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
SELECT request_id,borrower_id,classroom_id,borrow_type,start_date,start_time,end_time,status FROM borrow_requests;
SELECT * FROM schedule;
SELECT * FROM announcements;
SELECT * FROM blacklist;
