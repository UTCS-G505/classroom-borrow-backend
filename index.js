require('dotenv').config();
const axios = require('axios'); // 引入 axios 用於 SSO 請求
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const db = require('./db'); // 保持資料庫連線，之後抓個資或紀錄會用到
const express = require('express');

const app = express();
// 配合您提供的程式碼，預設使用 8080，如果 .env 有設定則優先使用 .env
const port = process.env.PORT || 3000;

// 啟用 CORS
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 全域設定JSON回傳編碼為 UTF-8
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  // #swagger.ignore = true
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  // #swagger.ignore = true
  res.send('Classroom Borrow Backend placeholder');
});

// 掛載路由
app.use(
  '/bookings/schedule',
  // #swagger.tags = ['schedule']

  require('./routes/schedule')
); //有優先級問題,須放在booking前面,否則會被bookings/:id吞掉
app.use(
  '/admin',
  // #swagger.tags = ['admin']
  require('./routes/admins')
);

app.use(
  '/announcements',
  // #swagger.tags = ['announcement']
  require('./routes/announcements')
);

app.use(
  '/bookings',
  // #swagger.tags = ['bookings']
  require('./routes/borrowRequests')
);

app.use(
  '/classrooms',
  // #swagger.tags = ['classrooms']
  require('./routes/classrooms')
);

// Auth routes (登入、Token 相關)
app.use(
  '/api',
  // #swagger.tags = ['auth']
  require('./routes/auth.routes')
);

// Users routes
app.use(
  '/users',
  // #swagger.tags = ['users']
  require('./routes/users')
);

app.get('/ping', (req, res) => {
  // #swagger.ignore = true
  console.log('Ping route hit');
  res.send('pong');
});

app.listen(port, () => {
  console.log(`\n=== 伺服器已啟動 ===`);
  console.log(`後端運行於: http://localhost:${port}`);
});
