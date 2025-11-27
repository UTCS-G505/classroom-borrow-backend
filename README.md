# Classroom Borrow System — Backend
本專案使用 **Node.js + Express + MySQL**，並以 **Docker Compose** 管理後端及資料庫服務。

## 專案啟動方式

### 1 建立 `.env`（第一次啟動必做，第二次後面就不用做）

請依照專案內提供的 `.env.example`，新增 `.env`
```bash 
cp .env.example .env
```

`.env` 內包含root密碼、資料庫名稱與一般使用者帳密，請自行更改root密碼。

> `.env` 不會被上傳到 GitHub，需自行建立。


---

### 2 使用 Docker Compose 啟動整套服務

```bash
docker compose up -d --build
```

成功後會啟動：

| Service | Container Name    | Port Mapping |
| ------- | ----------------- | ------------ |
| backend | classroom-backend | 3000 → 3000  |
| mysql   | classroom-db      | 3307 → 3306  |

---

### 3 查看後端 Log & MySQL

#### 後端log
```bash
docker compose logs -f backend
```
後端 API 預設運行在：

```
http://localhost:3000
```


#### MySQL
---

##### 1 進入 MySQL 容器

```bash
docker exec -it classroom-db mysql -u root -p
```

密碼為 `.env` 中的：

```
MYSQL_ROOT_PASSWORD
```
---

##### 2 常用 SQL 指令

##### 使用 classroom 資料庫

```sql
USE classroom_borrow_system;
```

##### 查看所有資料表

```sql
SHOW TABLES;
```

##### 查詢常用資料表

```sql
SELECT * FROM users;
SELECT * FROM borrow_requests;
SELECT * FROM schedule;
SELECT * FROM announcements;
SELECT * FROM blacklist;
```

---

### 停止與清除容器

停止服務：

```bash
docker compose down
```

若要連同資料庫資料一起刪除（⚠會清空資料）：

```bash
docker compose down -v
```

---

### 密碼更新注意事項

若你更改 `.env` 的 MySQL 密碼，MySQL 不會自動更新。需：

```bash
docker compose down -v
```

再重新：

```bash
docker compose up -d
```
