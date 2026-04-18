// models/Job.js
const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema(
  {
    company:     { type: String, required: true, trim: true },
    title:       { type: String, required: true, trim: true },
    location:    { type: String, default: '远程/不限', trim: true },
    deadline:    { type: Date },
    tags:        [{ type: String, trim: true }],   // e.g. ['前端', '实习', '北京']
    sourceUrl:   { type: String, trim: true },
    description: { type: String },
    salary:      { type: String },                  // e.g. '200元/天'
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }  // createdAt, updatedAt 自动生成
);

// 复合文本索引，支持公司名 / 职位名模糊检索
JobSchema.index({ company: 'text', title: 'text' });

module.exports = mongoose.model('Job', JobSchema);
