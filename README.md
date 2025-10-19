# Mamoon AI 陪伴助手 - 後端伺服器

## 🚀 Zeabur 部署指南

### 已優化的冷啟動問題

本次更新已針對 Zeabur 部署環境進行以下優化：

#### ✅ 1. 資料庫連線池
- 從單一連線改為**連線池**（Connection Pool）
- 自動重連機制，避免長時間閒置斷線
- 設定 20 秒連線逾時，適應冷啟動延遲
- 啟用 Keep-Alive 保持連線活性

#### ✅ 2. 健康檢查端點
- 新增 `GET /health` 端點供 Zeabur 監控
- 新增 `GET /` 根路徑端點，避免 404 錯誤
- 即使資料庫暫時無法連線，服務仍可啟動

#### ✅ 3. 錯誤處理與容錯
- 修正 `/chat` 端點的競態條件問題
- 資料庫查詢失敗時不會中斷服務
- Gemini API 設定 30 秒逾時
- 提供友善的錯誤回覆訊息

#### ✅ 4. 優雅關閉機制
- 監聽 `SIGTERM` 和 `SIGINT` 信號
- 先關閉 HTTP 服務，再關閉資料庫連線
- 30 秒強制關閉保護機制
- 處理未捕獲的異常和 Promise 拒絕

---

## 📦 環境變數設定

在 Zeabur 專案設定中，請確保設定以下環境變數：

```env
DB_HOST=你的資料庫主機
DB_PORT=3306
DB_USER=你的資料庫使用者名稱
DB_PASSWORD=你的資料庫密碼
DB_NAME=你的資料庫名稱
PORT=3100
```

---

## 🔧 本地開發

### 安裝依賴
```bash
npm install
```

### 啟動開發伺服器
```bash
npm run dev
```

### 啟動正式環境
```bash
npm start
```

---

## 🏥 健康檢查

部署後可訪問以下端點確認服務狀態：

- **根路徑**: `https://your-domain.zeabur.app/`
- **健康檢查**: `https://your-domain.zeabur.app/health`

正常回應範例：
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T12:00:00.000Z"
}
```

---

## 🛠️ Zeabur 部署建議

### 1. 設定健康檢查
在 Zeabur 專案設定中：
- **Health Check Path**: `/health`
- **Health Check Interval**: 30 秒
- **Health Check Timeout**: 10 秒

### 2. 資源配置
建議最低配置：
- **Memory**: 512 MB
- **CPU**: 0.5 vCPU

### 3. 自動重啟
- 啟用「自動重啟」功能
- 設定最大重啟次數：5 次

### 4. 日誌監控
定期檢查 Zeabur 日誌，確認：
- ✅ `成功連接資料庫`
- ✅ `Server is running on port xxxx`
- 無重複的連線錯誤訊息

---

## 🐛 疑難排解

### 問題：服務無法啟動
**解決方案**：
1. 檢查 Zeabur 環境變數是否正確設定
2. 確認資料庫允許從 Zeabur IP 連線
3. 檢查資料庫連線字串格式是否正確

### 問題：間歇性 503 錯誤
**解決方案**：
1. 這是正常的冷啟動延遲（首次請求需 5-10 秒）
2. 重試請求即可
3. 建議前端加入重試機制

### 問題：資料庫連線逾時
**解決方案**：
1. 確認資料庫服務正常運行
2. 檢查防火牆規則
3. 考慮將資料庫部署在同一區域

---

## 📊 API 端點列表

| 端點 | 方法 | 說明 |
|------|------|------|
| `/` | GET | 服務狀態 |
| `/health` | GET | 健康檢查 |
| `/register` | POST | 使用者註冊 |
| `/login` | POST | 使用者登入 |
| `/check-email` | POST | 檢查信箱 |
| `/reset-password` | POST | 重設密碼 |
| `/profile` | GET | 個人資料 |
| `/update_profile` | POST | 更新資料 |
| `/stories` | GET | 故事列表 |
| `/api/music/categories` | GET | 音樂分類 |
| `/api/music/:category` | GET | 分類音樂 |
| `/chat` | POST | AI 對話 |
| `/ai/interpret` | POST | 語音分析 |

---

## 📝 更新日誌

### v1.0.0 (2025-10-18)
- ✅ 修正 Zeabur 冷啟動問題
- ✅ 改用資料庫連線池
- ✅ 新增健康檢查端點
- ✅ 修正 /chat 端點競態條件
- ✅ 新增優雅關閉機制
- ✅ 改善錯誤處理與容錯能力

---

## 📧 聯絡資訊

如有問題或建議，請聯繫開發團隊。

[README.md](https://github.com/user-attachments/files/22991516/README.md)
