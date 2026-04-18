// routes/posts.js
const express = require('express');
const router  = express.Router();
const Post    = require('./Post');

/**
 * GET /api/posts
 * ?page=1&limit=15&tag=秋招
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 15, tag } = req.query;
    const filter = {};
    if (tag) filter.tags = tag;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-content');   // 列表不返回正文，节省流量

    res.json({ total, page: Number(page), data: posts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/posts/:id  帖子详情（含正文）
 */
router.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },   // 阅读量 +1
      { new: true }
    );
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/posts  发帖
 * Body: { author, title, content, tags? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { author, title, content, tags } = req.body;
    if (!author || !title || !content) {
      return res.status(400).json({ error: 'author / title / content 为必填项' });
    }
    const post = await Post.create({ author, title, content, tags });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/posts/:id/like  点赞
 */
router.put('/:id/like', async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    res.json({ likes: post.likes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
