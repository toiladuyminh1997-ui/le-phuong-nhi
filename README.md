# Lê Phương Nhi — Portfolio · Immerse

Trang portfolio 3D (three.js): cột xương sống thủy tinh giữa biển sâu, đàn sứa bơi quanh,
các dự án là những tấm kính xếp xoắn ốc — lặn sâu qua 5 phần: Branding, Menu, Film & TVC, 3D & Animation, Key Visual & POSM.

Xem: https://toiladuyminh1997-ui.github.io/le-phuong-nhi/

```
tools/projects.json   nội dung: tên, mô tả, thời gian, công cụ, số trang PDF chứa ảnh của từng dự án
tools/extract.py      python tools/extract.py "PORT26.pdf"  ->  img/ + data.js
index.html, style.css, app.js   trang
```

Các phiên bản cũ: https://toiladuyminh1997-ui.github.io/le-phuong-nhi/phien-ban.html
(`versions/vN/` + ảnh chụp `versions/thumbs/`, dựng bằng `python tools/versions.py`; tag git `vN`).
Mỗi lần đăng bản mới: thêm một dòng vào `VERSIONS` trong tools/versions.py rồi chạy lại.

Xem trên máy: `python -m http.server 8000` rồi mở http://localhost:8000
