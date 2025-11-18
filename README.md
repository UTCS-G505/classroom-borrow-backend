# classroom-borrow-backend

📘 Classroom Borrow System - Docker MySQL 專案
============================================

🔧 建構與啟動指令
--------------------------
1. 建構映像檔:
```bash
docker build -t classroom-borrow-image .
```
2. 啟動容器：
```bash
docker run -d --name classroom-borrow-container -p 3306:3306 classroom-borrow-image
```
3. 打開 SQL 命令列：

    **使用管理者帳號**
    ```bash
    docker exec -it classroom-borrow-container mysql -u root -p
    ```
    執行後，系統會提示您輸入密碼 (Enter password:) `root`

    **使用一般使用者帳號**
    ```bash
    docker exec -it classroom-borrow-container mysql -u user -p
    ```
    執行後，系統會提示您輸入密碼 (Enter password:) `1234`

--------------------------

🗝️ MySQL 登入資訊
--------------------------
Host：127.0.0.1

Port：3306

Database：classroom_borrow_system

管理者帳號：

  Username：`root`

  Password：`root`

一般使用者帳號：

  Username：`user`

  Password：`1234`


查看資料指令:
-- 選擇資料庫
USE classroom_borrow_system;

-- 查看所有使用者
SELECT * FROM users;

-- 查看所有教室
SELECT * FROM classrooms;

-- 查看所有借用申請
SELECT * FROM borrow_requests;

-- 查看所有時段表
SELECT * FROM schedule;

-- 查看所有公告
SELECT * FROM announcements;

-- 查看違規名單
SELECT * FROM blacklist;
