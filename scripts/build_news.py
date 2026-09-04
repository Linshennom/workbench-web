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
import json, subprocess, sys, os, re, html, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
GAME_SKILL = r"C:/Users/admin/.workbuddy/skills/gamenews__skillhub/scripts/fetch_news.py"

GAME_TAG = {
    '机核网 (Gcores)': '机核', '游研社 (Yystv)': '游研社', '触乐网 (Chuapp)': '触乐',
    '游戏大观 (GameLook)': 'GameLook', 'Indienova (独立游戏)': '独立', '游民星空 (Gamersky)': '游民',
    '3DMGame': '3DM', '游戏陀螺 (GameGyro)': '陀螺', 'IGN中国': 'IGN', 'GameRes游资网 (GameRes)': 'GameRes',
}

def short_date(pub):
    """把 RSS pubDate 转成 MM-DD 展示串"""
    if not pub:
        return ''
    m = re.search(r'(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})', pub)
    if m:
        months = {'Jan':'01','Feb':'02','Mar':'03','Apr':'04','May':'05','Jun':'06',
                  'Jul':'07','Aug':'08','Sep':'09','Oct':'10','Nov':'11','Dec':'12'}
        return f"{m.group(3)[2:]}-{months.get(m.group(2),'??')}-{int(m.group(1)):02d}"
    m2 = re.search(r'(\d{4}-\d{2}-\d{2})', pub)
    if m2:
        return m2.group(1)[2:]
    return pub[:10]

def build_game():
    out = subprocess.run([PY, GAME_SKILL, '--limit', '6', '--format', 'json'],
                         capture_output=True, text=True, encoding='utf-8')
    if out.returncode != 0:
        print('[game] fetch 失败:', out.stderr[:300], file=sys.stderr)
        return False
    raw = json.loads(out.stdout)
    items = []
    for plat in raw:
        tag = GAME_TAG.get(plat.get('source_name', ''), plat.get('source_name', '游戏'))
        for it in (plat.get('items') or []):
            title = (it.get('title') or '').strip()
            if not title:
                continue
            desc = re.sub(r'\s+', ' ', (it.get('description') or '')).strip()
            items.append({
                't': title,
                'd': desc,
                'tag': tag,
                'url': (it.get('link') or '').strip(),
                'heat': '',
                'time': short_date(it.get('date') or ''),
                'src': plat.get('source_name', '游戏媒体'),
            })
    # 去重（同一标题不同平台）
    seen, uniq = set(), []
    for x in items:
        k = x['t'][:40]
        if k in seen:
            continue
        seen.add(k); uniq.append(x)
    write_json('game_news.json', uniq)
    print(f'[game] 生成 {len(uniq)} 条')
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
