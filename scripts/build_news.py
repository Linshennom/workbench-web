#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「财经资讯 / 游戏资讯」两个本地快照，供 PWA 在同域下直接加载。

- 游戏：调用 gamenews 技能脚本（RSS 聚合，无需 key）
- 财经：调用 akshare.stock_news_em（需先 pip install akshare）

输出：
  data/game_news.json    { generatedAt, items:[{t,d,tag,url,heat,time,src}] }
  data/finance_news.json { generatedAt, items:[...] }

items 字段与 app.js 中 NewsCategories 的归一化结构一致，
app 端用 src:'local' 加载，无需 CORS。
"""
import json, sys, os, re, html, datetime, time
import feedparser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ===== 游戏资讯来源（用户指定 2026-09-08，替换旧的 gamenews 技能来源） =====
# 海外一手快讯：直接订阅 RSS Feed，Feed 自带发布时间，天然按时间倒序
GAME_RSS = [
    ('VGC',            'https://www.videogameschronicle.com/feed/'),
    ('Insider Gaming', 'https://insider-gaming.com/feed/'),
    ('Eurogamer',      'https://www.eurogamer.net/feed'),
]
# 国内快讯站（VGTIME 游戏时光 / 小黑盒 / TapTap）：均为 SPA，或服务端首页仅展示精选旧内容，
# 无法在本环境稳定直抓，已交由 app 内「AI 实时检索」覆盖（app.js game.sources 已配置这 6 家）。

def short_date(dtstr):
    """把 'YYYY-MM-DD HH:MM' 或 'YYYY-MM-DD' 转成 'YY-MM-DD [HH:MM]' 展示串"""
    if not dtstr:
        return ''
    m = re.search(r'(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?', dtstr)
    if not m:
        return dtstr[:10]
    return (m.group(1)[2:] + (' ' + m.group(2) if m.group(2) else ''))

def _ts(parsed):
    """feedparser parsed time -> 'YYYY-MM-DD HH:MM' 或 ''"""
    if not parsed:
        return ''
    try:
        return time.strftime('%Y-%m-%d %H:%M', parsed)
    except Exception:
        return ''

def build_game():
    items = []
    # 海外一手快讯：直接订阅 RSS Feed（自带发布时间，天然按时间倒序）
    for name, url in GAME_RSS:
        try:
            d = feedparser.parse(url)
            for e in d.entries[:10]:
                title = (e.get('title') or '').strip()
                if not title:
                    continue
                ts = _ts(e.get('published_parsed') or e.get('updated_parsed'))
                summ = re.sub(r'<[^>]+>', '', e.get('summary', '') or '')
                summ = html.unescape(re.sub(r'\s+', ' ', summ)).strip()[:140]
                link = (e.get('link') or '').strip()
                items.append({
                    't': title, 'd': summ, 'tag': name, 'url': link, 'heat': '',
                    'time': short_date(ts), 'src': name, '_ts': ts or '0000',
                })
        except Exception as ex:
            print('[game] RSS 失败(%s):' % name, str(ex)[:160], file=sys.stderr)
    # 排序（时间倒序）+ 去重
    items.sort(key=lambda x: x.get('_ts', '0000'), reverse=True)
    seen, uniq = set(), []
    for x in items:
        k = x['t'][:40]
        if k in seen:
            continue
        seen.add(k)
        uniq.append({kk: vv for kk, vv in x.items() if kk != '_ts'})
    write_json('game_news.json', uniq)
    print('[game] 生成 %d 条（VGC / Insider Gaming / Eurogamer RSS）' % len(uniq))
    print('[game] 注：国内站 VGTIME 游戏时光 / 小黑盒 / TapTap 为 SPA，服务端无法直抓，'
          '已交由 app 内「AI 实时检索」覆盖（game.sources 已配置这 6 家）')
    return True

def _clean_title(t):
    t = re.sub(r'\d{6}\.(SZ|SH|BJ|BJ)\)', '', t)   # 去掉 000001.SZ) 这类代码噪点
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def build_finance():
    try:
        import akshare as ak
        import warnings
        warnings.filterwarnings('ignore')
    except Exception as e:
        print('[finance] akshare 不可用:', e, file=sys.stderr)
        return False
    items = []

    # 1) 大盘指数快照（来自新浪实时行情）
    try:
        spot = ak.stock_zh_index_spot_sina()
        want = ['上证指数', '深证成指', '创业板指', '科创50', '沪深300', '恒生指数', '纳斯达克']
        for name in want:
            row = spot[spot['名称'] == name]
            if row.empty:
                continue
            r = row.iloc[0]
            price = r.get('最新价', '')
            chg = r.get('涨跌幅', '')
            chg_s = f"{chg:+.2f}%" if isinstance(chg, (int, float)) else str(chg)
            items.append({
                't': f'{name} {price}（{chg_s}）',
                'd': '大盘实时行情快照，点击查看来源。',
                'tag': '市场',
                'url': 'https://finance.sina.com.cn/realstock/company/sh000001/nc.shtml',
                'heat': '',
                'time': '实时',
                'src': '新浪财经',
            })
    except Exception as e:
        print('[finance] 指数快照失败:', e, file=sys.stderr)

    # 2) 多只代表性标的的新闻合并（更丰富、去重）
    syms = ['000001', '000300', '600519', '300750', '399006', '000858']
    seen = set()
    try:
        for s in syms:
            try:
                df = ak.stock_news_em(symbol=s)
            except Exception:
                continue
            for _, row in df.head(5).iterrows():
                title = _clean_title(str(row.get('新闻标题', '') or ''))
                if not title or title in seen:
                    continue
                seen.add(title)
                summary = re.sub(r'\s+', ' ', html.unescape(str(row.get('新闻内容', '') or ''))).strip()[:150]
                items.append({
                    't': title,
                    'd': summary,
                    'tag': '要闻',
                    'url': str(row.get('新闻链接', '') or '').strip(),
                    'heat': '',
                    'time': str(row.get('发布时间', '') or '')[:10],
                    'src': '东方财富',
                })
    except Exception as e:
        print('[finance] 新闻合并失败:', e, file=sys.stderr)

    if not items:
        print('[finance] 未获取到任何数据', file=sys.stderr)
        return False
    write_json('finance_news.json', items)
    print(f'[finance] 生成 {len(items)} 条（市场 + 要闻）')
    return True

def write_json(name, items):
    path = os.path.join(ROOT, 'data', name)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
                   'items': items}, f, ensure_ascii=False, indent=1)

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('all', 'game'):
        build_game()
    if which in ('all', 'finance'):
        build_finance()
