const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

const port = process.env.PORT || 8080;

// 1. 【SSO URL】
const SSO_API_URL = 'https://algotutor.utaipei.edu.tw:1777/api/v1/auth/login';

app.use(cors());
app.use(express.json());

// --- 測試頁面 (無需變動) ---
app.get('/test-login', (req, res) => {
  res.send(`
    <html>
      <head><title>SSO 登入測試</title></head>
      <body style="padding: 2rem; font-family: sans-serif;">
        <h2>SSO 串接測試 (修正版)</h2>
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

// --- 後端登入 API ---
app.post('/api/login', async (req, res) => {
  const { account, password } = req.body;
  console.log(`收到登入請求: ${account}`);

  try {
    // 2. 設定參數
    const params = new URLSearchParams();
    params.append('username', account);
    params.append('password', password);

    console.log("正在發送請求至 SSO...");

    // 3. 發送請求
    const ssoResponse = await axios.post(SSO_API_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const ssoData = ssoResponse.data;
    console.log("SSO 驗證成功 (Code 0)");

    if (ssoData.code === 0) {
        res.json({
            success: true,
            message: "SSO 登入成功",
            user_data: ssoData.data
        });
    } else {
        // 雖然 SSO 回傳 200 OK，但業務邏輯失敗 (機率較低，通常是下面 catch 抓到)
        res.status(401).json({
            success: false,
            message: ssoData.message || "帳號或密碼錯誤"
        });
    }

  } catch (error) {
    // --- 這裡就是修改的地方 ---
    console.error("SSO 回傳錯誤:", error.message);
    
    // 如果 error.response 存在，代表 SSO 伺服器有回傳東西 (例如 401 Unauthorized)
    if (error.response) {
        console.error("SSO 狀態碼:", error.response.status);
        console.error("SSO 錯誤內容:", error.response.data);

        // 如果是 401，代表帳密錯誤或使用者不存在
        if (error.response.status === 401) {
            return res.status(401).json({
                success: false,
                message: "帳號或密碼錯誤" // ★ 這裡改成你要顯示的字
            });
        }
    }

    // 其他錯誤 (例如網路斷線、SSO 伺服器掛掉)
    res.status(500).json({
      success: false,
      message: "系統連線錯誤 (無法連接 SSO)"
    });
  }
});

app.listen(port, () => {
  console.log(`\n=== 伺服器已啟動 ===`);
  console.log(`請按住 Ctrl 點擊此連結進行測試: http://localhost:${port}/test-login \n`);
});