// app.js  —  InternDash 后端入口
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');

const jobRoutes         = require('./jobs');
const applicationRoutes = require('./applications');
const postRoutes        = require('./posts');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── 中间件 ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',   // 生产环境替换为具体域名
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(morgan('dev'));   // 控制台请求日志，便于调试

// ─── 路由挂载 ─────────────────────────────────────────────
app.use('/api/jobs',         jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/posts',        postRoutes);

// ─── 健康检查 ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── 404 兜底 ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

// ─── 全局错误处理 ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.stack);
  res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
});

// ─── 连接数据库后启动服务器 ────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/interndash', {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ MongoDB 连接成功');
    app.listen(PORT, () => console.log(`🚀 服务器运行于 http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB 连接失败:', err.message);
    process.exit(1);
  });

module.exports = app;
