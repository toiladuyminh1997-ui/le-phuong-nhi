"""Nhân vật chính ở trang đầu: người hoá sứa — trang 4 của PORT26.pdf (trang 6 theo số trang sách in).

    python tools/hero.py PORT26.pdf

img/hero.webp       ảnh màu, đã tăng độ phân giải x2 bằng Swin2SR (ảnh nhúng trong PDF chỉ ~800px)
img/hero-map.webp   bản đồ RGBA:
                    R = độ gần (Depth Anything V2)
                    G = vùng nhân vật (người + con sứa + voan; nền nước trong ảnh tan vào nền trang)
                    B = vùng "mềm": mọi chỗ trừ gương mặt / cổ (chuông sứa, voan, xúc tu chuyển động)
                    A = 1 - mặt nước (ảnh này không có mặt nước -> A = 1)
Mô hình ONNX (CPU) trong E:\\Profolio 3D\\web\\tools\\.cache\\models: depth.onnx, sr2.onnx.
"""
import os, sys
import cv2
import numpy as np
import onnxruntime as ort
import pymupdf
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = r'E:\Profolio 3D\web\tools\.cache\models'
PAGE = 4
# tính theo tỷ lệ ảnh (PDF xuất lại có thể nhúng ảnh trang 4 ở cỡ khác: 1512x756, 1134x567...)
CROP = (0, 0, .5344, 1)          # người + sứa: nửa trái ảnh trang 4 (bỏ các ô kính bên phải)
FACE = (.4765, .397)             # tâm gương mặt, tỷ lệ trong khung cắt


def upscale2(rgb):
    """Swin2SR x2 theo từng ô 192px (chồng mép 16px) để vừa RAM; lỗi thì dùng Lanczos."""
    try:
        sess = ort.InferenceSession(os.path.join(MODELS, 'sr2.onnx'))
    except Exception as e:
        print('Swin2SR không chạy được, dùng Lanczos:', e)
        return cv2.resize(rgb, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    H, W = rgb.shape[:2]
    T, O = 192, 16
    out = np.zeros((H * 2, W * 2, 3), np.float32)
    f = rgb.astype(np.float32) / 255
    for y in range(0, H, T):
        for x in range(0, W, T):
            y0, x0 = max(0, y - O), max(0, x - O)
            y1, x1 = min(H, y + T + O), min(W, x + T + O)
            tile = f[y0:y1, x0:x1]
            ph, pw = (-tile.shape[0]) % 8, (-tile.shape[1]) % 8          # bội số của 8 (cửa sổ Swin)
            tile = np.pad(tile, ((0, ph), (0, pw), (0, 0)), mode='reflect')
            r = sess.run(None, {'pixel_values': tile.transpose(2, 0, 1)[None]})[0][0].transpose(1, 2, 0)
            r = r[:(y1 - y0) * 2, :(x1 - x0) * 2]
            cy, cx = (y - y0) * 2, (x - x0) * 2
            hh, ww = (min(y + T, H) - y) * 2, (min(x + T, W) - x) * 2
            out[y * 2:y * 2 + hh, x * 2:x * 2 + ww] = r[cy:cy + hh, cx:cx + ww]
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8)


def main(pdf):
    doc = pymupdf.open(pdf)
    info = max(doc[PAGE - 1].get_image_info(xrefs=True), key=lambda i: i['width'] * i['height'])
    pix = pymupdf.Pixmap(doc, info['xref'])
    if pix.colorspace and pix.colorspace.n > 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    im = Image.frombytes('RGBA' if pix.alpha else 'RGB', (pix.width, pix.height), pix.samples).convert('RGB')
    im = im.crop(tuple(round(v * (pix.width if i % 2 == 0 else pix.height)) for i, v in enumerate(CROP)))
    rgb = np.asarray(im)
    H, W = rgb.shape[:2]

    # độ sâu (trên ảnh gốc)
    dh, dw = 518, round(W * 518 / H / 14) * 14
    x = cv2.resize(rgb, (dw, dh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = ((x - [.485, .456, .406]) / [.229, .224, .225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = ort.InferenceSession(os.path.join(MODELS, 'depth.onnx')).run(None, {'pixel_values': x})[0][0]
    d = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
    lo, hi = np.percentile(d, 3), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1)
    d = cv2.GaussianBlur(d, (0, 0), 2.5)

    # vùng nhân vật: sáng hơn và ít "xanh nước" hơn nền, hoặc ở gần
    f = rgb.astype(np.float32) / 255
    lum = f @ [.299, .587, .114]
    blue = np.clip(f[..., 2] - np.maximum(f[..., 0], f[..., 1] * .9), 0, 1)
    fig = np.clip((lum - .3) / .25, 0, 1) * np.clip(1 - blue * 2.2, 0, 1)
    fig = np.maximum(fig, np.clip((d - .35) / .3, 0, 1))
    fig = cv2.GaussianBlur(fig, (0, 0), 6)
    fig = np.clip((fig - .15) / .6, 0, 1)

    # vùng mềm: mọi chỗ trừ mặt + cổ (giảm dần theo khoảng cách tới gương mặt)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.hypot(xx / W - FACE[0], (yy / H - FACE[1] - .053) * 1.25)
    soft = np.clip((dist - .08) / .2, 0, 1)

    # A lưu 1 - mặt nước: alpha = 0 khiến trình duyệt xoá luôn màu khi giải mã ảnh -> bản đồ hỏng
    out = np.dstack([d, fig, soft, np.ones_like(d)])
    big = upscale2(rgb)
    big = Image.fromarray(big).filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
    os.makedirs(os.path.join(ROOT, 'img'), exist_ok=True)
    big.save(os.path.join(ROOT, 'img', 'hero.webp'), 'WEBP', quality=90, method=6)
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'img', 'hero-map.webp'), 'WEBP', lossless=True, exact=True)
    print('hero', big.size, '-> img/hero.webp, img/hero-map.webp')


if __name__ == '__main__':
    main(sys.argv[1])
