"""Cảnh nhân vật chính ở trang đầu: trang 6 của PORT26.pdf (người bước trên mặt nước, đàn sứa bơi quanh).

    python tools/hero.py PORT26.pdf

img/hero.webp       ảnh màu (ảnh nền trang 6, không kèm chữ "Contents" — chữ là lớp vector riêng trong PDF)
img/hero-map.webp   bản đồ RGBA:
                    R = độ gần (Depth Anything V2)
                    G = độ hiện (1 = cả cảnh; mép ảnh tan vào nền do shader lo)
                    B = vùng "mềm": mọi chỗ trừ quanh người (đàn sứa dập dềnh, trôi)
                    A = mặt nước (gợn sóng lăn tăn)
Mô hình: E:\\Profolio 3D\\web\\tools\\.cache\\models\\depth.onnx (onnxruntime, CPU).
"""
import os, sys
import cv2
import numpy as np
import onnxruntime as ort
import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEPTH = r'E:\Profolio 3D\web\tools\.cache\models\depth.onnx'
PAGE = 6
PERSON = (185, 410)              # tâm người (điểm ảnh trong ảnh 1134x567 của trang 6)
WATER_Y = .74                    # mặt nước bắt đầu từ ~74% chiều cao ảnh


def main(pdf):
    doc = pymupdf.open(pdf)
    info = max(doc[PAGE - 1].get_image_info(xrefs=True), key=lambda i: i['width'] * i['height'])
    pix = pymupdf.Pixmap(doc, info['xref'])
    if pix.colorspace and pix.colorspace.n > 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    im = Image.frombytes('RGBA' if pix.alpha else 'RGB', (pix.width, pix.height), pix.samples).convert('RGB')
    rgb = np.asarray(im)
    H, W = rgb.shape[:2]
    sx, sy = W / 1134, H / 567

    # độ sâu
    dh, dw = 518, round(W * 518 / H / 14) * 14
    x = cv2.resize(rgb, (dw, dh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = ((x - [.485, .456, .406]) / [.229, .224, .225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = ort.InferenceSession(DEPTH).run(None, {'pixel_values': x})[0][0]
    d = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
    lo, hi = np.percentile(d, 3), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1)
    d = cv2.GaussianBlur(d, (0, 0), 2.5)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # vùng mềm: xa người thì lay / trôi nhiều, quanh người giữ yên
    # người đứng thẳng -> vùng giữ yên là hình elip đứng (hẹp ngang, cao dọc), che cả chân chạm nước
    dist = np.hypot((xx - PERSON[0] * sx) / W * 3.4, (yy - PERSON[1] * sy) / H * 1.1)
    soft = np.clip((dist - .1) / .14, 0, 1)
    # mặt nước: từ đường chân trời trở xuống, mép mềm; quanh người không gợn (người không bị méo)
    water = np.clip((yy / H - WATER_Y) / .05, 0, 1) * soft
    fig = np.ones_like(d)

    out = np.dstack([d, fig, soft, water])
    os.makedirs(os.path.join(ROOT, 'img'), exist_ok=True)
    im.save(os.path.join(ROOT, 'img', 'hero.webp'), 'WEBP', quality=92, method=6)
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'img', 'hero-map.webp'), 'WEBP', lossless=True, exact=True)
    print('hero', im.size, '-> img/hero.webp, img/hero-map.webp')


if __name__ == '__main__':
    main(sys.argv[1])
