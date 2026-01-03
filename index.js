require('dotenv').config();
const express = require('express');
const axios = require('axios'); // 引入 axios 用於 SSO 請求
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db'); // 保持資料庫連線，之後抓個資或紀錄會用到

const app = express();
// 配合您提供的程式碼，預設使用 8080，如果 .env 有設定則優先使用 .env
const port = process.env.PORT || 3000;

// === 設定 ===
// 1. 【SSO URL】
const SSO_API_URL = 'https://algotutor.utaipei.edu.tw:1777/api/v1/auth/login';

// === Middleware ===
app.use(cors());
app.use(express.json());

// === 輔助函式：產生 Token (JWT) ===
function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(user) {
  return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

// === Middleware：驗證 Token ===
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '未提供 Token' });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Token 無效或過期' });
    req.user = user;
    next();
  });
}

// === API Routes ===

// 1. 測試頁面 (您提供的測試工具，保留方便除錯)
app.get('/test-login', (req, res) => {
  res.send(`
    <html>
      <head><title>SSO 登入測試</title></head>
      <body style="padding: 2rem; font-family: sans-serif;">
        <h2>SSO 串接測試 (整合 JWT 版)</h2>
        <p>請輸入學號與密碼進行測試。</p>
        <div style="border: 1px solid #ccc; padding: 20px; max-width: 300px;">
            <input type="text" id="account" placeholder="學號 (如 U11316099)" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            <input type="password" id="password" placeholder="密碼" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            <button onclick="testLogin()" style="width: 100%; padding: 5px; cursor: pointer; background: #007bff; color: white; border: none;">登入測試</button>
        </div>
        <pre id="result" style="background: #eee; padding: 10px; margin-top: 10px; min-height: 50px;">等待測試...</pre>

        <script>
          async function testLogin() {
            const acc = document.getElementById('account').value;
            const pwd = document.getElementById('password').value;
            const resultBox = document.getElementById('result');
            resultBox.textContent = "連線中...";
            resultBox.style.color = "black";
            
            try {
              const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: acc, password: pwd })
              });
              const data = await res.json();
              resultBox.textContent = JSON.stringify(data, null, 2);
              resultBox.style.color = data.success ? "green" : "red";
            } catch (err) {
              resultBox.textContent = "錯誤：" + err.message;
              resultBox.style.color = "red";
            }
          }
        </script>
      </body>
    </html>
  `);
});

// 2. 登入 API (整合 SSO + JWT)
app.post('/api/login', async (req, res) => {
  const { account, password } = req.body;
  console.log(`收到登入請求: ${account}`);

  try {
    // A. 準備發送給 SSO 的資料 (application/x-www-form-urlencoded)
    const params = new URLSearchParams();
    params.append('username', account);
    params.append('password', password);

    console.log("正在發送請求至 SSO...");

    // B. 發送請求給學校 SSO
    const ssoResponse = await axios.post(SSO_API_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const ssoData = ssoResponse.data;

    // C. 判斷 SSO 結果
    if (ssoData.code === 0) {
        console.log("SSO 驗證成功");

        // --- 這裡開始是 JWT 整合邏輯 ---
        
        // 1. 準備 Payload (要放入 Token 的資料)
        // 假設 SSO 回傳的 data 裡有我們需要的資訊，如果沒有，我們先用 account 當名字
        const userPayload = { 
            name: account,     // 暫時用學號當名字
            account: account, 
            role: 'student'    // 預設給學生身分 (SSO 通常是學生)
        };

        // 2. 產生我們系統自己的 Token
        // 前端 LoginView.vue 需要這個 access_token 才能存入 localStorage
        const accessToken = generateAccessToken(userPayload);
        const refreshToken = generateRefreshToken(userPayload);

        // 3. 回傳成功訊息 (包含 user_data 與 Token)
        res.json({
            success: true,
            message: "SSO 登入成功",
            user_data: {
                // 這裡的結構要配合前端 LoginView.vue 的預期
                account: account,
                username: account, // NavBar 顯示用
                role: 'student',
                access_token: accessToken,  // ★ 重要：前端需要這個
                refresh_token: refreshToken,
                sso_info: ssoData.data      // 保留原始 SSO 回傳資料備查
            }
        });

    } else {
        // SSO 回傳 200 但 code 不為 0 (業務邏輯錯誤)
        res.status(401).json({
            success: false,
            message: ssoData.message || "帳號或密碼錯誤"
        });
    }

  } catch (error) {
    console.error("SSO 回傳錯誤:", error.message);
    
    // 處理 SSO 回傳的錯誤狀態 (例如 401)
    if (error.response) {
        console.error("SSO 狀態碼:", error.response.status);
        
        if (error.response.status === 401) {
            return res.status(401).json({
                success: false,
                message: "帳號或密碼錯誤" 
            });
        }
    }

    res.status(500).json({
      success: false,
      message: "系統連線錯誤 (無法連接 SSO)"
    });
  }
});

// 3. Refresh Token API (前端換發新 Token 用)
app.post('/api/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, message: '無 Refresh Token' });

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Refresh Token 無效' });
    const userPayload = { name: user.name, account: user.account, role: user.role };
    const accessToken = generateAccessToken(userPayload);
    res.json({ success: true, accessToken });
  });
});

// 4. 取得使用者資料 (測試 JWT 驗證用)
app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`\n=== 伺服器已啟動 ===`);
  console.log(`後端運行於: http://localhost:${port}`);
  console.log(`登入測試頁面: http://localhost:${port}/test-login \n`);
});