#!/usr/bin/env python3
# scraper.py  —  InternDash 招聘信息爬虫示例
#
# ⚠️  合规提醒（重要，请务必阅读）:
#   1. 爬取前请仔细阅读目标网站的 robots.txt 和 ToS（用户协议）。
#   2. 控制请求频率（rate limit），避免对服务器造成过大压力。
#   3. 不要爬取、存储、传播用户隐私信息（如简历、联系方式）。
#   4. 仅供学习与个人使用，禁止商业化抓取。
#   5. 如目标网站明确禁止爬取，请通过官方开放 API 获取数据。
#
# 依赖安装：pip install requests beautifulsoup4 pymongo lxml

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

# ─── 日志配置 ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)

# ─── MongoDB 配置 ──────────────────────────────────────────
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017/interndash')
DB_NAME = os.getenv('DB_NAME', 'interndash')

# ─── 请求配置 ──────────────────────────────────────────────
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}
REQUEST_DELAY = (1.5, 3.5)   # 随机延迟区间（秒），请勿设置过小

# 岗位关键词（用于通用页面启发式过滤）
TITLE_HINTS = ('实习', 'intern', '校招', '应届', '招聘', '职位', '开发', '算法', '产品', '运营', '设计', '测试', '数据')
COMPANY_HINTS = ('字节', '腾讯', '阿里', '百度', '美团', '京东', '华为', '小米', '滴滴', '网易', '公司')
INTERN_KEYWORDS = ('实习', 'intern', '校招', '应届')
ROLE_KEYWORDS = ('开发', '前端', '后端', '算法', '数据', '产品', '运营', '设计', '测试', '安全', '分析')
NOISE_KEYWORDS = (
    '登录', '注册', '隐私', '条款', '帮助', '更多', '返回', '首页', '刷新', '下载',
    '搜索', '导航', '公告', 'copyright', 'cookie',
)


# ─── 模拟目标页面（本地 HTML 字符串，实际替换为真实 URL）────
MOCK_HTML = """
<html>
<body>
  <ul class="job-list">
    <li class="job-item">
      <span class="company">字节跳动</span>
      <span class="title">前端开发实习生</span>
      <span class="location">北京</span>
      <span class="deadline">2025-08-31</span>
      <span class="tags">前端,React,实习</span>
      <a class="detail-link" href="https://example.com/job/1">查看详情</a>
    </li>
    <li class="job-item">
      <span class="company">阿里巴巴</span>
      <span class="title">后端工程师实习</span>
      <span class="location">杭州</span>
      <span class="deadline">2025-09-15</span>
      <span class="tags">Java,SpringBoot,后端</span>
      <a class="detail-link" href="https://example.com/job/2">查看详情</a>
    </li>
    <li class="job-item">
      <span class="company">腾讯</span>
      <span class="title">数据分析实习生</span>
      <span class="location">深圳</span>
      <span class="deadline">2025-08-20</span>
      <span class="tags">Python,SQL,数据分析</span>
      <a class="detail-link" href="https://example.com/job/3">查看详情</a>
    </li>
  </ul>
</body>
</html>
"""


def fetch_page(url: str) -> Optional[str]:
    """
    发起 HTTP 请求，返回 HTML 字符串。
    如需处理动态渲染（JavaScript），请改用 Playwright：
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url)
            html = page.content()
            browser.close()
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        return resp.text
    except requests.RequestException as e:
        logger.error('请求失败: %s — %s', url, e)
        return None


def fetch_page_dynamic(url: str, wait_ms: int = 2500) -> Optional[str]:
    """使用 Playwright 获取动态渲染后的 HTML。"""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.error('未安装 playwright，请先执行: python3 -m pip install playwright && python3 -m playwright install chromium')
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(wait_ms)
            html = page.content()
            browser.close()
            return html
    except Exception as e:  # noqa: BLE001
        logger.error('动态渲染失败: %s — %s', url, e)
        return None


def parse_jobs_jsonld(soup: BeautifulSoup, base_url: str) -> list[dict]:
    jobs = []
    scripts = soup.find_all('script', {'type': 'application/ld+json'})
    for sc in scripts:
        raw = sc.string or sc.get_text()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            if node.get('@type') in ('JobPosting', 'Posting'):
                title = str(node.get('title', '')).strip()
                company_obj = node.get('hiringOrganization', {})
                company = ''
                if isinstance(company_obj, dict):
                    company = str(company_obj.get('name', '')).strip()
                location_obj = node.get('jobLocation', {})
                location = ''
                if isinstance(location_obj, dict):
                    addr = location_obj.get('address', {})
                    if isinstance(addr, dict):
                        city = addr.get('addressLocality', '') or ''
                        region = addr.get('addressRegion', '') or ''
                        location = f'{city}{region}'.strip() or '未知'

                source_url = node.get('url') or base_url
                source_url = urljoin(base_url, str(source_url))
                if title:
                    jobs.append({
                        'company': company or '官方招聘',
                        'title': title,
                        'location': location or '未知',
                        'tags': ['官网抓取'],
                        'sourceUrl': source_url,
                        'isActive': True,
                    })
    return jobs


def _extract_location(text: str) -> str:
    loc_match = re.search(r'(北京|上海|深圳|广州|杭州|成都|武汉|西安|南京|苏州|远程)', text)
    return loc_match.group(1) if loc_match else '未知'


def _clean_text(value: object) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def _build_job(company: str, title: str, location: str, source_url: str, tags: Optional[list[str]] = None) -> dict:
    return {
        'company': _clean_text(company) or '官方招聘',
        'title': _clean_text(title),
        'location': _clean_text(location) or '未知',
        'tags': tags or ['官网抓取'],
        'sourceUrl': source_url,
        'isActive': True,
    }


def normalize_title(title: str) -> str:
    t = _clean_text(title)
    t = re.sub(r'[\|\-_/]+', ' ', t)
    t = re.sub(r'\s+', ' ', t)
    # 截断到更像职位名的长度
    return t[:40].strip()


def is_valid_job_title(title: str) -> bool:
    if not title:
        return False
    t = title.lower()
    if len(title) < 4:
        return False
    if any(noise in t for noise in NOISE_KEYWORDS):
        return False
    if not any(k in t for k in INTERN_KEYWORDS):
        return False
    if not any(k in t for k in ROLE_KEYWORDS):
        return False
    # 过滤明显整段文案
    if len(title) > 40:
        return False
    return True


def clean_jobs(jobs: list[dict]) -> list[dict]:
    cleaned = []
    seen = set()
    for job in jobs:
        title = normalize_title(str(job.get('title', '')))
        if not is_valid_job_title(title):
            continue
        company = _clean_text(job.get('company', '')) or '官方招聘'
        key = (company, title)
        if key in seen:
            continue
        seen.add(key)
        job['title'] = title
        job['company'] = company
        job['location'] = _clean_text(job.get('location', '')) or '未知'
        job['sourceUrl'] = _clean_text(job.get('sourceUrl', ''))
        job['tags'] = [t for t in job.get('tags', []) if _clean_text(t)]
        if not job['tags']:
            job['tags'] = ['官网抓取']
        cleaned.append(job)
    return cleaned


def parse_jobs_bytedance(soup: BeautifulSoup, base_url: str) -> list[dict]:
    jobs = []
    seen = set()

    # 常见节点：卡片/列表文本中含职位名称，可点击进入详情页
    for el in soup.select('a[href*="job"], a[href*="position"], a[href*="detail"], [class*="job"], [class*="position"]'):
        text = _clean_text(' '.join(el.stripped_strings))
        if not text:
            continue
        if '实习' not in text and 'intern' not in text.lower():
            continue
        title = text[:90]
        if len(title) < 4 or title in seen:
            continue
        seen.add(title)

        href = el.get('href', '') if hasattr(el, 'get') else ''
        source_url = urljoin(base_url, href) if href else base_url
        jobs.append(_build_job('字节跳动', title, _extract_location(text), source_url, ['字节', '实习']))
        if len(jobs) >= 200:
            break
    return jobs


def parse_jobs_tencent(soup: BeautifulSoup, base_url: str) -> list[dict]:
    jobs = []
    seen = set()
    for el in soup.select('a[href*="position"], a[href*="job"], tr, li, [class*="post"]'):
        text = _clean_text(' '.join(el.stripped_strings))
        if not text:
            continue
        low = text.lower()
        if '实习' not in text and 'intern' not in low and '校招' not in text:
            continue
        title = text[:90]
        if len(title) < 4 or title in seen:
            continue
        seen.add(title)
        href = ''
        if hasattr(el, 'get'):
            href = el.get('href', '')
        if not href:
            a = el.find('a')
            if a:
                href = a.get('href', '')
        source_url = urljoin(base_url, href) if href else base_url
        jobs.append(_build_job('腾讯', title, _extract_location(text), source_url, ['腾讯', '实习']))
        if len(jobs) >= 200:
            break
    return jobs


def parse_jobs_alibaba(soup: BeautifulSoup, base_url: str) -> list[dict]:
    jobs = []
    seen = set()
    for el in soup.select('a[href*="job"], a[href*="position"], li, [class*="position"], [class*="job"]'):
        text = _clean_text(' '.join(el.stripped_strings))
        if not text:
            continue
        low = text.lower()
        if '实习' not in text and 'intern' not in low and '校园' not in text:
            continue
        title = text[:90]
        if len(title) < 4 or title in seen:
            continue
        seen.add(title)
        href = ''
        if hasattr(el, 'get'):
            href = el.get('href', '')
        if not href:
            a = el.find('a')
            if a:
                href = a.get('href', '')
        source_url = urljoin(base_url, href) if href else base_url
        jobs.append(_build_job('阿里巴巴', title, _extract_location(text), source_url, ['阿里', '实习']))
        if len(jobs) >= 200:
            break
    return jobs


def parse_jobs_by_domain(soup: BeautifulSoup, base_url: str) -> list[dict]:
    host = urlparse(base_url).netloc.lower()
    if 'bytedance.com' in host or 'toutiao.com' in host:
        return parse_jobs_bytedance(soup, base_url)
    if 'tencent.com' in host:
        return parse_jobs_tencent(soup, base_url)
    if 'alibaba.com' in host or 'aliyun.com' in host or 'taotian.com' in host:
        return parse_jobs_alibaba(soup, base_url)
    return []


def parse_jobs_generic(soup: BeautifulSoup, base_url: str) -> list[dict]:
    jobs = []
    seen = set()
    candidates = soup.select('a, li, article, div')
    for el in candidates:
        text = ' '.join(el.stripped_strings)
        if len(text) < 6:
            continue
        low = text.lower()
        if not any(k in low for k in TITLE_HINTS):
            continue

        title = text[:80]
        if title in seen:
            continue
        seen.add(title)

        href = ''
        if el.name == 'a':
            href = el.get('href', '')
        else:
            a = el.find('a')
            if a:
                href = a.get('href', '')
        source_url = urljoin(base_url, href) if href else base_url

        company = '官方招聘'
        for hint in COMPANY_HINTS:
            if hint in text:
                company = hint
                break

        location = _extract_location(text)
        jobs.append(_build_job(company, title, location, source_url, ['官网抓取']))
        if len(jobs) >= 200:
            break
    return jobs


def parse_jobs(html: str) -> list[dict]:
    """解析 HTML，返回岗位字典列表。"""
    soup = BeautifulSoup(html, 'lxml')
    items = soup.select('.job-item')
    jobs = []

    for item in items:
        def text(selector: str) -> str:
            el = item.select_one(selector)
            return el.get_text(strip=True) if el else ''

        raw_tags     = text('.tags')
        raw_deadline = text('.deadline')
        source_url   = item.select_one('.detail-link')

        job = {
            'company':   text('.company'),
            'title':     text('.title'),
            'location':  text('.location'),
            'tags':      [t.strip() for t in raw_tags.split(',') if t.strip()],
            'sourceUrl': source_url['href'] if source_url else '',
            'isActive':  True,
        }

        # 安全解析日期
        if raw_deadline:
            try:
                job['deadline'] = datetime.strptime(raw_deadline, '%Y-%m-%d')
            except ValueError:
                logger.warning('日期格式异常，跳过: %s', raw_deadline)

        # 过滤无效记录
        if job['company'] and job['title']:
            jobs.append(job)
            logger.info('解析到岗位: %s — %s @ %s', job['company'], job['title'], job['location'])

    return jobs


def parse_jobs_from_real_page(html: str, base_url: str) -> list[dict]:
    soup = BeautifulSoup(html, 'lxml')
    jobs = parse_jobs_by_domain(soup, base_url)
    if jobs:
        cleaned = clean_jobs(jobs)
        logger.info('站点专用规则解析到岗位: %d -> 清洗后: %d', len(jobs), len(cleaned))
        return cleaned

    jobs = parse_jobs_jsonld(soup, base_url)
    if jobs:
        cleaned = clean_jobs(jobs)
        logger.info('JSON-LD 解析到岗位: %d -> 清洗后: %d', len(jobs), len(cleaned))
        return cleaned

    jobs = parse_jobs_generic(soup, base_url)
    cleaned = clean_jobs(jobs)
    logger.info('通用规则解析到岗位: %d -> 清洗后: %d', len(jobs), len(cleaned))
    return cleaned


def save_to_mongodb(jobs: list[dict]) -> None:
    """
    批量 upsert 到 MongoDB jobs 集合。
    以 (company + title) 作为唯一键，避免重复插入。
    """
    if not jobs:
        logger.info('无岗位数据，跳过写入。')
        return

    client = MongoClient(MONGO_URI)
    db     = client[DB_NAME]
    col    = db['jobs']

    now = datetime.utcnow()
    operations = []
    for job in jobs:
        job['updatedAt'] = now
        operations.append(
            UpdateOne(
                {'company': job['company'], 'title': job['title']},
                {'$set': job, '$setOnInsert': {'createdAt': now}},
                upsert=True,
            )
        )

    try:
        result = col.bulk_write(operations, ordered=False)
        logger.info(
            '写入完成 | 新增: %d  更新: %d  总操作: %d',
            result.upserted_count, result.modified_count, len(operations),
        )
    except BulkWriteError as e:
        logger.error('批量写入错误: %s', e.details)
    finally:
        client.close()


def run_scraper(
    use_mock: bool = True,
    target_urls: Optional[list[str]] = None,
    use_dynamic: bool = False,
) -> int:
    """
    主爬虫流程。
    use_mock=True  → 使用本地模拟 HTML（测试用）
    use_mock=False → 替换 TARGET_URLS 为真实 URL 列表
    """
    env_urls = [u.strip() for u in os.getenv('SCRAPER_TARGET_URLS', '').split(',') if u.strip()]
    TARGET_URLS = target_urls or env_urls or []

    if use_mock:
        logger.info('>>> 使用模拟 HTML 进行测试 <<<')
        jobs = parse_jobs(MOCK_HTML)
        save_to_mongodb(jobs)
        return len(jobs)

    if not TARGET_URLS:
        logger.error('未提供真实抓取 URL。请通过 --url 传入，或设置环境变量 SCRAPER_TARGET_URLS。')
        return 0

    all_jobs = []
    for idx, url in enumerate(TARGET_URLS):
        logger.info('[%d/%d] 抓取: %s', idx + 1, len(TARGET_URLS), url)
        html = fetch_page_dynamic(url) if use_dynamic else fetch_page(url)
        if html:
            all_jobs.extend(parse_jobs_from_real_page(html, url))

        # 随机延迟，模拟人工浏览行为
        delay = random.uniform(*REQUEST_DELAY)
        logger.info('等待 %.1f 秒...', delay)
        time.sleep(delay)

    save_to_mongodb(all_jobs)
    logger.info('爬虫任务完成，共处理 %d 条岗位。', len(all_jobs))
    return len(all_jobs)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='InternDash 爬虫')
    parser.add_argument('--real', action='store_true', help='启用真实网址抓取（默认使用内置 mock）')
    parser.add_argument('--dynamic', action='store_true', help='启用 Playwright 动态渲染抓取')
    parser.add_argument('--loop', action='store_true', help='持续循环抓取')
    parser.add_argument('--interval', type=int, default=30, help='循环抓取间隔（分钟），默认30')
    parser.add_argument('--url', action='append', default=[], help='抓取网址，可重复传入多次')
    args = parser.parse_args()

    if args.loop and not args.real:
        logger.error('--loop 仅支持真实抓取模式，请加 --real')
        raise SystemExit(1)

    if args.loop:
        logger.info('启动循环抓取模式，间隔 %d 分钟', args.interval)
        while True:
            count = run_scraper(use_mock=False, target_urls=args.url, use_dynamic=args.dynamic)
            logger.info('本轮完成，写入/更新岗位数: %d', count)
            logger.info('等待 %d 分钟后进行下一轮...', args.interval)
            time.sleep(max(args.interval, 1) * 60)
    else:
        run_scraper(use_mock=not args.real, target_urls=args.url, use_dynamic=args.dynamic)
