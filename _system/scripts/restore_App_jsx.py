#!/usr/bin/env python3
from pathlib import Path
import base64
parts = []
d = Path("scripts/app_jsx_b64")
for i in range(100):
    f = d / f"{i}.txt"
    if not f.exists():
        break
    parts.append(f.read_text().strip())
data = base64.b64decode("".join(parts))
Path("src/App.jsx").write_bytes(data)
print("Restored src/App.jsx", len(data), "bytes")
