require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;

// 引入剛剛拆分出去的路由
const borrowRoutes = require('./routes/borrowRoutes');

app.use(express.json());

app.get('/', (req, res) => res.send('Backend Running'));

// 掛載 API 路由
// 這樣所有 borrowRoutes 裡的路徑都會自動加上 /api 前綴
app.use('/api', borrowRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});