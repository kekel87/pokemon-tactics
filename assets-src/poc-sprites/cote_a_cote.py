"""Anime côte à côte un dresseur rendu par SpriteKiln et des Pokémon au format PMD, dans les 8 directions.

Une ligne par personnage, une colonne par direction, à la même échelle (1 px du jeu = `zoom` px). Chaque
personnage est posé sur une ligne de sol commune : le bas de ses pixels opaques sur toute l'animation, pour
garder le rebond de la marche. Les durées PMD sont en 1/60 s, celles de SpriteKiln en ms.
usage : python3 cote_a_cote.py <sortie.gif> <clip>[:<AnimPMD>] <atlas_spritekiln.json> <dossier_pmd>... [--zoom 3]
Le clip SpriteKiln et l'animation PMD en face portent le même nom par défaut (`walk` face à `Walk`) ; sinon
`throw:Shoot`, ou une liste de repli `faint:Faint/Sleep`. Un dossier PMD contient soit `atlas.json` (paquet du jeu), soit `AnimData.xml` et
`<Anim>-Anim.png` (SpriteCollab).
"""
import json
import sys
import xml.etree.ElementTree as ElementTree
from pathlib import Path

from PIL import Image

DIRECTIONS = ["s", "se", "e", "ne", "n", "nw", "w", "sw"]
PMD_DIRECTIONS = ["South", "SouthEast", "East", "NorthEast", "North", "NorthWest", "West", "SouthWest"]
TICK_MS = 40
LOOP_MS = 4800
BACKGROUND = (42, 42, 54, 255)


def spritekiln_clips(atlas_path: Path, animation: str):
    data = json.loads(atlas_path.read_text())
    sheet = Image.open(atlas_path.with_suffix(".png")).convert("RGBA")
    clips = []
    for direction in DIRECTIONS:
        frames = []
        index = 0
        while (key := f"{animation}_{direction}_{index}") in data["frames"]:
            entry = data["frames"][key]
            box = entry["frame"]
            frames.append((sheet.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"])), entry["duration"]))
            index += 1
        if not frames:
            raise SystemExit(f"{atlas_path.name} : pas de clip `{animation}` en direction {direction}")
        clips.append(frames)
    return clips


def pmd_clips(folder: Path, animations: str):
    """`animations` : noms PMD séparés par `/`, le premier que le Pokémon possède sert (`Faint/Sleep`)."""
    candidates = [name[0].upper() + name[1:] for name in animations.split("/")]
    if (folder / "atlas.json").exists():
        data = json.loads((folder / "atlas.json").read_text())
        sheet = Image.open(folder / "atlas.png").convert("RGBA")
        name = next(candidate for candidate in candidates if candidate in data["meta"]["animations"])
        durations = data["meta"]["animations"][name]["durations"]
        clips = []
        for direction in PMD_DIRECTIONS:
            frames = []
            for index, ticks in enumerate(durations):
                box = data["frames"][f"{name}-{direction}-{index}"]["frame"]
                frames.append((sheet.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"])), ticks * 1000 / 60))
            clips.append(frames)
        return clips
    root = ElementTree.parse(folder / "AnimData.xml").getroot()
    available = {a.findtext("Name"): a for a in root.iter("Anim")}
    name = next(candidate for candidate in candidates if candidate in available and (folder / f"{candidate}-Anim.png").exists())
    anim = available[name]
    width, height = int(anim.findtext("FrameWidth")), int(anim.findtext("FrameHeight"))
    durations = [int(d.text) for d in anim.iter("Duration")]
    sheet = Image.open(folder / f"{name}-Anim.png").convert("RGBA")
    sheet_rows = sheet.height // height  # Sleep n'a qu'une direction : la même ligne sert partout
    return [
        [(sheet.crop((i * width, row * height, (i + 1) * width, (row + 1) * height)), ticks * 1000 / 60) for i, ticks in enumerate(durations)]
        for row in (min(direction, sheet_rows - 1) for direction in range(len(PMD_DIRECTIONS)))
    ]


def opaque_bottom(image: Image.Image) -> int:
    box = image.getchannel("A").point(lambda alpha: 255 if alpha == 255 else 0).getbbox()
    return box[3] if box else image.height


def frame_at(frames, time_ms: float) -> Image.Image:
    total = sum(duration for _, duration in frames)
    time_ms %= total
    for image, duration in frames:
        if time_ms < duration:
            return image
        time_ms -= duration
    return frames[-1][0]


def main():
    arguments = sys.argv[1:]
    zoom = 3
    if "--zoom" in arguments:
        position = arguments.index("--zoom")
        zoom = int(arguments[position + 1])
        del arguments[position:position + 2]
    output, animations, atlas, *pmd_folders = arguments
    clip, _, pmd_animation = animations.partition(":")
    pmd_animation = pmd_animation or clip
    characters = [spritekiln_clips(Path(atlas), clip)] + [pmd_clips(Path(folder), pmd_animation) for folder in pmd_folders]
    cell_width = max(image.width for clips in characters for frames in clips for image, _ in frames)
    cell_height = max(image.height for clips in characters for frames in clips for image, _ in frames)
    bottoms = [[max(opaque_bottom(image) for image, _ in frames) for frames in clips] for clips in characters]
    images = []
    for time_ms in range(0, LOOP_MS, TICK_MS):
        board = Image.new("RGBA", (cell_width * len(DIRECTIONS), cell_height * len(characters)), BACKGROUND)
        for row, clips in enumerate(characters):
            for column, frames in enumerate(clips):
                image = frame_at(frames, time_ms)
                x = column * cell_width + (cell_width - image.width) // 2
                y = row * cell_height + cell_height - 2 - bottoms[row][column]
                board.alpha_composite(image, (x, y))
        images.append(board.resize((board.width * zoom, board.height * zoom), Image.NEAREST).convert("P", palette=Image.ADAPTIVE))
    images[0].save(output, save_all=True, append_images=images[1:], duration=TICK_MS, loop=0, disposal=2)


if __name__ == "__main__":
    main()
