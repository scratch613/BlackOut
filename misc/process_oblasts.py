#!/usr/bin/env python3
"""Map geoBoundaries shapeName → game-internal id + Ukrainian name."""
import json, os

PUBLIC_ASSETS = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')

# shapeName (English) → (id, Ukrainian name)
NAME_MAP = {
    "Cherkasy Oblast":          ("cherkasy",        "Черкаська"),
    "Chernihiv Oblast":         ("chernihiv",        "Чернігівська"),
    "Chernivtsi Oblast":        ("chernivtsi",       "Чернівецька"),
    "Dnipropetrovsk Oblast":    ("dnipropetrovsk",   "Дніпропетровська"),
    "Donetsk Oblast":           ("donetsk",          "Донецька"),
    "Ivano-Frankivsk Oblast":   ("ivano_frankivsk",  "Івано-Франківська"),
    "Kharkiv Oblast":           ("kharkiv",          "Харківська"),
    "Kherson Oblast":           ("kherson",          "Херсонська"),
    "Khmelnytskyi Oblast":      ("khmelnytskyi",     "Хмельницька"),
    "Kirovohrad Oblast":        ("kirovohrad",       "Кіровоградська"),
    "Kyiv Oblast":              ("kyiv_oblast",      "Київська"),
    "Kyiv City":                ("kyiv_city",        "м. Київ"),
    "Luhansk Oblast":           ("luhansk",          "Луганська"),
    "Lviv Oblast":              ("lviv",             "Львівська"),
    "Mykolaiv Oblast":          ("mykolaiv",         "Миколаївська"),
    "Odessa Oblast":            ("odesa",            "Одеська"),
    "Poltava Oblast":           ("poltava",          "Полтавська"),
    "Rivne Oblast":             ("rivne",            "Рівненська"),
    "Sumy Oblast":              ("sumy",             "Сумська"),
    "Ternopil Oblast":          ("ternopil",         "Тернопільська"),
    "Vinnytsia Oblast":         ("vinnytsia",        "Вінницька"),
    "Volyn Oblast":             ("volyn",            "Волинська"),
    "Zakarpattia Oblast":       ("zakarpattia",      "Закарпатська"),
    "Zaporizhzhia Oblast":      ("zaporizhzhia",     "Запорізька"),
    "Zaporizhia Oblast":        ("zaporizhzhia",     "Запорізька"),
    "Zhytomyr Oblast":          ("zhytomyr",         "Житомирська"),
    "Kyiv":                     ("kyiv_city",        "м. Київ"),
    "Sevastopol":               ("sevastopol",       "м. Севастополь"),
    "Sevastopol City":          ("sevastopol",       "м. Севастополь"),
    "Autonomous Republic of Crimea": ("crimea",      "АРК Крим"),
    "Republic of Crimea":       ("crimea",           "АРК Крим"),
}

with open(os.path.join(os.path.dirname(__file__), 'ukraine_oblasts_real.geojson')) as f:
    src = json.load(f)

features = []
seen_ids = set()
for feat in src['features']:
    shape_name = feat['properties'].get('shapeName', '')
    if shape_name not in NAME_MAP:
        print(f"  SKIP unknown: {shape_name!r}")
        continue
    (game_id, ua_name) = NAME_MAP[shape_name]
    if game_id in seen_ids:
        print(f"  SKIP duplicate id: {game_id} ({shape_name})")
        continue
    seen_ids.add(game_id)
    features.append({
        "type": "Feature",
        "properties": {"id": game_id, "name": ua_name},
        "geometry": feat['geometry'],
    })

out = {"type": "FeatureCollection", "features": features}
out_path = os.path.join(PUBLIC_ASSETS, 'ukraine_oblasts.geojson')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)

print(f"Written {len(features)} oblasts to {out_path}")
