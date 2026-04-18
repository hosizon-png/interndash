// app.js — PlayJob 后端入口 (1000+ 海量企业模块化版)
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');

// 引入原有业务路由
const jobRoutes         = require('./jobs');
const applicationRoutes = require('./applications');
const postRoutes        = require('./posts');

// ─── 🚀 引入外部 1000+ 超级数据库 ───
// 请确保你的项目根目录下已经创建了 jobsDB.js 文件
const JOB_INDEX_DB = require('./jobsDB');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── 中间件 ───────────────────────────────────────────────
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'] 
}));
app.use(express.json());
app.use(morgan('dev'));

// ─── 核心功能：海量数据搜索引擎 ─────────────────────────────
const searchRouter = express.Router();

searchRouter.get('/live-search', async (req, res) => {
    const { q } = req.query; 
    try {
        if (!q) {
            // 无搜索词时：从 1000 家里随机抽 20 家展示 (盲盒模式)
            const shuffled = [...JOB_INDEX_DB].sort(() => 0.5 - Math.random());
            return res.json({ data: shuffled.slice(0, 20) });
        }

        const kw = q.toLowerCase();
        
        // 瞬间从 1000 家企业中过滤匹配数据
        const results = JOB_INDEX_DB.filter(j => 
            (j.company && j.company.toLowerCase().includes(kw)) || 
            (j.tags && j.tags.some(t => t.toLowerCase().includes(kw))) ||
            (j.title && j.title.toLowerCase().includes(kw)) ||
            (j.location && j.location.toLowerCase().includes(kw))
        ).sort((a, b) => b.weight - a.weight); // 按企业权重降序排列

        // 如果搜不到精准结果，随机给 8 个硬核岗位作为兜底推荐
        if (results.length > 0) {
            res.json({ data: results });
        } else {
            const fallback = [...JOB_INDEX_DB].sort(() => 0.5 - Math.random());
            res.json({ data: fallback.slice(0, 8) });
        }
    } catch (e) { 
        console.error("搜索接口异常:", e.message);
        res.json({ data: [] }); 
    }
});

// ─── 路由挂载 (注意顺序) ────────────────────────────────────
app.use('/api', searchRouter);
app.use('/api/jobs',         jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/posts',        postRoutes);

// ─── 健康检查与兜底 ───────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// ─── 数据库连接与启动 ──────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/interndash', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB 数据库连接成功'))
  .catch(err => console.error('❌ MongoDB 数据库连接失败:', err.message));

app.listen(PORT, () => console.log(`🚀 史诗级服务器已启动: http://localhost:${PORT}`));

module.exports = app;
