const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// 全域設定JSON回傳編碼為 UTF-8
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.get('/health', (req, res) => {
  res.json({status: 'ok'});
});

app.get('/', (req, res) => {
  res.send('Classroom Borrow Backend placeholder');
});


// 掛載路由
app.use('/bookings/schedule', require('./routes/schedule'));  //有優先級問題,須放在booking前面,否則會被bookings/:id吞掉
app.use('/admin', require('./routes/admins'));
app.use('/announcements', require('./routes/announcements'));
app.use('/bookings', require('./routes/borrowRequests'));
app.use('/classrooms', require('./routes/classrooms'));
//app.use('/test', require('./testapi/tests'));

app.get('/ping', (req, res) => {
  console.log("Ping route hit");
  res.send("pong");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
