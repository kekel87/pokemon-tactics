"""Fiche animée d'un dresseur SpriteKiln : toutes ses animations dans les 8 directions, en un seul GIF.

Une ligne par animation (son nom à gauche), une colonne par direction, puis une ligne par Pokémon PMD qui marche,
pour l'échelle. Chaque personnage est posé sur son point au sol, fixe dans la case, donc un saut se voit.
Un panneau à gauche, facultatif, montre le nom, l'image qui a servi de base et le pitch (personnalité, gestes).
usage : python3 fiche_animations.py <sortie.gif> <atlas_spritekiln.json> [<dossier_pmd> <nom>]... [--zoom 4]
        [--nom "Major Bob"] [--artwork splash.png] [--pitch pitch.txt]
        [--clips "idle:Attente,attack:Attaque"] [--pmd-anims Walk,Attack]
Le pitch est un fichier texte : une ligne par paragraphe. `--clips` remplace la liste des animations du dresseur
(un Pokémon n'a pas les mêmes) ; `--pmd-anims` donne une ligne par animation PMD de chaque Pokémon comparé.
"""
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from cote_a_cote import DIRECTIONS, frame_at, opaque_bottom, pmd_clips, spritekiln_clips

CLIPS = [
    ("idle", "Attente"),
    ("walk", "Marche"),
    ("throw", "Lancer de Ball"),
    ("hop", "Saut"),
    ("hurt", "Touché"),
    ("faint", "K.O."),
    ("command", "Donner un ordre"),
    ("item", "Utiliser un objet"),
    ("celebrate", "Célébration"),
]
PMD_LABELS = {"Idle": "attente", "Walk": "marche", "Attack": "attaque", "Shoot": "attaque spéciale", "Charge": "charge",
              "Hurt": "touché", "Faint": "K.O.", "Hop": "saut", "Sleep": "sommeil"}
TICK_MS = 40
LOOP_MS = 4800
GAP = 3
LABEL_MARGIN = 8
HEADER_HEIGHT = 9
BACKGROUND = (42, 42, 54, 255)
SEPARATOR = (60, 60, 76, 255)
TEXT = (230, 230, 240, 255)
FONT = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf"
PANEL_WIDTH = 130


def ground_offset(idle_clips) -> int:
    """Hauteur du point au sol sous le centre de la case, mesurée sur l'attente vers le sud."""
    frames = idle_clips[0]
    return max(opaque_bottom(image) for image, _ in frames) - frames[0][0].height // 2


def take_option(arguments, name):
    if name not in arguments:
        return None
    position = arguments.index(name)
    value = arguments[position + 1]
    del arguments[position:position + 2]
    return value


def side_panel(name, artwork, pitch, zoom, height) -> Image.Image:
    """Panneau à la taille finale : nom en titre, image de base, puis le pitch replié à la largeur."""
    width = PANEL_WIDTH * zoom
    panel = Image.new("RGBA", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(panel)
    margin = 4 * zoom
    y = margin
    if name:
        title = ImageFont.truetype(FONT, 12 * zoom)
        draw.text((margin, y), name, fill=TEXT, font=title)
        y += 16 * zoom
    if artwork:
        image = Image.open(artwork).convert("RGBA")
        scale = min((width - 2 * margin) / image.width, height * 0.5 / image.height)
        image = image.resize((int(image.width * scale), int(image.height * scale)), Image.LANCZOS)
        panel.alpha_composite(image, ((width - image.width) // 2, y))
        y += image.height + 4 * zoom
    if pitch:
        font = ImageFont.truetype(FONT_REGULAR, 6 * zoom)
        characters = max(10, int((width - 2 * margin) / (font.getlength("n") or 1)))
        for paragraph in Path(pitch).read_text().splitlines():
            for line in textwrap.wrap(paragraph, characters) or [""]:
                draw.text((margin, y), line, fill=TEXT, font=font)
                y += 8 * zoom
            y += 2 * zoom
    draw.line([(width - 1, 0), (width - 1, height)], fill=SEPARATOR, width=zoom)
    return panel


def main():
    arguments = sys.argv[1:]
    zoom = int(take_option(arguments, "--zoom") or 4)
    name, artwork, pitch = (take_option(arguments, option) for option in ("--nom", "--artwork", "--pitch"))
    clip_option = take_option(arguments, "--clips")
    clips = [(item.partition(":")[0], item.partition(":")[2] or item) for item in clip_option.split(",")] if clip_option else CLIPS
    pmd_animations = (take_option(arguments, "--pmd-anims") or "Walk").split(",")
    output, atlas, *pmd_arguments = arguments
    trainer_offset = ground_offset(spritekiln_clips(Path(atlas), "idle"))
    rows = [(label, spritekiln_clips(Path(atlas), clip), trainer_offset) for clip, label in clips]
    for folder, pokemon in zip(pmd_arguments[::2], pmd_arguments[1::2]):
        offset = ground_offset(pmd_clips(Path(folder), "Idle"))
        for animation in pmd_animations:
            rows.append((f"{pokemon} ({PMD_LABELS.get(animation, animation)})", pmd_clips(Path(folder), animation), offset))

    left = right = 0
    above = [0] * len(rows)
    below = [0] * len(rows)
    for row, (_, clips, offset) in enumerate(rows):
        for frames in clips:
            for image, _ in frames:
                box = image.getbbox()
                if box:
                    anchor_x, anchor_y = image.width // 2, image.height // 2 + offset
                    left, right = max(left, anchor_x - box[0]), max(right, box[2] - anchor_x)
                    above[row], below[row] = max(above[row], anchor_y - box[1]), max(below[row], box[3] - anchor_y)
    cell_width = left + right + 2 * GAP
    row_tops = [HEADER_HEIGHT]
    for row in range(len(rows)):
        row_tops.append(row_tops[-1] + above[row] + below[row] + 2 * GAP)
    label_font = ImageFont.truetype(FONT, 7)
    label_width = int(max(label_font.getlength(label) for label, _, _ in rows)) + LABEL_MARGIN
    width, height = label_width + cell_width * len(DIRECTIONS), row_tops[-1]

    # Le fond (traits) à l'échelle 1, le texte par-dessus à la taille finale pour rester net.
    base = Image.new("RGBA", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(base)
    for column in range(len(DIRECTIONS)):
        x = label_width + column * cell_width
        draw.line([(x, 0), (x, height)], fill=SEPARATOR)
    for top in row_tops[:-1]:
        draw.line([(0, top), (width, top)], fill=SEPARATOR)
    text = Image.new("RGBA", (width * zoom, height * zoom), (0, 0, 0, 0))
    draw = ImageDraw.Draw(text)
    font = ImageFont.truetype(FONT, 7 * zoom)
    for column, direction in enumerate(DIRECTIONS):
        x = (label_width + column * cell_width + cell_width // 2) * zoom
        draw.text((x, zoom), direction.upper(), fill=TEXT, font=font, anchor="ma")
    for row, (label, _, _) in enumerate(rows):
        draw.text((3 * zoom, (row_tops[row] + row_tops[row + 1]) // 2 * zoom), label, fill=TEXT, font=font, anchor="lm")

    panel = side_panel(name, artwork, pitch, zoom, height * zoom) if (name or artwork or pitch) else None
    images = []
    for time_ms in range(0, LOOP_MS, TICK_MS):
        board = base.copy()
        for row, (_, clips, offset) in enumerate(rows):
            ground = row_tops[row] + GAP + above[row]
            for column, frames in enumerate(clips):
                image = frame_at(frames, time_ms)
                position = (label_width + column * cell_width + GAP + left - image.width // 2, ground - image.height // 2 - offset)
                board.alpha_composite(image, position)
        large = board.resize((width * zoom, height * zoom), Image.NEAREST)
        large.alpha_composite(text)
        if panel:
            framed = Image.new("RGBA", (panel.width + large.width, large.height))
            framed.paste(panel, (0, 0))
            framed.paste(large, (panel.width, 0))
            large = framed
        images.append(large.convert("P", palette=Image.ADAPTIVE))
    images[0].save(output, save_all=True, append_images=images[1:], duration=TICK_MS, loop=0, disposal=2, optimize=True)


if __name__ == "__main__":
    main()
