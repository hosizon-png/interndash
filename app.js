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

// ─── 🚀 核心功能：现场搜索引擎聚合接口 (Bing 中国区嵌套) ──────────
// 放在常规路由之前，确保优先匹配
app.get('/api/live-search', async (req, res) => {
    const { q } = req.query; 
    if (!q) return res.json({ data: [] });

    console.log(`🔍 正在为用户全网现场搜寻: ${q}`);

    try {
        // 构造搜索 URL（加上“招聘”关键词，提高结果精准度）
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(q + " 招聘 官网 实习")}`;

        // 模拟真实浏览器 Header
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            timeout: 8000 // 8秒超时，防止 Render 挂起
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // 必应的搜索结果列表通常在 .b_algo 容器中
        $('.b_algo').each((i, el) => {
            if (i < 8) { // 只取前 8 条精华
                const titleElement = $(el).find('h2 a');
                const title = titleElement.text().trim();
                const link = titleElement.attr('href');
                
                // 排除必应自身的广告或无效链接
                if (title && link && !link.includes('bing.com')) {
                    results.push({
                        company: q.split(' ')[0], // 提取搜索关键词第一个词作为公司名
                        title: title,
                        location: "实时检索",
                        sourceUrl: link,
                        tags: ["现场搜寻", "直达官网"],
                        isActive: true
                    });
                }
            }
        });

        console.log(`✅ 搜寻完成，吐出 ${results.length} 条实时结果`);
        res.json({ data: results });

    } catch (error) {
        console.error("❌ 现场搜索失败:", error.message);
        // 如果现场搜素失败，返回空数组，不让前端崩溃
        res.status(500).json({ data: [], error: "搜索引擎暂时繁忙" });
    }
});

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
