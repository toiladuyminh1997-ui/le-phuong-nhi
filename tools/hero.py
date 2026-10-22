"""Ảnh nhân vật chính (người hoá sứa, trang 4 của PORT26.pdf) cho cảnh 3D trang đầu.

    python tools/hero.py PORT26.pdf

img/hero.webp       ảnh màu (cắt nửa trái trang 4: người + con sứa)
img/hero-map.webp   bản đồ RGB: R = độ gần (Depth Anything V2), G = vùng nhân vật (tách khỏi nền nước),
                    B = vùng "mềm" (vải voan, chuông sứa: lay theo nước; mặt và thân giữ yên)
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
CROP = (0, 0, 808, 756)          # khung người + sứa trong ảnh 1512x756 của trang 4 (bỏ tấm kính bên phải)
FACE = (385, 300)                # tâm gương mặt (điểm ảnh, trong khung cắt)


def main(pdf):
    doc = pymupdf.open(pdf)
    xref = doc[3].get_image_info(xrefs=True)[0]['xref']
    pix = pymupdf.Pixmap(doc, xref)
    if pix.colorspace and pix.colorspace.n > 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    im = Image.frombytes('RGB' if not pix.alpha else 'RGBA', (pix.width, pix.height), pix.samples).convert('RGB').crop(CROP)
    rgb = np.asarray(im)
    H, W = rgb.shape[:2]

    # độ sâu
    dh, dw = 518, round(W * 518 / H / 14) * 14
    x = cv2.resize(rgb, (dw, dh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = ((x - [.485, .456, .406]) / [.229, .224, .225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = ort.InferenceSession(DEPTH).run(None, {'pixel_values': x})[0][0]
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

    # vùng mềm: mọi chỗ trừ mặt + cổ + thân (giảm dần theo khoảng cách tới gương mặt)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.hypot((xx - FACE[0]) / W, (yy - FACE[1] - 60) / H * 1.2)
    soft = np.clip((dist - .1) / .22, 0, 1)

    out = np.dstack([d, fig, soft])
    os.makedirs(os.path.join(ROOT, 'img'), exist_ok=True)
    im.save(os.path.join(ROOT, 'img', 'hero.webp'), 'WEBP', quality=90, method=6)
    Image.fromarray((out * 255).astype(np.uint8)).save(os.path.join(ROOT, 'img', 'hero-map.webp'), 'WEBP', lossless=True)
    print('hero', im.size, '-> img/hero.webp, img/hero-map.webp')


if __name__ == '__main__':
    main(sys.argv[1])
