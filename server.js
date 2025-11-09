const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const port = 3100;

app.use(cors());
app.use(express.json());

// ✅ 資料庫連線設定
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'tpe1.clusters.zeabur.com',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'BoSMU1s0X539TFI270RECZG6A4Qc8PDk',
  database: process.env.DB_NAME || 'zeabur',
  port: process.env.DB_PORT || 30671
});

db.connect(err => {
  if (err) {
    console.error('❌ 資料庫連線失敗：', err);
  } else {
    console.log('✅ 成功連接資料庫');
    const createLogTableSql = `
      CREATE TABLE IF NOT EXISTS chat_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_message TEXT,
        ai_reply TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    db.query(createLogTableSql, createErr => {
      if (createErr) {
        console.error('❌ 建立 chat_logs 資料表失敗：', createErr);
      } else {
        console.log('✅ chat_logs 資料表已就緒');
      }
    });
  }
});

// ✅ 註冊 API
app.post('/register', (req, res) => {
  const { name, email, password, child_nickname } = req.body;
  
  // 獲取當前日期（只要日期部分，不要時間）
  const currentDate = new Date().toISOString().split('T')[0];
  
  const sql = "INSERT INTO users (name, email, password, child_nickname, created_at) VALUES (?, ?, ?, ?, ?)";

  db.query(sql, [name, email, password, child_nickname, currentDate], (err, result) => {
    if (err) {
      console.error('❌ 註冊資料庫錯誤：', err);
      return res.status(500).json({ message: "註冊失敗" });
    }

    const userId = result.insertId;
    const selectSql = "SELECT created_at FROM users WHERE id = ?";

    db.query(selectSql, [userId], (err2, rows) => {
      if (err2) {
        console.error('❌ 查詢註冊時間錯誤：', err2);
        return res.status(500).json({ message: "註冊成功但無法取得註冊時間" });
      }
      
      // 強制格式化日期，只保留 YYYY-MM-DD 部分
      let createdAt = new Date().toISOString().split('T')[0]; // 預設為今天
      if (rows[0]?.created_at) {
        console.log('🔍 註冊 - 原始 created_at 值：', rows[0].created_at, '類型：', typeof rows[0].created_at);
        
        // 方法1：如果是 Date 物件，直接格式化
        if (rows[0].created_at instanceof Date) {
          const year = rows[0].created_at.getFullYear();
          const month = String(rows[0].created_at.getMonth() + 1).padStart(2, '0');
          const day = String(rows[0].created_at.getDate()).padStart(2, '0');
          createdAt = `${year}-${month}-${day}`;
        } else {
          // 方法2：如果是字串，強制提取日期部分
          const dateStr = rows[0].created_at.toString();
          console.log('🔍 註冊 - 轉換為字串：', dateStr);
          
          // 使用正則表達式強制提取 YYYY-MM-DD 格式
          const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            createdAt = dateMatch[1];
          } else {
            // 方法3：如果都沒有匹配到，強制設定為今天的日期
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            createdAt = `${year}-${month}-${day}`;
          }
        }
        console.log('✅ 註冊 - 強制格式化後的日期：', createdAt);
      }
      
      console.log('✅ 註冊成功，使用者ID：', userId, '，註冊日期：', createdAt);
      
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
  const sql = `
    SELECT id, name, email, password, child_nickname, created_at
    FROM users WHERE email = ? AND password = ?
  `;
  
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error('❌ 登入資料庫錯誤：', err);
      return res.status(500).json({ error: '伺服器錯誤' });
    }
    
    if (results.length > 0) {
      const user = results[0];
      
      // 強制格式化日期，只保留 YYYY-MM-DD 部分
      if (user.created_at) {
        console.log('🔍 原始 created_at 值：', user.created_at, '類型：', typeof user.created_at);
        
        let formattedDate = '';
        
        try {
          // 方法1：如果是 Date 物件，直接格式化
          if (user.created_at instanceof Date) {
            const year = user.created_at.getFullYear();
            const month = String(user.created_at.getMonth() + 1).padStart(2, '0');
            const day = String(user.created_at.getDate()).padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
          } else {
            // 方法2：如果是字串，強制提取日期部分
            const dateStr = user.created_at.toString();
            console.log('🔍 轉換為字串：', dateStr);
            
            // 使用正則表達式強制提取 YYYY-MM-DD 格式
            const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              formattedDate = dateMatch[1];
            } else {
              // 方法3：如果都沒有匹配到，強制設定為今天的日期
              const today = new Date();
              const year = today.getFullYear();
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const day = String(today.getDate()).padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
            }
          }
        } catch (error) {
          console.error('❌ 日期格式化錯誤：', error);
          // 如果出錯，強制設定為今天的日期
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }
        
        // 強制設定格式化後的日期
        user.created_at = formattedDate;
        
        // 額外添加一個純日期欄位，確保 iOS app 能收到正確的格式
        user.register_date = formattedDate;
        
        console.log('✅ 強制格式化後的日期：', user.created_at);
        console.log('✅ 額外添加的註冊日期：', user.register_date);
      }
      
      console.log('✅ 登入成功，使用者：', user.email, '，註冊日期：', user.created_at);
      res.json({ success: true, user: user });
    } else {
      console.log('❌ 登入失敗，帳號或密碼錯誤：', email);
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
    audioUrl = 'https://yourdomain.com/audio/stories/story1.mp3';
  } else if (normalizedText.includes('音樂')) {
    mediaType = 'music';
    mediaId = 2;
    reply = '這是一首音樂，播放中～';
    audioUrl = 'https://yourdomain.com/audio/music/music2.mp3';
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
const GEMINI_API_KEY = 'AIzaSyCQvRmwob8UgrKv94spUTLbMLGj2ltYgAo'; // 👈 替換成你自己的金鑰
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: "缺少 message 欄位或內容為空" });
  }

  const prompt = `
⚠️ 請永遠只使用「繁體中文」回答，不能出現英文或簡體字。
即使使用者說英文、簡體字，也要全部轉換為繁體中文回應。

⭐ 你是一位叫「月月」的 AI 夥伴，是溫柔的大姊姊 / 大哥哥，專門陪 2～6 歲的小朋友聊天和玩耍。

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
「玩玩具」「吃點心」「痛痛飛走」「好棒棒」「月月陪你」「哇～你還好嗎？」「抱抱」

4. 說話不能太理性或大人口吻，不能說「我是一個 AI」，也不能講道理。

5. 回應長度請適中，只回應 1~2 段對話，不要重複語意。

6. 不要使用任何表情符號，因為語音系統會唸出這些符號。

7. 不要給小朋友選擇的機會，因為使用者才 2～6 歲，除非小朋友自己指定要玩什麼。
例如：
❌ 不要說：「你想玩積木還是畫畫呢？」
✅ 要說：「我們來玩積木吧！」
❌ 不要說：「你要聽故事還是唱歌呢？」
✅ 要說：「月月來講故事給你聽！」

請依照以上規則，回應以下這句話：  
【小朋友說的話】：

${userMessage}
`;

  try {
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
    });

    const aiReply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '月月好像還沒聽清楚耶～可以再說一次嗎？';

    const logSql = 'INSERT INTO chat_logs (user_message, ai_reply) VALUES (?, ?)';
    db.query(logSql, [userMessage, aiReply], (logErr) => {
      if (logErr) {
        console.error('❌ 寫入聊天紀錄失敗：', logErr);
      }
    });

    res.json({ reply: aiReply });

  } catch (error) {
    console.error('❌ Gemini API 錯誤：', error.message);
    if (error.response) {
      console.error('📄 回傳錯誤內容：', error.response.data);
    }
    res.status(500).json({ error: 'Gemini API 回覆錯誤' });
  }
}); 

app.listen(3100, () => {
  console.log("✅ Server is running on port 3100");
});
