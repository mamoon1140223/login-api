const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = 3100;

app.use(cors());
app.use(express.json()); // ✅ 必加：接收 JSON 請求

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('❌ 資料庫連線失敗：', err);
  } else {
    console.log('✅ 成功連接資料庫');
  }
});

app.post('/register', (req, res) => {
  const { name, email, password, child_nickname } = req.body;

  const sql = "INSERT INTO users (name, email, password, child_nickname) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, email, password, child_nickname], (err, result) => {
    if (err) {
      console.error("註冊失敗", err);
      return res.status(500).json({ message: "註冊失敗" });
    }

    // 新增成功後取得剛新增的 created_at 時間
    const userId = result.insertId;
    const selectSql = "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at FROM users WHERE id = ?";

    db.query(selectSql, [userId], (err2, rows) => {
      if (err2) {
        console.error("❌ 查詢註冊時間失敗", err2);
        return res.status(500).json({ message: "註冊成功但無法取得註冊時間" });
      }

      res.status(200).json({
        message: "註冊成功",
        created_at: rows[0].created_at  // ✅ 回傳註冊日期給前端
      });
    });
  });
});



// ✅ 登入 API
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: '伺服器錯誤' });

      if (results.length > 0) {
        res.json({ success: true, user: results[0] });
      } else {
        res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
      }
    }
  );
});

// ✅ 檢查 Email 是否存在
app.post('/check-email', (req, res) => {
  const { email } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: '伺服器錯誤' });

    res.json({ exists: results.length > 0 });
  });
});

// ✅ 重設密碼 API
app.post('/reset-password', (req, res) => {
  const { email, password } = req.body;

  db.query(
    'UPDATE users SET password = ? WHERE email = ?',
    [password, email],
    (err, result) => {
      if (err) return res.status(500).json({ error: '更新失敗' });

      if (result.affectedRows > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Email 不存在' });
      }
    }
  );
});



app.get('/profile', (req, res) => {
  const email = req.query.email;
  if (!email) {
      return res.status(400).json({ error: 'Missing email parameter' });
  }

  const sql = `
      SELECT 
          name, 
          email, 
          DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at, 
          child_nickname 
      FROM users 
      WHERE email = ?
  `;

  db.query(sql, [email], (err, results) => {
      if (err) {
          console.error('MySQL error:', err);
          return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      res.json(results[0]);
  });
});
app.get('/stories', (req, res) => {
  const sql = `
      SELECT id, title, category, content, audio_url, 
             DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at
      FROM stories
      ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
      if (err) {
          console.error("❌ 讀取故事失敗:", err);
          return res.status(500).json({ error: "資料庫錯誤" });
      }

      res.json(results);
  });
});
// ✅ [1] 撈出所有音樂分類
app.get('/api/music/categories', (req, res) => {
  const query = 'SELECT DISTINCT category FROM music';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    const categories = results.map(row => row.category);
    res.json(categories);
  });
});


// ✅ [2] 根據分類名稱撈出音樂清單
app.get('/api/music/:category', (req, res) => {
  const category = decodeURIComponent(req.params.category);
  const query = 'SELECT id, title, audio_url FROM music WHERE category = ?';
  db.query(query, [category], (err, results) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    res.json(results);
  });
});


app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://0.0.0.0:${port}`);
});
// ✅ 新增 AI 解讀語音文字的 API
app.post('/ai/interpret', (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: '缺少文字內容' });
  }

  // 模擬邏輯（你可以換成 GPT 判斷或其他 NLP 模型）
  const normalizedText = text.toLowerCase();

  let mediaType = null;
  let mediaId = null;
  let reply = '';
  let audioUrl = '';

  if (normalizedText.includes('故事')) {
    mediaType = 'story';
    mediaId = 1; // 👉 範例 ID（你可以隨機選或查資料庫）
    reply = '好的，這是兔兔的冒險故事，播放中...';
    audioUrl = 'https://yourdomain.com/audio/stories/story1.mp3';
  } else if (normalizedText.includes('音樂')) {
    mediaType = 'music';
    mediaId = 2; // 👉 範例 ID
    reply = '這是一首搖籃曲，播放中～';
    audioUrl = 'https://yourdomain.com/audio/music/music2.mp3';
  } else {
    reply = '我還聽不太懂，你可以再說一次嗎？';
  }

  res.json({
    reply,
    media_type: mediaType,
    media_id: mediaId,
    audio_url: audioUrl
  });
});


app.post('/update_profile', (req, res) => {
  console.log("🔧 收到 update_profile：", req.body);
  const { name, email, child_nickname } = req.body;

  if (!name || !email || !child_nickname) {
      return res.status(400).send('缺少欄位');
  }

  const sql = `UPDATE users SET name = ?, child_nickname = ? WHERE email = ?`;

  db.query(sql, [name, child_nickname, email], (err, result) => {
      if (err) {
          console.error('❌ 更新失敗:', err);
          return res.status(500).send('資料庫錯誤');
      }

      if (result.affectedRows === 0) {
          return res.status(404).send('找不到該帳號');
      }

      res.status(200).send('更新成功');
  });
});
app.post('/history', (req, res) => {
  const { user_id, media_type, media_id } = req.body;

  if (!user_id || !media_type || !media_id) {
    return res.status(400).json({ error: '缺少必要欄位' });
  }

  const sql = `
    INSERT INTO user_media_history (user_id, media_type, media_id)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [user_id, media_type, media_id], (err, result) => {
    if (err) {
      console.error('❌ 新增歷史紀錄失敗:', err);
      return res.status(500).json({ error: '資料庫錯誤' });
    }

    res.json({ success: true, message: '已記錄播放紀錄' });
  });
});
app.get('/history/:userId', (req, res) => {
  const userId = req.params.userId;

  const sql = `
    SELECT 
      h.media_type,
      h.media_id,
      h.played_at,
      CASE 
        WHEN h.media_type = 'story' THEN s.title
        WHEN h.media_type = 'music' THEN m.title
        ELSE NULL
      END AS title,
      CASE 
        WHEN h.media_type = 'story' THEN s.audio_url
        WHEN h.media_type = 'music' THEN m.audio_url
        ELSE NULL
      END AS audio_url
    FROM user_media_history h
    LEFT JOIN stories s ON h.media_type = 'story' AND h.media_id = s.id
    LEFT JOIN music m ON h.media_type = 'music' AND h.media_id = m.id
    WHERE h.user_id = ?
    ORDER BY h.played_at DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('❌ 查詢歷史紀錄失敗:', err);
      return res.status(500).json({ error: '資料庫錯誤' });
    }

    res.json(results);
  });
});
