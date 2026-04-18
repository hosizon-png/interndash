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

  console.log(`🔍 正在进行多源搜寻: ${q}`);

  try {
      // 尝试使用 360 搜索，它的反爬相对宽松
      const searchUrl = `https://www.so.com/s?q=${encodeURIComponent(q + " 招聘 官网")}`;

      const response = await axios.get(searchUrl, {
          headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.so.com/'
          },
          timeout: 5000 
      });

      const $ = cheerio.load(response.data);
      let results = [];

      // 解析 360 搜索结果
      $('.res-list').each((i, el) => {
          if (results.length >= 8) return;
          const aTag = $(el).find('h3 a');
          const title = aTag.text().trim();
          const link = aTag.attr('href');
          
          if (title && link && !link.includes('so.com')) {
              results.push({
                  company: q.split(' ')[0],
                  title: title,
                  location: "全网检索",
                  sourceUrl: link,
                  tags: ["官网直达", "实时检索"],
                  isActive: true
              });
          }
      });

      // 🚨 兜底机制：如果搜出来是空的，返回一组真实的硬科技公司直连链接
      if (results.length === 0) {
          results = [
              { company: '大疆创新', title: 'DJI 2026 校园招聘/实习', location: '深圳/上海', sourceUrl: 'https://we.dji.com/zh-CN/campus', tags: ['硬科技', '无人机'], isActive: true },
              { company: '比亚迪', title: 'BYD 招聘门户 - 电池/研发', location: '深圳/西安', sourceUrl: 'https://job.byd.com/', tags: ['新能源', '车企'], isActive: true },
              { company: '华为', title: '华为人才招聘官方网站', location: '全国', sourceUrl: 'https://career.huawei.com/', tags: ['通讯', '芯片'], isActive: true },
              { company: '宁德时代', title: 'CATL 2026 实习生招聘', location: '宁德/上海', sourceUrl: 'https://talents.catl.com/', tags: ['新能源', '电池'], isActive: true }
          ];
      }

      res.json({ data: results });

  } catch (error) {
      console.error("❌ 搜索故障:", error.message);
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
