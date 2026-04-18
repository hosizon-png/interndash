// routes/applications.js
const express     = require('express');
const router      = express.Router();
const Application = require('./Application');

/**
 * GET /api/applications
 * 返回看板数据，按状态分组
 * ?status=applied|interview|offer|reject  （可选过滤）
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const applications = await Application.find(filter)
      .populate('job', 'company title location deadline tags sourceUrl')  // 关联 Job 字段
      .sort({ appliedAt: -1 });

    // 按状态分组，便于看板直接渲染
    const board = {
      applied:   [],
      interview: [],
      offer:     [],
      reject:    [],
    };
    applications.forEach(app => board[app.status].push(app));

    res.json({ total: applications.length, board });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/applications  新增一条投递记录
 * Body: { job: "<jobId>", applicantName?, notes?, nextAction?, nextDate? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { job, applicantName, notes, nextAction, nextDate } = req.body;
    if (!job) return res.status(400).json({ error: 'job 字段必填' });

    const application = await Application.create({
      job, applicantName, notes, nextAction, nextDate,
    });
    const populated = await application.populate('job', 'company title location sourceUrl');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/applications/:id  更新状态或备注
 * Body: { status?, notes?, nextAction?, nextDate? }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const allowedUpdates = ['status', 'notes', 'nextAction', 'nextDate'];
    const updates = {};
    allowedUpdates.forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('job', 'company title location sourceUrl');

    if (!application) return res.status(404).json({ error: '投递记录不存在' });
    res.json(application);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/applications/:id  删除一条投递记录
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) return res.status(404).json({ error: '投递记录不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
