#!/usr/bin/env python3
import time
import random
import logging
import os
import argparse
import json
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017/interndash')
DB_NAME = os.getenv('DB_NAME', 'interndash')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}
REQUEST_DELAY = (1.5, 3.5)

# 🚀 【核心修改】极其庞大的白名单：只要包含以下任何一个词汇（无论是互联网还是硬科技），都放行！
VALID_JOB_SUFFIXES = (
    # 职位后缀
    '工程师', '研究员', '专员', '经理', '助理', '顾问', '管培生', '实习生', '代表', '专家', '生', '师', '员',
    # 互联网/软件
    '开发', '测试', '设计', '运营', '产品', '策划', '分析', '架构', '前端', '后端', '算法', '数据',
    # 硬科技/制造/新能源
    '芯片', '半导体', '材料', '电池', '动力', '新能源', '汽车', '车辆', '机械', '硬件', '电气', '工艺', '制造', '质量', '模组', '热管理',
    # 通用
    '实习', 'intern', '校招', '计划', '方向', '岗'
)

# 垃圾词汇黑名单（依然保持拦截废话）
NOISE_KEYWORDS = (
    '登录', '注册', '隐私', '条款', '帮助', '更多', '返回', '首页', '刷新', '下载',
    '搜索', '导航', '公告', 'copyright', 'cookie', '详情', '了解', '查看', 
    '关于我们', '校园招聘', '立即申请', '投递', '加入我们', '常见问题', '邮箱'
)

def fetch_page(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        return resp.text
    except requests.RequestException as e:
        logger.error('请求失败: %s — %s', url, e)
        return None

def fetch_page_dynamic(url: str, wait_ms: int = 3500) -> Optional[str]:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until='networkidle', timeout=30000) # 等待网络空闲
            page.wait_for_timeout(wait_ms)
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        logger.error('动态渲染失败: %s', e)
        return None

def _extract_location(text: str) -> str:
    loc_match = re.search(r'(北京|上海|深圳|广州|杭州|成都|武汉|西安|南京|苏州|合肥|宁德|东莞|无锡|远程)', text)
    return loc_match.group(1) if loc_match else '未知'

def _clean_text(value: object) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()

def normalize_title(title: str) -> str:
    t = _clean_text(title)
    t = re.sub(r'[\|\_]+', ' ', t)
    t = re.sub(r'\s+', ' ', t)
    return t[:35].strip()  # 放宽到 35 个字

def is_valid_job_title(title: str) -> bool:
    if not title or len(title) < 3: return False
    t = title.lower()
    
    # 碰到黑名单词汇直接扔掉
    if any(noise in t for noise in NOISE_KEYWORDS): return False
    
    # 只要包含广义的行业词汇，全部放行
    if not any(k in t for k in VALID_JOB_SUFFIXES): return False
    
    return True

def clean_jobs(jobs: list[dict]) -> list[dict]:
    cleaned = []
    seen = set()
    for job in jobs:
        title = normalize_title(str(job.get('title', '')))
        if not is_valid_job_title(title): continue
        company = _clean_text(job.get('company', '')) or '官方招聘'
        key = (company, title)
        if key in seen: continue
        seen.add(key)
        job['title'] = title
        job['company'] = company
        job['location'] = _extract_location(job.get('location', '') + ' ' + title)
        job['sourceUrl'] = _clean_text(job.get('sourceUrl', ''))
        job['tags'] = [t for t in job.get('tags', []) if _clean_text(t)] or ['官网抓取']
        cleaned.append(job)
    return cleaned

def parse_jobs_generic(soup: BeautifulSoup, base_url: str) -> list[dict]:
    jobs = []
    
    # 扩大搜索范围，捕获更多非 a 标签的元素
    for el in soup.select('a, li, div[class*="job"], div[class*="position"], div[class*="item"]'):
        text = ' '.join(el.stripped_strings)
        if len(text) < 4 or len(text) > 100: continue
        
        # 尝试提取标题
        title = text.split('\n')[0][:50]
        
        href = el.get('href', '') if el.name == 'a' else (el.find('a').get('href', '') if el.find('a') else '')
        source_url = urljoin(base_url, href) if href else base_url
        
        # 简单推断公司
        host = urlparse(base_url).netloc.lower()
        company = '科技企业'
        if 'bytedance' in host: company = '字节跳动'
        elif 'tencent' in host: company = '腾讯'
        elif 'alibaba' in host: company = '阿里巴巴'
        elif 'catl' in host: company = '宁德时代'
        elif 'dji' in host: company = '大疆'
        elif 'huawei' in host: company = '华为'
        elif 'smic' in host: company = '中芯国际'
        
        jobs.append({
            'company': company,
            'title': title,
            'location': _extract_location(text),
            'sourceUrl': source_url,
            'tags': ['自动抓取'],
            'isActive': True
        })
    return jobs

def parse_jobs_from_real_page(html: str, base_url: str) -> list[dict]:
    soup = BeautifulSoup(html, 'lxml')
    # 取消所有域名特定规则，直接用强大的通用正则洗版
    jobs = parse_jobs_generic(soup, base_url)
    cleaned = clean_jobs(jobs)
    logger.info('通用规则抓取到初筛节点: %d -> 清洗后得到有效岗位: %d', len(jobs), len(cleaned))
    return cleaned

def save_to_mongodb(jobs: list[dict]) -> None:
    if not jobs:
        logger.info('无岗位数据，跳过写入。')
        return
    client = MongoClient(MONGO_URI)
    col = client[DB_NAME]['jobs']
    now = datetime.utcnow()
    ops = [UpdateOne({'company': j['company'], 'title': j['title']}, {'$set': j, '$setOnInsert': {'createdAt': now}}, upsert=True) for j in jobs]
    try:
        res = col.bulk_write(ops, ordered=False)
        logger.info('写入完成 | 新增: %d  更新: %d  总操作: %d', res.upserted_count, res.modified_count, len(ops))
    except BulkWriteError as e:
        logger.error('批量写入错误: %s', e.details)
    finally:
        client.close()

def run_scraper(use_mock: bool = True, target_urls: Optional[list[str]] = None, use_dynamic: bool = False) -> int:
    env_urls = [u.strip() for u in os.getenv('SCRAPER_TARGET_URLS', '').split(',') if u.strip()]
    TARGET_URLS = target_urls or env_urls or []
    if not TARGET_URLS: return 0
    all_jobs = []
    for idx, url in enumerate(TARGET_URLS):
        logger.info('[%d/%d] 抓取: %s', idx + 1, len(TARGET_URLS), url)
        html = fetch_page_dynamic(url) if use_dynamic else fetch_page(url)
        if html: all_jobs.extend(parse_jobs_from_real_page(html, url))
        delay = random.uniform(*REQUEST_DELAY)
        logger.info('等待 %.1f 秒...', delay)
        time.sleep(delay)
    save_to_mongodb(all_jobs)
    logger.info('爬虫任务完成，共处理 %d 条岗位。', len(all_jobs))
    return len(all_jobs)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='InternDash 爬虫')
    parser.add_argument('--real', action='store_true')
    parser.add_argument('--dynamic', action='store_true')
    parser.add_argument('--url', action='append', default=[])
    args = parser.parse_args()
    run_scraper(use_mock=not args.real, target_urls=args.url, use_dynamic=args.dynamic)
