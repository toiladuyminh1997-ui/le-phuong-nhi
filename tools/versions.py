"""Lưu các phiên bản cũ của trang + trang danh sách phiên bản (có ảnh chụp từng bản).

    python tools/versions.py            # dựng lại versions/vN từ git + chụp ảnh + phien-ban.html
    (cần server: python -m http.server 8770 trong thư mục gốc, để chụp ảnh)

Mỗi phiên bản = một commit trong VERSIONS -> versions/vN/ (trang chạy độc lập, có link riêng);
ảnh chụp ở versions/thumbs/. Khi đăng bản mới: thêm một dòng vào VERSIONS rồi chạy lại.
"""
import io, os, subprocess, tarfile, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GIT = r'C:\Program Files\Git\cmd\git.exe'
BASE = 'http://localhost:8770'

# (tên, commit, tiêu đề, mô tả ngắn)
VERSIONS = [
    ('v1', 'c47be89', 'Bản thử đầu tiên', 'Cột xương sống thủy tinh và đàn sứa vẽ bằng code; 32 dự án là các tấm kính xoắn ốc, chưa có ảnh.'),
    ('v2', '5d54636', 'Thêm ảnh dự án', 'Ảnh gốc của 32 dự án lấy từ PDF; đổi chữ có dấu sang Noto Serif Display.'),
    ('v3', '06a9c0a', 'Sửa bìa chương', 'Bìa từng phần hiện đủ tên; tấm kính vừa màn hình điện thoại.'),
    ('v4', '93337fc', 'Người hoá sứa + 5 chương', 'Nhân vật chính là ảnh người hoá sứa dựng 2.5D; vòng quay chỉ còn 5 chương, bấm chương ra lưới sản phẩm.'),
    ('v5', '95a9296', 'PDF cập nhật · cảnh trang Mục lục', 'Bìa Chương V ôm cá sư tử, thêm 3 dự án Chương IV; nền trang đầu là cảnh người đi trên mặt nước.'),
    ('v6', '34b9616', 'Người hoá sứa nét hơn', 'Trở lại người hoá sứa, tăng độ phân giải x2 bằng AI; sứa và voan cuốn lượn quanh người.'),
    ('v7', 'f43e12a', 'About theo trang trong quyển', 'Trang About dựng như trang giới thiệu trong quyển; ảnh, tên, hai ô kính hiện ra lần lượt.'),
]
FILES = ['index.html', 'style.css', 'app.js', 'data.js', 'img', 'vendor']


def export(name, sha):
    out = os.path.join(ROOT, 'versions', name)
    if os.path.exists(os.path.join(out, 'index.html')):
        return out
    os.makedirs(out, exist_ok=True)
    tar = subprocess.run([GIT, 'archive', '--format=tar', sha, '--', *FILES], cwd=ROOT, capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        t.extractall(out, filter='data')
    return out


def shots(name):
    from playwright.sync_api import sync_playwright
    th = os.path.join(ROOT, 'versions', 'thumbs')
    os.makedirs(th, exist_ok=True)
    targets = {'home': '', 'work': '#/work'}
    if all(os.path.exists(os.path.join(th, f'{name}-{k}.webp')) for k in targets):
        return
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for k, h in targets.items():
            pg = b.new_page(viewport=dict(width=1440, height=900))
            pg.goto(f'{BASE}/versions/{name}/{h}')
            pg.wait_for_timeout(9000)
            png = pg.screenshot()
            pg.close()
            Image.open(io.BytesIO(png)).convert('RGB').resize((720, 450), Image.LANCZOS).save(
                os.path.join(th, f'{name}-{k}.webp'), 'WEBP', quality=80)
        b.close()


def page():
    rows = []
    for i, (name, sha, title, desc) in enumerate(reversed(VERSIONS)):
        now = i == 0
        rows.append(f'''<li class="{'now' if now else ''}">
  <div class="meta"><span class="v">{name}</span><h2>{title}{' <em>hiện tại</em>' if now else ''}</h2><p>{desc}</p>
    <a class="btn" href="{'./' if now else f'versions/{name}/'}">Mở bản này →</a></div>
  <div class="thumbs">
    <a href="{'./' if now else f'versions/{name}/'}"><img src="versions/thumbs/{name}-home.webp" alt="{name} — trang đầu" loading="lazy" width="720" height="450"><span>Trang đầu</span></a>
    <a href="{'./#/work' if now else f'versions/{name}/#/work'}"><img src="versions/thumbs/{name}-work.webp" alt="{name} — dự án" loading="lazy" width="720" height="450"><span>Dự án</span></a>
  </div>
</li>''')
    html = f'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Các phiên bản — Lê Phương Nhi Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Display:ital,wght@0,300;1,300&family=Exo+2:wght@300;400;500&display=swap&subset=vietnamese">
<style>
  :root {{ --bg: #03101f; --fg: #e3f1ff; --muted: rgba(214, 233, 255, .6); --line: rgba(170, 215, 255, .2); --accent: #9fd8ff; }}
  * {{ box-sizing: border-box; }}
  html {{ background: var(--bg); }}
  body {{ margin: 0; min-height: 100vh; background: radial-gradient(120% 900px at 50% 0%, #0b2b52, var(--bg) 70%) no-repeat; color: var(--fg); font: 300 15px/1.6 "Exo 2", system-ui, sans-serif; }}
  main {{ max-width: 1180px; margin: 0 auto; padding: 9vh 16px 12vh; }}
  .top {{ display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 6vh; }}
  h1 {{ margin: 0; font: italic 300 clamp(2.6rem, 6vw, 4.4rem)/1 "Noto Serif Display", serif; }}
  .top a {{ color: var(--accent); text-decoration: none; letter-spacing: .14em; text-transform: uppercase; font-size: .78rem; }}
  ol {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 28px; }}
  li {{ display: grid; grid-template-columns: minmax(240px, 1fr) 2fr; gap: 28px; padding: 26px; border: 1px solid var(--line); border-radius: 18px 18px 48px 18px; background: rgba(8, 26, 48, .45); }}
  li.now {{ border-color: rgba(159, 216, 255, .5); box-shadow: 0 20px 60px -30px rgba(120, 190, 255, .5); }}
  .v {{ font: italic 300 2.4rem/1 "Noto Serif Display", serif; color: var(--accent); }}
  h2 {{ margin: 10px 0 8px; font-weight: 400; font-size: 1.15rem; }}
  h2 em {{ font-style: normal; font-size: .62rem; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; vertical-align: middle; }}
  p {{ margin: 0 0 18px; color: var(--muted); }}
  .btn {{ display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border: 1px solid var(--line); border-radius: 999px; color: var(--fg); text-decoration: none; font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; }}
  .btn:hover {{ border-color: var(--accent); color: var(--accent); }}
  .thumbs {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
  .thumbs a {{ position: relative; display: block; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }}
  .thumbs img {{ display: block; width: 100%; height: auto; transition: transform 1s cubic-bezier(.2,.7,.2,1); }}
  .thumbs a:hover img {{ transform: scale(1.04); }}
  .thumbs span {{ position: absolute; left: 10px; bottom: 8px; font-size: .64rem; letter-spacing: .2em; text-transform: uppercase; background: rgba(3, 16, 31, .7); padding: 3px 8px; border-radius: 999px; }}
  @media (max-width: 760px) {{ li {{ grid-template-columns: 1fr; padding: 18px; }} }}
</style>
</head>
<body>
<main>
  <div class="top"><h1>Các phiên bản</h1><a href="./">← Về trang portfolio</a></div>
  <ol>
{chr(10).join(rows)}
  </ol>
</main>
</body>
</html>
'''
    open(os.path.join(ROOT, 'phien-ban.html'), 'w', encoding='utf8').write(html)


def main():
    for name, sha, *_ in VERSIONS:
        export(name, sha)
        shots(name)
        print(name, 'ok')
    page()
    print('-> phien-ban.html')


if __name__ == '__main__':
    main()
