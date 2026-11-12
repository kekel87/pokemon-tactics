"""Prototype : Red construit en voxels par le code, rendu en pixel art dans les 8 directions.

Le même modèle sert à toutes les vues : la cohérence d'une direction à l'autre vient de la construction.
Rendu : faces visibles projetées en orthographique (lacet par pas de 45°, plongée fixe), peintre par profondeur,
à une échelle interne de SCALE pixels par voxel, puis une couleur par bloc et un contour sombre d'un pixel.
usage : python3 voxel_red.py <dossier_sortie> [plongée_en_degrés]
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SCALE = 8
OUTLINE = (16, 16, 24)
DIRECTIONS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"]

COLORS = {
    "skin": (248, 192, 144),
    "hair": (40, 32, 40),
    "eye": (24, 24, 40),
    "cap": (216, 56, 48),
    "cap_white": (240, 240, 240),
    "vest": (208, 48, 48),
    "vest_white": (232, 232, 232),
    "shirt": (40, 56, 112),
    "jeans": (56, 96, 176),
    "shoe": (176, 40, 40),
    "sole": (232, 232, 232),
    "pack": (232, 184, 48),
}


def build_model() -> dict[tuple[int, int, int], str]:
    """x : gauche-droite (0-13), y : avant-arrière (0 = devant), z : hauteur."""
    voxels: dict[tuple[int, int, int], str] = {}

    def box(x0, x1, y0, y1, z0, z1, color):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    voxels[(x, y, z)] = color

    box(3, 5, 1, 4, 0, 0, "sole")
    box(8, 10, 1, 4, 0, 0, "sole")
    box(3, 5, 1, 4, 1, 1, "shoe")
    box(8, 10, 1, 4, 1, 1, "shoe")
    box(3, 6, 2, 4, 2, 11, "jeans")
    box(7, 10, 2, 4, 2, 11, "jeans")
    box(3, 10, 2, 4, 12, 12, "jeans")
    box(3, 10, 2, 5, 13, 19, "shirt")
    box(3, 10, 2, 2, 13, 19, "vest")
    box(6, 7, 2, 2, 13, 19, "vest_white")
    box(1, 2, 2, 4, 15, 19, "shirt")
    box(11, 12, 2, 4, 15, 19, "shirt")
    box(1, 2, 2, 4, 12, 14, "skin")
    box(11, 12, 2, 4, 12, 14, "skin")
    box(4, 9, 6, 7, 12, 19, "pack")
    box(5, 8, 2, 4, 20, 20, "skin")
    box(3, 10, 1, 6, 21, 26, "skin")
    box(3, 10, 3, 6, 21, 27, "hair")
    box(2, 2, 2, 6, 21, 26, "hair")
    box(11, 11, 2, 6, 21, 26, "hair")
    box(3, 10, 1, 1, 26, 26, "hair")
    for z in (23, 24):
        voxels[(5, 1, z)] = "eye"
        voxels[(8, 1, z)] = "eye"
    box(4, 9, 1, 1, 25, 25, "skin")
    box(3, 4, 1, 1, 25, 26, "hair")
    box(9, 10, 1, 1, 25, 26, "hair")
    box(6, 7, 1, 1, 26, 26, "hair")
    for x, y in ((3, 1), (10, 1), (3, 6), (10, 6)):
        for z in range(21, 27):
            voxels.pop((x, y, z), None)
    for x, y in ((3, 2), (10, 2), (3, 5), (10, 5)):
        for z in range(13, 20):
            voxels.pop((x, y, z), None)
    box(3, 3, 3, 4, 13, 19, "vest")
    box(10, 10, 3, 4, 13, 19, "vest")
    box(5, 5, 2, 2, 13, 19, "vest_white")
    box(8, 8, 2, 2, 13, 19, "vest_white")
    for x, y in ((3, 1), (10, 1), (3, 6), (10, 6)):
        voxels.pop((x, y, 29), None)
    box(3, 10, 1, 6, 27, 29, "cap")
    box(4, 9, 0, 0, 27, 28, "cap_white")
    box(3, 10, -2, 0, 27, 27, "cap")
    return voxels


FACES = {
    (1, 0, 0): [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
    (-1, 0, 0): [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)],
    (0, 1, 0): [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
    (0, -1, 0): [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
    (0, 0, 1): [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
    (0, 0, -1): [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)],
}
LIGHT = np.array([-0.4, -0.6, 0.7])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def render(voxels, yaw_degrees: float, pitch_degrees: float) -> Image.Image:
    center = np.array([6.5, 3.5, 0.0])
    yaw, pitch = math.radians(yaw_degrees), math.radians(pitch_degrees)

    def rotate(point):
        x, y, z = np.array(point, dtype=float) - center
        x, y = x * math.cos(yaw) - y * math.sin(yaw), x * math.sin(yaw) + y * math.cos(yaw)
        screen_x = x
        screen_y = -(z * math.cos(pitch) - y * math.sin(pitch))
        depth = y * math.cos(pitch) + z * math.sin(pitch)
        return screen_x, screen_y, depth

    polygons = []
    for (x, y, z), color in voxels.items():
        for normal, corners in FACES.items():
            if (x + normal[0], y + normal[1], z + normal[2]) in voxels:
                continue
            nx, ny, nz = normal
            rotated_normal = (nx * math.cos(yaw) - ny * math.sin(yaw), nx * math.sin(yaw) + ny * math.cos(yaw), nz)
            facing = rotated_normal[1] * math.cos(pitch) + rotated_normal[2] * math.sin(pitch)
            if facing >= 0:
                continue
            points = [rotate((x + cx, y + cy, z + cz)) for cx, cy, cz in corners]
            depth = sum(p[2] for p in points) / 4
            light = max(0.0, float(np.dot(rotated_normal, LIGHT)))
            shade = 0.5 + 0.55 * light
            base = COLORS[color]
            polygons.append((depth, [(p[0], p[1]) for p in points], tuple(int(c * shade) for c in base)))

    size = 40 * SCALE
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for _, points, color in sorted(polygons, key=lambda item: -item[0]):
        draw.polygon([(size / 2 + px * SCALE, size * 0.85 + py * SCALE) for px, py in points], fill=(*color, 255))
    return image


def to_pixels(image: Image.Image) -> Image.Image:
    data = np.array(image)
    rows, columns = data.shape[0] // SCALE, data.shape[1] // SCALE
    sprite = np.zeros((rows, columns, 4), dtype=np.uint8)
    for row in range(rows):
        for column in range(columns):
            block = data[row * SCALE:(row + 1) * SCALE, column * SCALE:(column + 1) * SCALE].reshape(-1, 4)
            opaque = block[block[:, 3] > 0]
            if len(opaque) < len(block) / 2:
                continue
            colors, counts = np.unique(opaque[:, :3], axis=0, return_counts=True)
            sprite[row, column, :3] = colors[counts.argmax()]
            sprite[row, column, 3] = 255
    filled = sprite[:, :, 3] > 0
    grown = filled.copy()
    for shift_y, shift_x in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grown |= np.roll(np.roll(filled, shift_y, 0), shift_x, 1)
    sprite[grown & ~filled] = (*OUTLINE, 255)
    result = Image.fromarray(sprite)
    return result.crop(result.getbbox())


def main():
    output = Path(sys.argv[1])
    pitch = float(sys.argv[2]) if len(sys.argv) > 2 else 30.0
    output.mkdir(parents=True, exist_ok=True)
    voxels = build_model()
    for index, name in enumerate(DIRECTIONS):
        to_pixels(render(voxels, -45.0 * index, pitch)).save(output / f"{index}-{name}.png")


if __name__ == "__main__":
    main()
