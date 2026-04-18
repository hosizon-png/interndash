// app.js  —  PlayJob 后端入口
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');
const axios      = require('axios');
const cheerio    = require('cheerio');

const jobRoutes         = require('./jobs');
const applicationRoutes = require('./applications');
const postRoutes        = require('./posts');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── 中间件 ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',   
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(morgan('dev'));   

// ─── 🚀 核心功能：现场搜索引擎聚合逻辑 ──────────────────────
const searchRouter = express.Router();

searchRouter.get('/live-search', async (req, res) => {
    const { q } = req.query; 
    if (!q) return res.json({ data: [] });

    console.log(`🔍 正在全网搜寻关键词: ${q}`);

    try {
        // 构造必应搜索 URL
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(q + " 招聘 官网 实习")}`;

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': 'https://www.bing.com/'
            },
            timeout: 7000 
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // 增强的选择器：抓取必应的搜索结果条目
        $('.b_algo, .b_ans, #b_results .li').each((i, el) => {
            if (results.length >= 10) return; 

            const aTag = $(el).find('h2 a');
            if (aTag.length === 0) return;

            const title = aTag.text().trim();
            const link = aTag.attr('href');
            
            // 过滤掉无效链接
            if (title && link && link.startsWith('http') && !link.includes('bing.com')) {
                results.push({
                    company: q.split(' ')[0], 
                    title: title,
                    location: "全网实时",
                    sourceUrl: link,
                    tags: ["现场搜寻", "直达链接"],
                    isActive: true
                });
            }
        });

        console.log(`✅ 搜寻完成，抓取到 ${results.length} 条数据`);
        res.json({ data: results });

    } catch (error) {
        console.error("❌ 搜索接口波动:", error.message);
        res.json({ data: [], error: "搜索暂时不可用" });
    }
});

// ─── 路由挂载 (注意顺序) ────────────────────────────────────
// 1. 挂载实时搜索 (这会让路径变为 /api/live-search)
app.use('/api', searchRouter);

// 2. 挂载其他业务路由
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
