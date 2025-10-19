const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const port = process.env.PORT || 3100; // 👈 這裡修改！

app.use(cors());
app.use(express.json());

// ✅ 資料庫連線池設定（防止冷啟動連線逾時）
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000, // 20 秒連線逾時
  acquireTimeout: 20000, // 20 秒取得連線逾時
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// ✅ 測試資料庫連線
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ 資料庫連線失敗：', err);
    // 不中斷服務，繼續運行以便健康檢查端點可用
  } else {
    console.log('✅ 成功連接資料庫');
    connection.release();
  }
});

// ✅ 健康檢查端點（供 Zeabur 檢查服務狀態）
app.get('/health', (req, res) => {
  db.ping((err) => {
    if (err) {
      console.error('健康檢查失敗：', err);
      return res.status(503).json({ status: 'unhealthy', error: err.message });
    }
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
});

// ✅ 根路徑端點（防止 404）
app.get('/', (req, res) => {
  res.json({ message: 'Mamoon API Server 正在運行', version: '1.0.0' });
});

// ✅ 註冊 API
app.post('/register', (req, res) => {
  const { name, email, password, child_nickname } = req.body;
  const sql = "INSERT INTO users (name, email, password, child_nickname) VALUES (?, ?, ?, ?)";

  db.query(sql, [name, email, password, child_nickname], (err, result) => {
    if (err) return res.status(500).json({ message: "註冊失敗" });

    const userId = result.insertId;
    const selectSql = "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at FROM users WHERE id = ?";

    db.query(selectSql, [userId], (err2, rows) => {
      if (err2) return res.status(500).json({ message: "註冊成功但無法取得註冊時間" });
      
      const createdAt = rows[0]?.created_at || new Date().toISOString().split('T')[0];
      res.status(200).json({
        message: "註冊成功",
        created_at: createdAt
      });
    });
  });
});

// ✅ 登入 API
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: '伺服器錯誤' });
    if (results.length > 0) {
      res.json({ success: true, user: results[0] });
    } else {
      res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
    }
  });
});

// ✅ 檢查 email 是否存在
app.post('/check-email', (req, res) => {
  const { email } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: '伺服器錯誤' });
    res.json({ exists: results.length > 0 });
  });
});

// ✅ 重設密碼
app.post('/reset-password', (req, res) => {
  const { email, password } = req.body;
  db.query('UPDATE users SET password = ? WHERE email = ?', [password, email], (err, result) => {
    if (err) return res.status(500).json({ error: '更新失敗' });
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Email 不存在' });
    }
  });
});

// ✅ 個人資料
app.get('/profile', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Missing email parameter' });

  const sql = `
  SELECT name, email, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at, child_nickname 
  FROM users WHERE email = ?
`;


  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// ✅ 故事
app.get('/stories', (req, res) => {
  const sql = `
  SELECT id, title, category, content, audio_url, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at 
  FROM stories ORDER BY created_at DESC
`;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "資料庫錯誤" });
    res.json(results);
  });
});

// ✅ 音樂分類
app.get('/api/music/categories', (req, res) => {
  db.query('SELECT DISTINCT category FROM music', (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results.map(row => row.category));
  });
});

// ✅ 撈音樂清單
app.get('/api/music/:category', (req, res) => {
  const category = decodeURIComponent(req.params.category);
  db.query('SELECT id, title, audio_url FROM music WHERE category = ?', [category], (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results);
  });
});

// ✅ 語音分析 API
app.post('/ai/interpret', (req, res) => {
  const { text } = req.body;
  const normalizedText = text.toLowerCase();

  let mediaType = null;
  let mediaId = null;
  let reply = '';
  let audioUrl = '';

  if (normalizedText.includes('故事')) {
    mediaType = 'story';
    mediaId = 1;
    reply = '這是兔兔的故事～';
    audioUrl = 'https://mamoon1140223.github.io/mamoon-music/%E5%B0%8F%E5%B0%8F%E7%9A%84%E5%A4%A2%E6%83%B3.mp3';
  } else if (normalizedText.includes('音樂')) {
    mediaType = 'music';
    mediaId = 2;
    reply = '這是一首音樂，播放中～';
    audioUrl = 'https://mamoon1140223.github.io/mamoon-music/%E5%B0%8F%E5%B0%8F%E7%9A%84%E5%A4%A2%E6%83%B3.mp3';
  } else {
    reply = '我聽不太懂，請再說一次好嗎？';
  }

  res.json({ reply, media_type: mediaType, media_id: mediaId, audio_url: audioUrl });
});

// ✅ 更新使用者暱稱
app.post('/update_profile', (req, res) => {
  const { name, email, child_nickname } = req.body;
  if (!name || !email || !child_nickname) return res.status(400).json('缺少欄位');

  db.query('UPDATE users SET name = ?, child_nickname = ? WHERE email = ?', [name, child_nickname, email], (err, result) => {
    if (err) return res.status(500).json('資料庫錯誤');
    if (result.affectedRows === 0) return res.status(404).json('找不到該帳號');
    res.status(200).json('更新成功');
  });
});

// ✅ Gemini API 對話整合
const GEMINI_API_KEY = 'AIzaSyAB5oDihcH3H4UTLxf89UaJIBtB0v5KUHM'; // 👈 替換成你自己的金鑰
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: "缺少 message 欄位或內容為空" });
  }

  const normalizedText = userMessage.toLowerCase();
  let musicInfo = null;

  // ✅ 修正：使用 Promise 處理音樂查詢，避免競態條件
  if (normalizedText.includes('音樂') || normalizedText.includes('唱歌') || normalizedText.includes('聽歌')) {
    let category = null;
    if (normalizedText.includes('安眠曲')) {
        category = '安眠曲';
    } else if (normalizedText.includes('歡樂曲')) {
        category = '歡樂曲';
    }

    let sql, params;
    if (category) {
        sql = "SELECT * FROM music WHERE category = ? ORDER BY RAND() LIMIT 1";
        params = [category];
    } else {
        sql = "SELECT * FROM music ORDER BY RAND() LIMIT 1";
        params = [];
    }

    try {
      // ✅ 使用 Promise 同步等待資料庫查詢結果
      const results = await new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      console.log('查詢結果：', results);
      if (results && results.length > 0) {
        musicInfo = {
          media_type: 'music',
          audio_url: results[0].audio_url,
          title: results[0].title
        };
        console.log('✅ 找到音樂：', results[0].title);
      } else {
        console.log('⚠️ 沒有找到音樂，繼續對話');
      }
    } catch (err) {
      console.error('資料庫查詢錯誤：', err);
      // 不中斷服務，繼續進行對話
    }
  }

  // 你的完整 prompt
  const prompt = `
  ⚠️ 請永遠只使用「繁體中文」回答，不能出現英文或簡體字。
  即使使用者說英文、簡體字，也要全部轉換為繁體中文回應。
  
  ⭐ 你是一位叫「小豚」的 AI 夥伴，是溫柔的大姊姊 / 大哥哥，專門陪 2～6 歲的小朋友聊天和玩耍。
  
  請使用「簡單、親切、可愛的繁體中文」，模仿 2～6 歲小孩聽得懂的語氣。  
  說話像陪小朋友玩耍、安慰他、引導他開心互動。
  
  ---
  
  ❗ 必須遵守以下語言風格：
  
  1. 不可以使用以下語氣或詞語：  
  - 抽象詞：探索、經歷、狀況、內容、感觸  
  - 英文詞：fun、cool、nice、ok、yeah  
  - 青少年詞：帥、讚、絕、爆、酷

  2. 不可以使用反問句（例如：「你還有沒有...呢？」）  
  改用開放問句：「你下次還想玩嗎？」

  3. 要使用小朋友常說的詞，例如：  
  「玩玩具」「吃點心」「痛痛飛走」「好棒棒」「小豚陪你」「哇～你還好嗎？」「抱抱」

  4. 說話不能太理性或大人口吻，不能說「我是一個 AI」，也不能講道理。

  5. 回應長度請適中，只回應 1~2 段對話，不要重複語意。

  6. 不要使用任何表情符號，因為語音系統會唸出這些符號。

  7. 不要給小朋友選擇的機會，因為使用者才 2～6 歲，除非小朋友自己指定要玩什麼。
  例如：
  ❌ 不要說：「你想玩積木還是畫畫呢？」
  ✅ 要說：「我們來玩積木吧！」
  ❌ 不要說：「你要聽故事還是唱歌呢？」
  ✅ 要說：「小豚來講故事給你聽！」
  
  請依照以上規則，回應以下這句話：  
  【小朋友說的話】：
  
  ${userMessage}
  `;

  try {
    // ✅ 設定 Gemini API 請求逾時
    const response = await axios.post(GEMINI_URL, {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.6,
        topK: 30,
        topP: 0.9,
        maxOutputTokens: 512
      }
    }, {
      timeout: 30000 // 30 秒逾時
    });

    const aiReply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '月月好像還沒聽清楚耶～可以再說一次嗎？';

    if (musicInfo) {
      console.log("API 最終回傳：", {
        reply: aiReply,
        media_type: musicInfo.media_type,
        audio_url: musicInfo.audio_url,
        title: musicInfo.title
      });
      return res.json({
        reply: aiReply,
        media_type: musicInfo.media_type,
        audio_url: musicInfo.audio_url,
        title: musicInfo.title
      });
    } else {
      console.log("API 最終回傳：", { reply: aiReply });
      return res.json({ reply: aiReply });
    }
  } catch (error) {
    console.error('❌ Gemini API 錯誤：', error.message);
    if (error.response) {
      console.error('📄 回傳錯誤內容：', error.response.data);
    }
    
    // ✅ 如果有音樂資訊，即使 AI 失敗也回傳預設訊息
    if (musicInfo) {
      return res.json({
        reply: '月月來放音樂給你聽！',
        media_type: musicInfo.media_type,
        audio_url: musicInfo.audio_url,
        title: musicInfo.title
      });
    }
    
    return res.status(500).json({ 
      error: 'Gemini API 回覆錯誤',
      reply: '月月現在有點累，可以等一下再說嗎？'
    });
  }
});


const server = app.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`🏥 健康檢查端點: http://localhost:${port}/health`);
});

// ✅ 優雅關閉處理（適用於 Zeabur 部署）
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️ 收到 ${signal} 信號，開始優雅關閉...`);
  
  server.close(() => {
    console.log('✅ HTTP 服務已關閉');
    
    db.end((err) => {
      if (err) {
        console.error('❌ 資料庫連線關閉錯誤：', err);
        process.exit(1);
      }
      console.log('✅ 資料庫連線已關閉');
      process.exit(0);
    });
  });

  // 如果 30 秒內未完成關閉，強制退出
  setTimeout(() => {
    console.error('⚠️ 無法在時限內優雅關閉，強制退出');
    process.exit(1);
  }, 30000);
};

// 監聽終止信號
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 處理未捕獲的錯誤
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕獲的異常：', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕：', reason);
  gracefulShutdown('unhandledRejection');
});
