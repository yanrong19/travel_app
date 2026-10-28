"""Pull official facts from Wikidata: the 13 Tier 1 countries, and the first-level official regions
used as a hierarchy level in each (prefectures, states, regions...). Writes kb/data/countries.csv and
kb/data/admin1.csv. Re-runnable; results are cached in kb/.cache."""
import csv
import re
from pathlib import Path

from wd import sparql, val

DATA = Path(__file__).resolve().parent.parent / "data"
DATA.mkdir(exist_ok=True)

# iso2: (Wikidata QID, local-name language, admin-1 ISO 3166-2 pattern or None when the country's first
# travel level is not an official one)
COUNTRIES = {
    "FR": ("Q142", "fr", r"^FR-(ARA|BFC|BRE|CVL|20R|GES|HDF|IDF|NOR|NAQ|OCC|PDL|PAC)$"),
    "ES": ("Q29", "es", r"^ES-(AN|AR|AS|CN|CB|CL|CM|CT|EX|GA|IB|RI|MD|MC|NC|PV|VC|CE|ML)$"),
    "US": ("Q30", "en", r"^US-(?!AS|GU|MP|PR|UM|VI)[A-Z]{2}$"),
    "IT": ("Q38", "it", r"^IT-(21|23|25|32|34|36|42|45|52|55|57|62|65|67|72|75|77|78|82|88)$"),
    "CN": ("Q148", "zh-hans", r"^CN-(?!TW|HK|MO)[A-Z]{2}$"),
    "TR": ("Q43", "tr", None),
    "MX": ("Q96", "es", r"^MX-[A-Z]{3}$"),
    "GB": ("Q145", "en", r"^GB-(ENG|SCT|WLS|NIR)$"),
    "DE": ("Q183", "de", r"^DE-[A-Z]{2}$"),
    "GR": ("Q41", "el", r"^GR-[A-M]$"),
    "JP": ("Q17", "ja", r"^JP-\d\d$"),
    "TH": ("Q869", "th", None),
    "SG": ("Q334", "en", None),
}


def countries():
    rows = []
    for iso2, (qid, lang, _) in COUNTRIES.items():
        q = f"""
        SELECT ?iso3 ?en ?local ?capLabel ?cur ?coord ?drive ?osm
          (GROUP_CONCAT(DISTINCT ?langCode; separator=",") AS ?langs)
        WHERE {{
          BIND(wd:{qid} AS ?c)
          OPTIONAL {{ ?c wdt:P298 ?iso3 }}
          OPTIONAL {{ ?c rdfs:label ?en FILTER(LANG(?en)="en") }}
          OPTIONAL {{ ?c rdfs:label ?local FILTER(LANG(?local)="{lang}") }}
          OPTIONAL {{ ?c wdt:P36 ?cap . ?cap rdfs:label ?capLabel FILTER(LANG(?capLabel)="en") }}
          OPTIONAL {{ ?c wdt:P38 ?curItem . ?curItem wdt:P498 ?cur }}
          OPTIONAL {{ ?c wdt:P625 ?coord }}
          OPTIONAL {{ ?c wdt:P1622 ?driveItem . ?driveItem rdfs:label ?drive FILTER(LANG(?drive)="en") }}
          OPTIONAL {{ ?c wdt:P402 ?osm }}
          OPTIONAL {{ ?c wdt:P37 ?l . ?l wdt:P218 ?langCode }}
        }} GROUP BY ?iso3 ?en ?local ?capLabel ?cur ?coord ?drive ?osm
        """
        b = sparql(q)
        first = b[0] if b else {}
        caps = sorted({val(x, "capLabel") for x in b if val(x, "capLabel")})
        curs = sorted({val(x, "cur") for x in b if val(x, "cur")})
        coord = val(first, "coord")
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", coord)
        rows.append(
            {
                "iso2": iso2,
                "iso3": val(first, "iso3"),
                "wikidata": qid,
                "name_en": val(first, "en"),
                "name_local": val(first, "local"),
                "capital": "; ".join(caps),
                "currency": "; ".join(curs),
                "languages": val(first, "langs"),
                "driving_side": val(first, "drive"),
                "osm_relation": val(first, "osm"),
                "lat": m.group(2) if m else "",
                "lon": m.group(1) if m else "",
            }
        )
        print(iso2, rows[-1]["name_en"], rows[-1]["capital"], rows[-1]["currency"])
    with open(DATA / "countries.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def admin1():
    rows = []
    for iso2, (qid, lang, pattern) in COUNTRIES.items():
        if not pattern:
            continue
        prefix = iso2 + "-"
        q = f"""
        SELECT ?item ?code ?en ?local ?coord ?osm ?links WHERE {{
          ?item wdt:P300 ?code .
          FILTER(STRSTARTS(?code, "{prefix}"))
          FILTER NOT EXISTS {{ ?item wdt:P576 ?ended }}
          OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en)="en") }}
          OPTIONAL {{ ?item rdfs:label ?local FILTER(LANG(?local)="{lang}") }}
          OPTIONAL {{ ?item wdt:P625 ?coord }}
          OPTIONAL {{ ?item wdt:P402 ?osm }}
          OPTIONAL {{ ?item wikibase:sitelinks ?links }}
        }}
        """
        best = {}
        for b in sparql(q):
            code = val(b, "code")
            if not re.match(pattern, code):
                continue
            links = int(val(b, "links") or 0)
            if code not in best or links > best[code]["_links"]:
                coord = val(b, "coord")
                m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", coord)
                best[code] = {
                    "country_iso2": iso2,
                    "iso_3166_2": code,
                    "wikidata": val(b, "item").rsplit("/", 1)[-1],
                    "name_en": val(b, "en"),
                    "name_local": val(b, "local"),
                    "lat": m.group(2) if m else "",
                    "lon": m.group(1) if m else "",
                    "osm_relation": val(b, "osm"),
                    "_links": links,
                }
        print(iso2, len(best))
        rows.extend(sorted(best.values(), key=lambda r: r["iso_3166_2"]))
    for r in rows:
        r.pop("_links")
    with open(DATA / "admin1.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    countries()
    admin1()
