require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));



// 全域設定JSON回傳編碼為 UTF-8
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.get('/health', (req, res) => {
  // #swagger.ignore = true
  res.json({status: 'ok'});
});

app.get('/', (req, res) => {
  // #swagger.ignore = true
  res.send('Classroom Borrow Backend placeholder');
});


// 掛載路由
app.use('/bookings/schedule', 
  // #swagger.tags = ['schedule']
        
  require('./routes/schedule'));  //有優先級問題,須放在booking前面,否則會被bookings/:id吞掉
app.use('/admin', 
  // #swagger.tags = ['admin']
  require('./routes/admins'));

app.use('/announcements', 
  // #swagger.tags = ['announcement']
  require('./routes/announcements'));

app.use('/bookings', 
  // #swagger.tags = ['bookings']
  require('./routes/borrowRequests'));

app.use('/classrooms', 
  // #swagger.tags = ['classrooms']
  require('./routes/classrooms'));
  
//app.use('/test', require('./testapi/tests'));

app.get('/ping', (req, res) => {
  // #swagger.ignore = true
  console.log("Ping route hit");
  res.send("pong");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
