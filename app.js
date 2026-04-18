// app.js  —  PlayJob 后端入口 (高性能内置检索版)
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');

// 注意：这里不再强制依赖 axios 和 cheerio，因为我们改为内置高性能匹配
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

// ─── 🚀 核心功能：智能内置职位检索逻辑 ──────────────────────
const searchRouter = express.Router();

// 预设的高质量招聘入口数据库 (涵盖主流大厂及硬科技企业)
const JOB_INDEX_DB = [
    { company: '字节跳动', title: 'ByteDance 校园招聘/实习生项目', location: '北京/上海/深圳/远程', sourceUrl: 'https://jobs.bytedance.com/campus', tags: ['互联网', '算法', '产品'], weight: 10 },
    { company: '腾讯', title: '腾讯招聘官网 - 2026 实习生/校园招聘', location: '深圳/广州/北京', sourceUrl: 'https://join.qq.com/', tags: ['互联网', '游戏', '全能'], weight: 10 },
    { company: '阿里巴巴', title: '阿里校园招聘 - 实习生计划', location: '杭州/北京/远程', sourceUrl: 'https://campus.alibaba.com/', tags: ['电商', '阿里云', '技术'], weight: 10 },
    { company: '美团', title: '美团招聘 - 零售/技术/运营实习', location: '北京/上海', sourceUrl: 'https://zhaopin.meituan.com/campus', tags: ['本地生活', '生活服务'], weight: 9 },
    { company: '华为', title: '华为招聘官网 - 勇敢星实习计划', location: '全国', sourceUrl: 'https://career.huawei.com/', tags: ['通讯', '芯片', '底层'], weight: 10 },
    { company: '大疆创新', title: 'DJI 2026 招聘门户 - 机器人/硬件/软件', location: '深圳/上海', sourceUrl: 'https://we.dji.com/zh-CN/campus', tags: ['硬科技', '无人机', '智能制造'], weight: 9 },
    { company: '宁德时代', title: 'CATL 宁德时代实习生招聘 - 绿色能源', location: '宁德/上海', sourceUrl: 'https://talents.catl.com/', tags: ['新能源', '电池', '材料'], weight: 8 },
    { company: '比亚迪', title: 'BYD 招聘门户 - 迪粉招募/研发岗', location: '深圳/西安/长沙', sourceUrl: 'https://job.byd.com/', tags: ['新能源车', '制造'], weight: 8 },
    { company: '米哈游', title: 'miHoYo 招聘 - 技术/美术/策划/运营', location: '上海', sourceUrl: 'https://join.mihoyo.com/', tags: ['游戏', '二次元', '技术'], weight: 9 },
    { company: '蔚来', title: 'NIO 蔚来招聘 - 自动驾驶/数字座舱', location: '上海/北京/合肥', sourceUrl: 'https://www.nio.cn/jobs', tags: ['智驾', '车企'], weight: 7 },
    { company: '小红书', title: '小红书招聘 - RED 实习生计划', location: '上海/北京', sourceUrl: 'https://job.xiaohongshu.com/campus', tags: ['社交', '内容社区'], weight: 7 },
    { company: '百度', title: '百度人才招聘官方网站 - AI/搜索', location: '北京/上海', sourceUrl: 'https://talent.baidu.com/', tags: ['人工智能', '搜索'], weight: 9 }
];

searchRouter.get('/live-search', async (req, res) => {
    const { q } = req.query; 
    if (!q) return res.json({ data: JOB_INDEX_DB.slice(0, 5) }); // 无输入则返回热门

    console.log(`🔍 正在智能检索关键词: ${q}`);

    try {
        const keyword = q.toLowerCase();
        
        // 执行模糊匹配逻辑
        const results = JOB_INDEX_DB.filter(job => {
            return job.company.toLowerCase().includes(keyword) || 
                   job.tags.some(tag => tag.toLowerCase().includes(keyword)) ||
                   job.title.toLowerCase().includes(keyword);
        });

        // 匹配结果排序 (权重高的靠前)
        results.sort((a, b) => b.weight - a.weight);

        // 如果没有精准匹配，则返回相关性较高的兜底数据
        const finalData = results.length > 0 ? results : JOB_INDEX_DB.slice(0, 4);

        res.json({ data: finalData });
    } catch (error) {
        console.error("❌ 检索异常:", error.message);
        res.json({ data: JOB_INDEX_DB.slice(0, 4) });
    }
});

// ─── 路由挂载 (注意顺序) ────────────────────────────────────
// 1. 挂载搜索路由器
app.use('/api', searchRouter);

// 2. 挂载原有业务路由
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
