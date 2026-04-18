// app.js — PlayJob 超级全行业索引版
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

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());
app.use(morgan('dev'));

// ─── 🚀 全行业超级索引库 (涵盖 6 大核心赛道) ───
const searchRouter = express.Router();

const JOB_INDEX_DB = [
    // 1. 半导体与硬件 (Semiconductors & Hardware)
    { company: '英伟达 (NVIDIA)', title: 'GPU/AI/软硬件开发实习生', location: '上海/北京/深圳', sourceUrl: 'https://www.nvidia.com/zh-cn/about-nvidia/careers/', tags: ['芯片', 'AI', '外企'], weight: 15 },
    { company: '中芯国际 (SMIC)', title: '2026 校园招聘/实习 - 工艺研发', location: '上海/北京', sourceUrl: 'https://smics.hotjob.cn/', tags: ['半导体', '制造'], weight: 12 },
    { company: '华为海思', title: '海思芯片研发 - 勇敢星实习计划', location: '深圳/上海', sourceUrl: 'https://career.huawei.com/', tags: ['IC设计', '自研'], weight: 15 },
    { company: 'ASML', title: '光刻机技术支持/应用工程实习', location: '上海/北京', sourceUrl: 'https://www.asml.com/en/careers', tags: ['半导体设备', '顶级外企'], weight: 12 },

    // 2. 顶级互联网 (Big Tech)
    { company: '字节跳动', title: 'ByteDance 2026 春季实习/校招', location: '北京/上海/深圳/远程', sourceUrl: 'https://jobs.bytedance.com/campus', tags: ['互联网', '算法', '高薪'], weight: 10 },
    { company: '腾讯 (Tencent)', title: '腾讯招聘官网 - 暑期实习生项目', location: '深圳/广州', sourceUrl: 'https://join.qq.com/', tags: ['社交', '游戏', '技术'], weight: 10 },
    { company: '美团', title: '美团招聘 - 零售/技术/运营/产品实习', location: '北京/上海', sourceUrl: 'https://zhaopin.meituan.com/campus', tags: ['本地生活', '稳健'], weight: 9 },
    { company: '米哈游 (miHoYo)', title: '游戏开发/原画/策划实习 - 2026', location: '上海', sourceUrl: 'https://join.mihoyo.com/', tags: ['游戏', '二次元'], weight: 9 },

    // 3. 金融与咨询 (Finance & Consulting)
    { company: '中金公司 (CICC)', title: '投行/研究/资产管理暑期实习', location: '北京/上海/香港', sourceUrl: 'https://careers.cicc.com/', tags: ['金融', '投行', '顶级'], weight: 8 },
    { company: '普华永道 (PwC)', title: 'PwC 2026 校园招聘 - 审计/咨询', location: '全国', sourceUrl: 'https://www.pwccn.com/zh/careers/students.html', tags: ['四大', '咨询'], weight: 7 },
    { company: '摩根大通 (J.P. Morgan)', title: 'Corporate Analyst 暑期项目', location: '上海/北京', sourceUrl: 'https://careers.jpmorgan.com/global/en/home', tags: ['外资投行', '金融'], weight: 8 },

    // 4. 新能源与汽车 (New Energy & EV)
    { company: '特斯拉 (Tesla)', title: 'Tesla 中国招聘 - 研发/制造/销售实习', location: '上海/北京/全国', sourceUrl: 'https://www.tesla.cn/careers/search/', tags: ['新能源', '自动驾驶'], weight: 10 },
    { company: '宁德时代 (CATL)', title: '2026 实习生招聘 - 电池研发/供应链', location: '宁德/上海', sourceUrl: 'https://talents.catl.com/', tags: ['动力电池', '全球领先'], weight: 9 },
    { company: '蔚来 (NIO)', title: 'NIO 招聘 - 自动驾驶/智能座舱/数字技术', location: '上海/北京', sourceUrl: 'https://www.nio.cn/jobs', tags: ['新势力', '智能化'], weight: 8 },

    // 5. 快消与消费电子 (FMCG & Consumer Electronics)
    { company: '宝洁 (P&G)', title: '宝洁中国暑期实习生项目 (全职场次)', location: '广州/北京/上海', sourceUrl: 'https://www.pgcareers.com/', tags: ['快消', '外企黄埔军校'], weight: 8 },
    { company: '欧莱雅 (L\'Oreal)', title: '管理培训生/实习生计划 - 市场/运营', location: '上海', sourceUrl: 'https://careers.loreal.com/en_US/content/Campus/?locale=en_US', tags: ['美妆', '时尚'], weight: 7 },
    { company: '苹果 (Apple)', title: 'Apple 中国实习项目 - 软件/供应链', location: '北京/上海/深圳', sourceUrl: 'https://www.apple.com/jobs/cn/', tags: ['顶级外企', '消费电子'], weight: 15 }
];

searchRouter.get('/live-search', async (req, res) => {
    const { q } = req.query; 
    try {
        if (!q) return res.json({ data: JOB_INDEX_DB.slice(0, 10) }); // 默认显示前10条
        const kw = q.toLowerCase();
        const results = JOB_INDEX_DB.filter(j => 
            j.company.toLowerCase().includes(kw) || 
            j.tags.some(t => t.toLowerCase().includes(kw)) ||
            j.title.toLowerCase().includes(kw)
        ).sort((a, b) => b.weight - a.weight);
        res.json({ data: results.length > 0 ? results : JOB_INDEX_DB.slice(0, 6) });
    } catch (e) { res.json({ data: JOB_INDEX_DB.slice(0, 6) }); }
});

app.use('/api', searchRouter);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/posts', postRoutes);

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/interndash')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
