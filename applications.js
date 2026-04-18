const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- 直接在这里定义模型，防止引用报错 ---
const ApplicationSchema = new mongoose.Schema({
    company: { type: String, required: true },
    title:   { type: String, required: true },
    location: { type: String, default: '远程/不限' },
    sourceUrl: { type: String },
    status: {
      type: String,
      enum: ['applied', 'interview', 'offer', 'reject'],
      default: 'applied',
    },
    appliedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 防止模型重复定义的错误处理
const Application = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);

// --- 路由逻辑 ---

// 获取记录
router.get('/', async (req, res) => {
  try {
    const apps = await Application.find().sort({ updatedAt: -1 });
    const board = {
      applied: apps.filter(a => a.status === 'applied'),
      interview: apps.filter(a => a.status === 'interview'),
      offer: apps.filter(a => a.status === 'offer'),
      reject: apps.filter(a => a.status === 'reject'),
    };
    res.json({ board });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增记录
router.post('/', async (req, res) => {
  try {
    const { company, title, location, sourceUrl } = req.body;
    const newApp = new Application({ company, title, location, sourceUrl });
    await newApp.save();
    res.status(201).json(newApp);
  } catch (err) {
    res.status(500).json({ error: "保存失败: " + err.message });
  }
});

// 更新状态
router.put('/:id', async (req, res) => {
    try {
      const updated = await Application.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
      res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 删除记录
router.delete('/:id', async (req, res) => {
    try {
      await Application.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
