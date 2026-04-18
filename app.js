// app.js — PlayJob 后端入口 (增加半导体企业索引 + 字段修复)
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

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',   
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(morgan('dev'));   

// ─── 🚀 核心功能：精品招聘索引库 (新增半导体板块) ──────────
const searchRouter = express.Router();

const JOB_INDEX_DB = [
    // --- 半导体/芯片企业 (Semiconductors) ---
    { company: '中芯国际 (SMIC)', title: '中芯国际 2026 校园招聘 - 工艺/研发/设备', location: '上海/北京/天津', sourceUrl: 'https://smics.hotjob.cn/', tags: ['半导体', '晶圆代工', '国之重器'], weight: 15 },
    { company: '华为海思 (HiSilicon)', title: '海思芯片研发实习生 - 2026 勇敢星', location: '深圳/北京/上海', sourceUrl: 'https://career.huawei.com/', tags: ['芯片', 'IC设计', '架构'], weight: 15 },
    { company: '紫光展锐', title: '紫光展锐 2026 招聘 - 通信/射频/芯片设计', location: '上海/南京', sourceUrl: 'https://unisoc.zhiye.com/', tags: ['芯片', '移动通讯'], weight: 12 },
    { company: '长江存储 (YMTC)', title: '长江存储 2026 校园招聘 - 存储器研发', location: '武汉/上海', sourceUrl: 'https://ymtc.zhiye.com/', tags: ['存储芯片', '硬科技'], weight: 12 },
    { company: '英伟达 (NVIDIA)', title: 'NVIDIA 中国招聘 - GPU/AI/软硬件开发', location: '上海/北京/深圳', sourceUrl: 'https://www.nvidia.com/zh-cn/about-nvidia/careers/', tags: ['GPU', 'AI芯片', '外企'], weight: 15 },
    { company: '台积电 (TSMC)', title: 'TSMC 2026 招聘 - 晶圆制造工程/技术研发', location: '南京/上海', sourceUrl: 'https://www.tsmc.com.cn/chinese/careers/index.htm', tags: ['半导体', '制造'], weight: 12 },
    { company: '长电科技', title: '长电科技 2026 招聘 - 芯片封装/测试工程', location: '无锡/上海', sourceUrl: 'https://www.jcetglobal.com/Careers', tags: ['封测', '半导体'], weight: 10 },
    { company: 'ASML', title: 'ASML 中国校园招聘 - 光刻机客户支持/应用工程', location: '上海/北京/深圳', sourceUrl: 'https://www.asml.com/en/careers', tags: ['光刻机', '顶级外企'], weight: 15 },

    // --- 互联网/硬科技 ---
    { company: '字节跳动', title: 'ByteDance 校园招聘/实习生项目', location: '北京/上海/深圳', sourceUrl: 'https://jobs.bytedance.com/campus', tags: ['互联网', '高薪'], weight: 10 },
    { company: '大疆创新 (DJI)', title: 'DJI 2026 招聘 - 机器人/硬件/软件', location: '深圳/上海', sourceUrl: 'https://we.dji.com/zh-CN/campus', tags: ['无人机', '智能硬件'], weight: 10 },
    { company: '比亚迪', title: 'BYD 招聘门户 - 半导体/电池/车辆研发', location: '深圳/西安', sourceUrl: 'https://job.byd.com/', tags: ['新能源车', '制造'], weight: 10 }
];

searchRouter.get('/live-search', async (req, res) => {
    const { q } = req.query; 
    try {
        if (!q) return res.json({ data: JOB_INDEX_DB.slice(0, 8) });
        const keyword = q.toLowerCase();
        const results = JOB_INDEX_DB.filter(job => 
            job.company.toLowerCase().includes(keyword) || 
            job.tags.some(tag => tag.toLowerCase().includes(keyword)) ||
            job.title.toLowerCase().includes(keyword)
        ).sort((a, b) => b.weight - a.weight);

        res.json({ data: results.length > 0 ? results : JOB_INDEX_DB.slice(0, 5) });
    } catch (error) {
        res.json({ data: JOB_INDEX_DB.slice(0, 5) });
    }
});

// ─── 路由挂载 ─────────────────────────────────────────────
app.use('/api', searchRouter);
app.use('/api/jobs',         jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/posts',        postRoutes);

// ─── 健康检查与数据库连接 ──────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/interndash')
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

app.listen(PORT, () => console.log(`🚀 服务器已启动` ));

module.exports = app;
