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
-- TABLE REMOVED: Validation moved to frontend/static.

-- borrow_requests（借用申請）
CREATE TABLE borrow_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(36) UNIQUE DEFAULT NULL,
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
  FOREIGN KEY (user_id) REFERENCES users(user_id)
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

-- 索引（加速查詢）
CREATE INDEX idx_borrow_status ON borrow_requests(status);

-- 檢查建立結果
SHOW TABLES;

SELECT request_id,user_id,classroom_id,borrow_type,start_date,start_time,end_time,status FROM borrow_requests;
SELECT * FROM announcements;
SELECT * FROM blacklist;
