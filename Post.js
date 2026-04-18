// models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    author:    { type: String, required: true, trim: true },
    title:     { type: String, required: true, trim: true, maxlength: 100 },
    content:   { type: String, required: true },
    tags:      [{ type: String, trim: true }],
    views:     { type: Number, default: 0 },
    likes:     { type: Number, default: 0 },
    isPinned:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

PostSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Post', PostSchema);
