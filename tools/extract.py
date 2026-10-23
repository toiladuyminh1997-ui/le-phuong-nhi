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
    """Các ảnh đặt trên trang (bỏ ảnh nền cả trang, icon công cụ, ảnh quá nhỏ), theo thứ tự đọc: [(khung, xref)]."""
    W, H = page.rect.width, page.rect.height
    out, seen = [], set()
    for info in page.get_image_info(xrefs=True):
        x = info['xref']
        r = pymupdf.Rect(info['bbox']) & page.rect
        a = r.width * r.height
        if not x or x in seen or a > .55 * W * H or a < .012 * W * H:
            continue
        seen.add(x)
        out.append((r, x))
    half = W / 2
    out.sort(key=lambda t: (0 if (t[0].x0 + t[0].x1) / 2 < half else 1, round(t[0].y0 / 40), t[0].x0))
    return out


def raw_image(doc, xref):
    """Ảnh gốc nhúng trong PDF (đúng độ phân giải gốc, không dính chữ / ảnh bên cạnh); giữ nền trong suốt nếu có."""
    pix = pymupdf.Pixmap(doc, xref)
    if pix.colorspace and pix.colorspace.n > 3:      # CMYK -> RGB
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    smask = doc.extract_image(xref).get('smask')
    if smask:
        try:
            pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, smask))
        except Exception:
            pass
    mode = 'RGBA' if pix.alpha else 'RGB'
    im = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    if mode == 'RGBA' and min(im.getchannel('A').getextrema()) > 250:
        im = im.convert('RGB')
    return im


def useful(im):
    """Bỏ ảnh gần như một màu (nền, khối màu, mảng chữ trên nền trơn)."""
    import numpy as np
    g = np.asarray(im.convert('L').resize((48, 48)), 'f')
    return g.std() > 10 and min(im.size) >= 100


def main(pdf):
    os.makedirs(IMG, exist_ok=True)
    doc = pymupdf.open(pdf)
    pg = lambda n: doc[n - 1]
    # hình trang trí (sứa, tấm kính, nền nước) lặp lại trên nhiều trang -> không phải ảnh dự án
    from collections import Counter
    freq = Counter(x for p in doc for x in {i['xref'] for i in p.get_image_info(xrefs=True) if i['xref']})
    deco = {x for x, c in freq.items() if c >= 3}
    # hình có mặt ở trang không phải trang sản phẩm (bìa, bìa chương, trang thơ...) cũng là trang trí
    proj_pages = {n for sec in P['sections'] for pr in sec['projects'] for n in pr['pages']}
    for i, p in enumerate(doc):
        if i + 1 not in proj_pages:
            deco |= {inf['xref'] for inf in p.get_image_info(xrefs=True) if inf['xref']}
    data = {k: P[k] for k in ('name', 'alias', 'title', 'tagline', 'year', 'role', 'contact', 'experience', 'education', 'tools')}
    data['cover'] = save(render(pg(P['cover_page']), width=2000), 'cover')
    a = pg(P['about_page']); r = a.rect
    data['portrait'] = save(render(a, pymupdf.Rect(0, 0, r.width * .55, r.height), 1600), 'portrait')
    # nền trang About: ảnh nền trang 4 làm nhoè (giống nền nước của trang trong quyển)
    from PIL import ImageFilter
    bgx = max(a.get_image_info(xrefs=True), key=lambda i: i['width'] * i['height'])['xref']
    bg = raw_image(doc, bgx).convert('RGB')
    bg = bg.resize((960, round(bg.height * 960 / bg.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
    bg.save(os.path.join(IMG, 'about-bg.webp'), 'WEBP', quality=80)
    data['about_bg'] = 'img/about-bg.webp'
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
    # ảnh nhân vật chính ở trang đầu: tools/hero.py (img/hero.webp + img/hero-map.webp)
    data['sections'] = []
    for sec in P['sections']:
        S = {k: sec[k] for k in ('id', 'n', 'name', 'kind', 'color')}
        # bìa chương: chụp cả trang (kèm tên chương dạng chữ vector) đúng độ phân giải ảnh nền gốc, không phóng to
        cw = max(i['width'] for i in pg(sec['page']).get_image_info(xrefs=True))
        S['cover'] = save(render(pg(sec['page']), width=max(1400, cw)), f'sec-{sec["id"]}', ((2200, 'full'), (800, 'thumb')))
        S['projects'] = []
        for pr in sec['projects']:
            sl = slug(pr['title'])
            gal, used = [], set()
            for n in pr['pages']:
                for k, (box, xref) in enumerate(frames(pg(n))):
                    if xref in used or xref in deco or f'{n}-{k}' in pr.get('skip', ()):   # skip: hình trang trí chỉ riêng trang đó
                        continue
                    used.add(xref)
                    im = raw_image(doc, xref)
                    if useful(im):
                        gal.append(save(im, f'{sl}-{n}-{k}'))
            item = dict(pr, slug=sl, gallery=gal)
            item.pop('pages'); item.pop('skip', None)
            S['projects'].append(item)
            print(f'{sec["n"]:>4} {pr["title"]:32s} {len(gal):2d} ảnh')
        data['sections'].append(S)
    with open(os.path.join(ROOT, 'data.js'), 'w', encoding='utf8') as f:
        f.write('window.PORT = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    mb = sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG)) / 1e6
    print(f'xong: {len(os.listdir(IMG))} file ảnh, {mb:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
