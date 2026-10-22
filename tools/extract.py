"""Tách ảnh từ PORT26.pdf cho trang portfolio Lê Phương Nhi.

    python tools/extract.py "đường/dẫn/PORT26.pdf"

Tạo img/ (ảnh dự án, ảnh bìa từng phần, trang truyện, ảnh nhân vật giữa cảnh) và data.js.
Ảnh dự án = vùng từng khung ảnh trên trang (đúng như bản dàn), xếp theo thứ tự đọc trên trang.
"""
import json, os, re, sys, unicodedata
import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMG = os.path.join(ROOT, 'img')
P = json.load(open(os.path.join(HERE, 'projects.json'), encoding='utf8'))


def slug(s):
    s = unicodedata.normalize('NFD', s.replace('đ', 'd').replace('Đ', 'D'))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def save(pix_img, name, widths=((1800, 'full'), (720, 'thumb'))):
    out = {}
    for w, tag in widths:
        im = pix_img if pix_img.width <= w else pix_img.resize((w, round(pix_img.height * w / pix_img.width)), Image.LANCZOS)
        fn = f'{name}-{tag}.webp'
        im.save(os.path.join(IMG, fn), 'WEBP', quality=84 if tag != 'thumb' else 76, method=5)
        out[tag] = 'img/' + fn
    out['w'], out['h'] = pix_img.width, pix_img.height
    return out


def render(page, clip=None, width=1800):
    r = clip or page.rect
    z = min(4, width / r.width)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=r, alpha=False)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)


def frames(page):
    """Các khung ảnh trên trang (bỏ ảnh nền cả trang, icon công cụ, ảnh quá nhỏ), theo thứ tự đọc."""
    W, H = page.rect.width, page.rect.height
    boxes = []
    for info in page.get_image_info(xrefs=True):
        r = pymupdf.Rect(info['bbox']) & page.rect
        a = r.width * r.height
        if a > .55 * W * H or a < .012 * W * H:
            continue
        if any((r & b).get_area() > .6 * min(a, b.get_area()) for b in boxes):
            continue
        boxes.append(r)
    half = W / 2
    boxes.sort(key=lambda r: (0 if (r.x0 + r.x1) / 2 < half else 1, round(r.y0 / 40), r.x0))
    return boxes


def main(pdf):
    os.makedirs(IMG, exist_ok=True)
    doc = pymupdf.open(pdf)
    pg = lambda n: doc[n - 1]
    data = {k: P[k] for k in ('name', 'alias', 'title', 'tagline', 'year', 'role', 'contact', 'experience', 'education', 'tools')}
    data['cover'] = save(render(pg(P['cover_page']), width=2000), 'cover')
    a = pg(P['about_page']); r = a.rect
    data['portrait'] = save(render(a, pymupdf.Rect(0, 0, r.width * .55, r.height), 1600), 'portrait')
    t = pg(P['thanks_page']); r = t.rect
    data['thanks'] = save(render(t, pymupdf.Rect(r.width * .5, 0, r.width, r.height), 1600), 'thanks')
    data['story'] = []
    for s in P['story']:
        p = pg(s['page']); r = p.rect
        # nửa trang có ảnh (nửa kia là nền mờ + chữ): chọn nửa có độ tương phản cao hơn
        halves = [pymupdf.Rect(0, 0, r.width / 2, r.height), pymupdf.Rect(r.width / 2, 0, r.width, r.height)]
        ims = [render(p, h, 1400) for h in halves]
        im = max(ims, key=lambda i: __import__('numpy').asarray(i.convert('L').resize((64, 64)), 'f').std())
        data['story'].append({'quote': s['quote'], 'img': save(im, f'story-{s["page"]}', ((1400, 'full'), (600, 'thumb')))})
    # nhân vật giữa cảnh: người áo trắng bay trong nước (trang 3), cắt vùng nhân vật
    p3 = pg(3); r = p3.rect
    hero = render(p3, pymupdf.Rect(r.width * .6, r.height * .12, r.width * .92, r.height * .92), 1200)
    hero.save(os.path.join(IMG, 'hero.webp'), 'WEBP', quality=90)
    data['hero'] = 'img/hero.webp'
    data['sections'] = []
    for sec in P['sections']:
        S = {k: sec[k] for k in ('id', 'n', 'name', 'kind', 'color')}
        S['cover'] = save(render(pg(sec['page']), width=2200), f'sec-{sec["id"]}', ((2200, 'full'), (800, 'thumb')))
        S['projects'] = []
        for pr in sec['projects']:
            sl = slug(pr['title'])
            gal = []
            for n in pr['pages']:
                for k, box in enumerate(frames(pg(n))):
                    gal.append(save(render(pg(n), box, 1800), f'{sl}-{n}-{k}'))
            item = dict(pr, slug=sl, gallery=gal)
            item.pop('pages')
            S['projects'].append(item)
            print(f'{sec["n"]:>4} {pr["title"]:32s} {len(gal):2d} ảnh')
        data['sections'].append(S)
    with open(os.path.join(ROOT, 'data.js'), 'w', encoding='utf8') as f:
        f.write('window.PORT = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    mb = sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG)) / 1e6
    print(f'xong: {len(os.listdir(IMG))} file ảnh, {mb:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
