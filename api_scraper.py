import os
import requests
from pymongo import MongoClient, UpdateOne
from datetime import datetime
from dotenv import load_dotenv

# 1. 连接你的云端数据库
load_dotenv()
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("❌ 错误：未找到 MONGO_URI 环境变量，请检查 .env 文件")
    exit(1)
    
db = MongoClient(MONGO_URI)['interndash']

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

def fetch_tencent_interns():
    print("⏳ 正在请求腾讯官方接口...")
    # 修复点：去掉了之前多余的格式符号，只保留干净的 URL
    url = "https://careers.tencent.com/tencentcareer/api/post/Query?keyword=实习&pageIndex=1&pageSize=40&language=zh-cn&area=cn"
    jobs = []
    try:
        res = requests.get(url, headers=headers).json()
        posts = res.get('Data', {}).get('Posts', [])
        
        for p in posts:
            title = p.get('PostName', '未知岗位')
            # 如果标题太长，稍微清理一下
            if len(title) > 35: title = title[:35] + "..."
            
            # 修复点：极其干净的官网直达链接拼接
            post_id = p.get('PostId')
            source_url = f"https://careers.tencent.com/jobdesc.html?postId={post_id}"
            
            jobs.append({
                'company': '腾讯',
                'title': title,
                'location': p.get('LocationName', '未知'),
                'tags': ['大厂实习', p.get('BGName', '腾讯')], # BGName 是腾讯的事业群
                'sourceUrl': source_url,
                'isActive': True,
                'updatedAt': datetime.utcnow()
            })
    except Exception as e:
        print(f"❌ 腾讯接口抓取失败: {e}")
    return jobs

def main():
    print("🚀 启动 [实习信息+直达链接] 专项搜集器...")
    all_jobs = []
    
    # 获取腾讯真实数据
    all_jobs.extend(fetch_tencent_interns())
    
    if not all_jobs:
        print("⚠️ 未抓取到任何数据，请检查网络或接口是否变更。")
        return

    # 写入云端数据库
    print(f"📦 正在将 {len(all_jobs)} 条真实数据写入云端...")
    ops = [UpdateOne(
        {'company': j['company'], 'title': j['title']}, 
        {'$set': j, '$setOnInsert': {'createdAt': datetime.utcnow()}}, 
        upsert=True
    ) for j in all_jobs]
    
    try:
        db.jobs.bulk_write(ops, ordered=False)
        print(f"✅ 大功告成！成功搜集 {len(all_jobs)} 条真实实习信息，并附带官方直达链接。")
    except Exception as e:
        print(f"❌ 数据库写入失败: {e}")

if __name__ == '__main__':
    main()
