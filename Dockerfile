# 使用官方 MySQL 8.0 映像
FROM mysql:8.0

# 設定 MySQL 環境變數
ENV MYSQL_ROOT_PASSWORD=root
ENV MYSQL_DATABASE=classroom_borrow_system
ENV MYSQL_USER=user
ENV MYSQL_PASSWORD=1234

# 複製你的 SQL 檔案到容器內的初始化資料夾
COPY ./classroom_borrow_system.sql /docker-entrypoint-initdb.d/

# MySQL 預設埠號
EXPOSE 3306
