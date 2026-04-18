// models/Application.js
const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['applied', 'interview', 'offer', 'reject'];

const ApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    // 简化版：暂不接入用户系统，用字符串标识投递人（后续可替换为 ObjectId → User）
    applicantName: { type: String, default: '我', trim: true },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'applied',
    },
    appliedAt:  { type: Date, default: Date.now },
    notes:      { type: String },          // 备注，如"HR 联系了我"
    nextAction: { type: String },          // 下一步行动，如"准备技术面"
    nextDate:   { type: Date },            // 下一步日期提醒
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', ApplicationSchema);
