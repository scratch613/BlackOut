#!/usr/bin/env python3
"""Prepare GeoJSON data assets for Resilience Light game."""
import json
import os
import shutil

PUBLIC_ASSETS = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
os.makedirs(PUBLIC_ASSETS, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Extract Ukraine country border from world geojson
# ---------------------------------------------------------------------------
print("Extracting Ukraine border...")
with open(os.path.join(os.path.dirname(__file__), 'ukraine_regions.geojson')) as f:
    world = json.load(f)

ukraine_feature = None
for feat in world['features']:
    props = feat.get('properties', {})
    name = props.get('name', '') or props.get('NAME', '') or props.get('ADMIN', '')
    iso = props.get('ISO3166-1-Alpha-3', '') or props.get('ADM0_A3', '')
    if name == 'Ukraine' or iso == 'UKR':
        ukraine_feature = feat
        break

if ukraine_feature is None:
    raise RuntimeError("Ukraine not found in GeoJSON!")

ukraine_border = {
    "type": "FeatureCollection",
    "features": [ukraine_feature]
}
with open(os.path.join(PUBLIC_ASSETS, 'ukraine_border.geojson'), 'w') as f:
    json.dump(ukraine_border, f)
print("  -> ukraine_border.geojson written")

# ---------------------------------------------------------------------------
# 2. Generate approximate oblast polygons (simple bounding-box rectangles)
# Each entry: [lon_min, lon_max, lat_min, lat_max]
# ---------------------------------------------------------------------------
print("Generating oblast polygons...")

OBLASTS = [
    ("vinnytsia",      "Вінницька",       27.50, 30.50, 48.10, 50.00),
    ("volyn",          "Волинська",        23.50, 26.00, 50.50, 52.10),
    ("dnipropetrovsk", "Дніпропетровська", 33.00, 36.50, 47.30, 49.60),
    ("donetsk",        "Донецька",         36.50, 39.50, 47.00, 49.00),
    ("zhytomyr",       "Житомирська",      27.00, 30.50, 49.80, 51.70),
    ("zakarpattia",    "Закарпатська",     22.10, 24.70, 47.90, 49.00),
    ("zaporizhzhia",   "Запорізька",       34.00, 37.50, 46.50, 48.30),
    ("ivano_frankivsk","Івано-Франківська", 23.50, 25.50, 47.70, 49.20),
    ("kyiv_oblast",    "Київська",         29.00, 32.50, 49.50, 51.70),
    ("kirovohrad",     "Кіровоградська",   31.00, 34.50, 47.50, 49.50),
    ("luhansk",        "Луганська",        37.50, 40.20, 47.80, 50.10),
    ("lviv",           "Львівська",        22.80, 25.50, 49.00, 50.70),
    ("mykolaiv",       "Миколаївська",     30.50, 33.50, 46.50, 48.00),
    ("odesa",          "Одеська",          28.50, 31.50, 45.30, 47.50),
    ("poltava",        "Полтавська",       32.50, 35.50, 48.50, 50.50),
    ("rivne",          "Рівненська",       25.50, 28.00, 50.00, 52.00),
    ("sumy",           "Сумська",          32.50, 35.50, 50.40, 52.40),
    ("ternopil",       "Тернопільська",    24.50, 27.00, 48.70, 50.00),
    ("kharkiv",        "Харківська",       35.50, 38.00, 49.00, 51.00),
    ("kherson",        "Херсонська",       31.50, 35.00, 45.50, 47.50),
    ("khmelnytskyi",   "Хмельницька",      26.00, 28.50, 48.50, 50.40),
    ("cherkasy",       "Черкаська",        30.50, 32.50, 48.20, 50.00),
    ("chernivtsi",     "Чернівецька",      24.50, 26.50, 47.70, 49.00),
    ("chernihiv",      "Чернігівська",     30.50, 34.00, 50.50, 52.40),
    ("kyiv_city",      "м. Київ",          30.23, 30.83, 50.21, 50.59),
    ("crimea",         "АРК Крим",         32.50, 36.70, 44.40, 46.30),
]

def make_polygon(lon_min, lon_max, lat_min, lat_max):
    """Create a simple rectangular GeoJSON polygon."""
    coords = [
        [lon_min, lat_min],
        [lon_max, lat_min],
        [lon_max, lat_max],
        [lon_min, lat_max],
        [lon_min, lat_min],  # close ring
    ]
    return {"type": "Polygon", "coordinates": [coords]}

features = []
for (oblast_id, name, lon_min, lon_max, lat_min, lat_max) in OBLASTS:
    feat = {
        "type": "Feature",
        "properties": {
            "id": oblast_id,
            "name": name,
        },
        "geometry": make_polygon(lon_min, lon_max, lat_min, lat_max),
    }
    features.append(feat)

oblasts_geojson = {
    "type": "FeatureCollection",
    "features": features,
}
with open(os.path.join(PUBLIC_ASSETS, 'ukraine_oblasts.geojson'), 'w', encoding='utf-8') as f:
    json.dump(oblasts_geojson, f, ensure_ascii=False, indent=2)
print("  -> ukraine_oblasts.geojson written")

# ---------------------------------------------------------------------------
# 3. Copy misc JSON files
# ---------------------------------------------------------------------------
misc_dir = os.path.dirname(__file__)
copies = [
    ('power_plants.json', 'infrastructure.json'),
    ('cities.json',       'cities.json'),
    ('rivers.json',       'rivers.json'),
]
for src_name, dst_name in copies:
    shutil.copy(os.path.join(misc_dir, src_name), os.path.join(PUBLIC_ASSETS, dst_name))
    print(f"  -> {dst_name} written")

print("Done!")
