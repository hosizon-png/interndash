// routes/jobs.js
const express = require('express');
const router  = express.Router();
const Job     = require('./Job');

/**
 * GET /api/jobs
 * 查询参数：
 *   ?company=xxx   公司名模糊匹配
 *   ?title=xxx     职位名模糊匹配
 *   ?tags=前端,北京  标签过滤（逗号分隔）
 *   ?page=1&limit=20  分页
 */
router.get('/', async (req, res, next) => {
  try {
    const { company, title, tags, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };

    if (company) filter.company = { $regex: company, $options: 'i' };
    if (title)   filter.title   = { $regex: title,   $options: 'i' };
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagArray.length) filter.tags = { $in: tagArray };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Job.countDocuments(filter);
    const jobs  = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ total, page: Number(page), limit: Number(limit), data: jobs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jobs/:id  获取单个岗位详情
 */
router.get('/:id', async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: '岗位不存在' });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jobs  手动添加岗位（爬虫或管理员使用）
 */
router.post('/', async (req, res, next) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
