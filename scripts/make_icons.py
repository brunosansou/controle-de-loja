"""Gera os ícones PNG do app usando só a biblioteca padrão do Python.

Desenho: um pedaço de fita de caixa (papel claro com a borda de baixo picotada)
sobre fundo cor de tinta, com uma linha verde (entrada), uma vermelha (saída)
e o traço do total. Todo o desenho fica dentro da área segura dos ícones
"maskable" (círculo de raio 40% do tamanho).

Uso: python scripts/make_icons.py
"""
import struct
import zlib
from pathlib import Path

INK = (0x1D, 0x2B, 0x27)
TAPE = (0xFB, 0xFB, 0xF7)
GREEN = (0x1E, 0x7B, 0x4F)
RED = (0xB3, 0x36, 0x2F)

LEFT, RIGHT, TOP, BOTTOM = 0.32, 0.68, 0.22, 0.76
TEETH = 6  # dentes do picote na borda de baixo
BARS = [  # (y0, y1, x0, x1, cor)
    (0.31, 0.355, 0.38, 0.62, GREEN),
    (0.41, 0.455, 0.38, 0.56, RED),
    (0.53, 0.565, 0.38, 0.62, INK),
    (0.60, 0.645, 0.46, 0.62, INK),
]


def pixel(u: float, v: float):
    """Cor do ponto (u, v), coordenadas de 0 a 1."""
    if LEFT <= u <= RIGHT and TOP <= v <= BOTTOM:
        tooth_w = (RIGHT - LEFT) / TEETH
        tooth_h = tooth_w / 2
        if v > BOTTOM - tooth_h:
            pos = ((u - LEFT) % tooth_w) / tooth_w  # 0..1 dentro do dente
            peak = 1 - abs(pos - 0.5) * 2  # 1 no meio do dente
            if v > BOTTOM - tooth_h + tooth_h * peak:
                return INK
        for y0, y1, x0, x1, color in BARS:
            if y0 <= v <= y1 and x0 <= u <= x1:
                return color
        return TAPE
    return INK


def png(size: int) -> bytes:
    ss = 3  # supersampling para bordas suaves
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filtro "None"
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    c = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
                    acc[0] += c[0]
                    acc[1] += c[1]
                    acc[2] += c[2]
            n = ss * ss
            rows.extend((round(acc[0] / n), round(acc[1] / n), round(acc[2] / n)))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # RGB 8 bits
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')


def main() -> None:
    out = Path(__file__).resolve().parent.parent / 'icons'
    out.mkdir(exist_ok=True)
    for size in (192, 512):
        path = out / f'icon-{size}.png'
        path.write_bytes(png(size))
        print(f'{path.name}: {size}x{size}')


if __name__ == '__main__':
    main()
