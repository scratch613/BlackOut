# Regional Population Calculation

## Overview
This document explains how regional populations were calculated based on real city data from 2012.

## Methodology

### Data Sources
- **Cities**: `public/assets/cities.json` - 866 Ukrainian cities with lat/lon coordinates and population data (2012)
- **Oblasts**: `public/assets/ukraine_oblasts.geojson` - 27 Ukrainian regions/oblasts with geographic boundaries

### Calculation Process

1. **Geographic Mapping**: Each city was mapped to its oblast using point-in-polygon geographic calculations
2. **Population Aggregation**: City populations within each oblast were summed
3. **Multiplier Applied**: Total city population × 1.6 to account for rural population and smaller settlements not in the cities dataset

### Formula
```
Oblast Population = (Sum of all city populations in oblast) × 1.6
```

The 1.6 multiplier was chosen to account for:
- Rural populations
- Smaller towns and villages not included in the cities dataset
- Suburban areas around major cities

## Results

Total calculated population: **35,486,167**

### Top 5 Most Populous Regions
1. **м. Київ** (Kyiv City): 4,723,681
2. **Донецька** (Donetsk): 4,565,897
3. **Дніпропетровська** (Dnipropetrovsk): 3,753,958
4. **Харківська** (Kharkiv): 2,606,928
5. **Луганська** (Luhansk): 2,019,750

### Complete Regional Populations

| Oblast ID | Name | Cities | City Population | Final Population |
|-----------|------|--------|-----------------|------------------|
| cherkasy | Черкаська | 3 | 429,477 | 687,163 |
| chernihiv | Чернігівська | 3 | 426,917 | 683,067 |
| chernivtsi | Чернівецька | 1 | 266,650 | 426,640 |
| crimea | АРК Крим | 5 | 745,438 | 1,192,700 |
| dnipropetrovsk | Дніпропетровська | 8 | 2,346,224 | 3,753,958 |
| donetsk | Донецька | 15 | 2,853,686 | 4,565,897 |
| ivano_frankivsk | Івано-Франківська | 3 | 359,774 | 575,638 |
| kharkiv | Харківська | 4 | 1,629,330 | 2,606,928 |
| kherson | Херсонська | 2 | 343,239 | 549,182 |
| khmelnytskyi | Хмельницька | 3 | 414,055 | 662,488 |
| kirovohrad | Кіровоградська | 3 | 357,131 | 571,409 |
| kyiv_city | м. Київ | 1 | 2,952,301 | 4,723,681 |
| kyiv_oblast | Київська | 5 | 467,476 | 747,961 |
| luhansk | Луганська | 12 | 1,262,344 | 2,019,750 |
| lviv | Львівська | 4 | 927,228 | 1,483,564 |
| mykolaiv | Миколаївська | 3 | 587,251 | 939,601 |
| odesa | Одеська | 5 | 1,233,466 | 1,973,545 |
| poltava | Полтавська | 5 | 664,845 | 1,063,752 |
| rivne | Рівненська | 2 | 288,625 | 461,800 |
| sevastopol | м. Севастополь | 1 | 458,253 | 733,204 |
| sumy | Сумська | 5 | 527,560 | 844,096 |
| ternopil | Тернопільська | 1 | 217,326 | 347,721 |
| vinnytsia | Вінницька | 1 | 373,302 | 597,283 |
| volyn | Волинська | 3 | 344,105 | 550,568 |
| zakarpattia | Закарпатська | 2 | 200,436 | 320,697 |
| zaporizhzhia | Запорізька | 4 | 1,034,141 | 1,654,625 |
| zhytomyr | Житомирська | 4 | 468,281 | 749,249 |

## Implementation

The calculated populations are now used in [GameState.ts](../src/game/GameState.ts) via the `REGIONAL_POPULATIONS` constant. Each region's initial population is set from this data when the game starts.

## Script

The calculation script can be found at [calculate_populations.py](./calculate_populations.py). To regenerate the data:

```bash
cd misc
python3 calculate_populations.py
```

Requirements:
- Python 3.7+
- shapely library (`pip install shapely`)
