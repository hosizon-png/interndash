const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['applied', 'interview', 'offer', 'reject'];

const ApplicationSchema = new mongoose.Schema(
  {
    // 修改：不再强制要求 job 必须是数据库里的 ObjectId
    // 这样可以直接把搜索到的虚拟数据存进来
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: false, // 改为非必填
    },
    // 新增：直接存储岗位关键信息，防止关联失效
    company: { type: String, required: true },
    title:   { type: String, required: true },
    location: { type: String, default: '远程/不限' },
    sourceUrl: { type: String },
    
    applicantName: { type: String, default: '我', trim: true },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'applied',
    },
    appliedAt:  { type: Date, default: Date.now },
    notes:      { type: String },
    nextAction: { type: String },
    nextDate:   { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', ApplicationSchema);
