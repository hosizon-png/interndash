const express = require('express');
const router = express.Router();
const Application = require('./models/Application'); // 确保路径正确

// 获取看板所有投递记录
router.get('/', async (req, res) => {
  try {
    const apps = await Application.find().sort({ updatedAt: -1 });
    // 按状态分组返回
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

// 加入看板（新增投递）
router.post('/', async (req, res) => {
  try {
    // 前端会传 jobObj，我们将其解构出来存入数据库
    const { company, title, location, sourceUrl, applicantName } = req.body;
    
    if (!company || !title) {
      return res.status(400).json({ error: "公司名称和职位是必填项" });
    }

    const newApp = new Application({
      company,
      title,
      location,
      sourceUrl,
      applicantName: applicantName || '我',
      status: 'applied'
    });

    const savedApp = await newApp.save();
    res.status(201).json(savedApp);
  } catch (err) {
    console.error("❌ 保存看板失败:", err);
    res.status(500).json({ error: "无法存入数据库: " + err.message });
  }
});

// 更新状态
router.put('/:id', async (req, res) => {
  try {
    const updated = await Application.findByIdAndUpdate(
      req.params.id, 
      { status: req.body.status }, 
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除记录
router.delete('/:id', async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
