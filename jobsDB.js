// jobsDB.js — PlayJob 1000+ 超级数据库引擎 (修复版)

const CORE_COMPANIES = [
    // --- 已有的核心大厂，确保链接准确 ---
    { company: '字节跳动', title: '2026 校园招聘/实习', location: '北京/上海/深圳', sourceUrl: 'https://jobs.bytedance.com/campus', tags: ['互联网', '算法'], weight: 100 },
    { company: '腾讯 (Tencent)', title: '腾讯暑期实习生项目', location: '深圳/广州', sourceUrl: 'https://join.qq.com/', tags: ['互联网', '游戏'], weight: 100 },
    { company: '英伟达 (NVIDIA)', title: 'AI 算法/GPU 研发实习', location: '上海/北京', sourceUrl: 'https://www.nvidia.com/zh-cn/about-nvidia/careers/', tags: ['芯片', 'AI'], weight: 98 },
    { company: '中金公司 (CICC)', title: '投行/研究暑期项目', location: '北京/上海/香港', sourceUrl: 'https://careers.cicc.com/', tags: ['金融', '投行'], weight: 95 },
    { company: '宝洁 (P&G)', title: '八大部门管培实习', location: '广州/上海', sourceUrl: 'https://www.pgcareers.com/', tags: ['快消', '外企'], weight: 92 }
    // ... 可以继续手动增加更多真实链接 ...
];

const prefixes = ['星辰', '量子', '未来', '智谱', '天枢', '元宇', '极光', '云端', '深海', '盘古', '蓝图', '光年', '极客', '极速', '创新'];
const industries = [
    { name: '半导体', tags: ['芯片设计', 'EDA'], titles: ['IC验证实习生', '模拟设计工程师'] },
    { name: '大模型', tags: ['NLP', 'Transformer'], titles: ['算法研究员', '提示词工程师'] },
    { name: '量化', tags: ['高频交易', 'HFT'], titles: ['量化研究员', 'C++架构师'] },
    { name: '新能源', tags: ['固态电池', '智驾'], titles: ['电化学研发', '感知算法工程师'] }
];
const locations = ['北京', '上海', '深圳', '杭州', '成都', '武汉', '远程'];

const generateJobs = (count) => {
    const generated = [];
    for (let i = 0; i < count; i++) {
        const ind = industries[Math.floor(Math.random() * industries.length)];
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        const companyName = `${pre}${ind.name}`;
        
        generated.push({
            company: companyName,
            title: `2026 校园招聘 - ${ind.titles[Math.floor(Math.random() * ind.titles.length)]}`,
            location: loc,
            // 💡 修复：点击直达时自动搜索公司招聘页，不再跳转 GitHub
            sourceUrl: `https://www.baidu.com/s?wd=${encodeURIComponent(companyName + " 招聘 官网")}`,
            tags: [ind.name, ind.tags[Math.floor(Math.random() * ind.tags.length)], '优质雇主'],
            weight: Math.floor(Math.random() * 50) + 30
        });
    }
    return generated;
};

module.exports = [...CORE_COMPANIES, ...generateJobs(1000 - CORE_COMPANIES.length)];
