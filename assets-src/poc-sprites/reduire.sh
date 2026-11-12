#!/bin/bash
# Réduit une image générée (fond blanc) en sprite de combat : détourage depuis les 4 coins,
# réduction au plus proche pixel, palette imposée, contour noir 1 px.
# usage : reduire.sh <image.png> <palette.png> <hauteur> <largeur-cadre>x<hauteur-cadre> <sortie.png>
# La palette doit contenir #ff00ff (couleur clé du fond) en plus des couleurs du personnage.
set -euo pipefail
source_image=$1 palette=$2 height=$3 frame=$4 output=$5
work=$(mktemp -d)
right=$(magick "$source_image" -format "%[fx:w-1]" info:)
bottom=$(magick "$source_image" -format "%[fx:h-1]" info:)
magick "$source_image" -fuzz 15% -fill '#ff00ff' \
  -draw "color 0,0 floodfill" -draw "color 0,$bottom floodfill" \
  -draw "color $right,$bottom floodfill" -draw "color $right,0 floodfill" \
  -trim +repage -filter point -resize "x$height" -fuzz 0 -dither None -remap "$palette" \
  -transparent '#ff00ff' -background none -gravity south -extent "$frame" PNG32:"$work/sprite.png"
magick "$work/sprite.png" -alpha extract -morphology dilate diamond:1 -colorspace sRGB -type TrueColor PNG24:"$work/mask.png"
magick -size "$frame" xc:'#101018' "$work/mask.png" -alpha off -compose copy_opacity -composite PNG32:"$work/outline.png"
magick "$work/outline.png" "$work/sprite.png" -compose over -composite PNG32:"$output"
rm -r "$work"
