#!/usr/bin/env bash
# Optional: downloads higher-resolution originals of the Steam and Wikimedia
# references into images/hires/. The images/ folder already has usable copies;
# run this only if you want sharper versions. Krillion and Puzzmo captures
# have no higher-resolution original.
#
# Usage (from this folder):  bash fetch-originals.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p images/hires

get() { # $1 = output name, $2 = url
  echo "→ $1"
  curl -fsSL -A "Mozilla/5.0 (unearth-references)" -o "images/hires/$1" "$2" || echo "  ! failed: $2"
}

STEAM=https://shared.akamai.steamstatic.com/store_item_assets/steam/apps
get 10-steamworld-dig2-lamplit-tunnels.jpg   "$STEAM/571310/ss_26b9325c7e66c42ae586e499bd92da3de7995525.1920x1080.jpg"
get 11-steamworld-dig2-crystal-cave-glow.jpg "$STEAM/571310/ss_00f3730a15890cb2ada5fcce61350dbc551cf6f3.1920x1080.jpg"
get 12-steamworld-dig2-surface.jpg           "$STEAM/571310/ss_7072c34bfa84ab8894da321f9d991eab8f4dfef8.1920x1080.jpg"
get 13-dome-keeper-ore-nodes.jpg             "$STEAM/1637320/ss_8406a10007a2c6aeca051b8abd5ec451586c0c63.1920x1080.jpg"
get 14-dome-keeper-layer-palette.jpg         "$STEAM/1637320/ss_15b56378019c177ec3fd26f11b2631e81c5db2de.1920x1080.jpg"
get 15-balatro-score-moment.jpg              "$STEAM/2379780/ss_3be65a7dd3be072d567e11883d208861a7e959fa.1920x1080.jpg"

# Wikimedia Commons (source pages: https://commons.wikimedia.org/wiki/<File:...>)
WM=https://upload.wikimedia.org/wikipedia/commons
get 18-survey-smith-strata-sketch.jpg     "$WM/thumb/1/15/Sketch_of_the_Succession_pf_Strata_and_their_relative_Altitudes.jpg/1920px-Sketch_of_the_Succession_pf_Strata_and_their_relative_Altitudes.jpg"
get 19-survey-lithology-patterns.png      "$WM/thumb/5/56/Wales_rock_strata%2C_William_Smith.png/1920px-Wales_rock_strata%2C_William_Smith.png"
get 20-mineral-uranium-torbernite.jpg     "$WM/6/67/Torbernite-119952.jpg"
get 21-mineral-gold.jpg                   "$WM/8/83/Crystalline_gold%2C_Mockingbird_mine%2C_Mariposa_County%2C_California_%2849016973742%29.jpg"
get 22-mineral-diamond.jpg                "$WM/1/17/Octahedral_diamond_%28Sierra_Leone%2C_Africa%29_1_%2817873756859%29.jpg"
get 23-mineral-copper.jpg                 "$WM/e/ea/Copper-hc15d.jpg"
get 24-mineral-silver.jpg                 "$WM/a/a7/Bulldog_Mountain_Mine_wire_Silver-20872.jpg"
get 25-mineral-coal-iridescent.jpg        "$WM/6/62/Anthracite_coal_%28iridescent%29_-_Kuperavage_Mine%2C_Pennsylvania%2C_USA.jpg"
get 26-label-krantz-specimen-tag.jpg      "$WM/4/43/Modell_eines_Kristalls_des_Minerals_Flussspat_%28Zwilling%29_-Krantz_448-_%282%29%2C_label.jpg"
get 27-label-tied-specimen-tags.jpg       "$WM/0/00/Naturalis_Biodiversity_Center_-_RMNH.AVES.139321_1_-_Paradoxornis_fulvifrons_cyanophrys_%28David%2C_1874%29_-_Timaliidae_-_bird_skin_specimen.jpeg"
get 28-label-painted-catalogue-number.jpg "$WM/4/4d/Mineral_6.jpg"

echo "Done. Hi-res copies are in images/hires/ (same numbering as images/)."
