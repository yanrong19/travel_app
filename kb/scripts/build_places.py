"""Assemble the place tree: countries + official regions (from Wikidata) + the hand-curated travel regions
and planning units in kb/data/curated/*.txt. Curated places are matched to Wikidata for their ID,
coordinates and local-script name; doubtful matches are flagged for review.

Writes kb/data/places.csv, kb/data/place_links.csv and kb/data/match_report.csv."""
import csv
import re
import unicodedata
from pathlib import Path

from wd import entities, search

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

ORDER = ["FR", "ES", "US", "IT", "CN", "TR", "MX", "GB", "DE", "GR", "JP", "TH", "SG"]
COUNTRY_QID = {"FR": "Q142", "ES": "Q29", "US": "Q30", "IT": "Q38", "CN": "Q148", "TR": "Q43", "MX": "Q96", "GB": "Q145", "DE": "Q183", "GR": "Q41", "JP": "Q17", "TH": "Q869", "SG": "Q334"}
LOCAL_LANG = {"FR": "fr", "ES": "es", "US": "en", "IT": "it", "CN": "zh-hans", "TR": "tr", "MX": "es", "GB": "en", "DE": "de", "GR": "el", "JP": "ja", "TH": "th", "SG": "en"}
SEARCH_LANG = {"JP": "en", "CN": "en", "GR": "en", "TH": "en"}
NAME_FIX = {"CN": "China", "TR": "Türkiye"}

ADMIN_LEVEL = {"FR": "Région", "ES": "Autonomous community", "US": "State", "IT": "Region", "CN": "Province", "MX": "State", "GB": "Nation", "DE": "State", "GR": "Region", "JP": "Prefecture"}
CN_MUNICIPALITY = {"CN-BJ", "CN-SH", "CN-TJ", "CN-CQ"}
CN_AUTONOMOUS = {"CN-GX", "CN-NM", "CN-NX", "CN-XJ", "CN-XZ"}

# Starting zoom for the map, by kind of place; the knowledge base can override per row later.
ZOOM = {
    "Country": 4, "Region": 6, "Prefecture": 8, "Province": 6, "State": 6, "Région": 6, "Autonomous community": 7,
    "Nation": 6, "Municipality": 9, "Autonomous region": 5, "Federal district": 11, "Capital city": 10,
    "Area": 8, "Islands": 8, "Coast": 9, "Mountains": 10, "City": 11, "Town": 13, "Village": 14,
    "Hot-spring town": 13, "Island": 10, "National park": 9, "Countryside": 10, "Lakes": 10, "Ski area": 11,
    "Resort": 13, "Canyon": 10, "Trails": 9, "Valley": 10, "Archaeological site": 14, "River": 8, "Waterfalls": 12,
}
BIG_COUNTRIES = {"US": 3, "CN": 3, "MX": 4, "TR": 5, "FR": 5, "ES": 5, "IT": 5, "JP": 5, "DE": 5, "GB": 5, "GR": 6, "TH": 5, "SG": 11}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").upper()
    return s


def read_csv(name):
    with open(DATA / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_opts(text: str) -> dict:
    opts = {}
    for part in [p.strip() for p in text.split(";") if p.strip()]:
        k, _, v = part.partition("=")
        opts[k.strip()] = v.strip()
    return opts


def load():
    rows: dict[str, dict] = {}
    countries = {c["iso2"]: c for c in read_csv("countries.csv")}
    for iso in ORDER:
        c = countries[iso]
        rows[iso] = {
            "place_id": iso, "parent_id": "", "country_iso2": iso, "level_type": "Country", "kind": "admin",
            "name_en": NAME_FIX.get(iso, c["name_en"]), "name_local": c["name_local"], "is_planning_unit": "",
            "day_trip_from": "", "iso_3166_2": "", "wikidata": c["wikidata"], "osm_relation": c["osm_relation"],
            "lat": c["lat"], "lon": c["lon"], "notes": "", "source": "Wikidata", "status": "reviewed",
        }
    for a in read_csv("admin1.csv"):
        iso, code = a["country_iso2"], a["iso_3166_2"]
        level = ADMIN_LEVEL[iso]
        if code in CN_MUNICIPALITY:
            level = "Municipality"
        elif code in CN_AUTONOMOUS:
            level = "Autonomous region"
        elif code == "US-DC":
            level = "Federal district"
        elif code == "MX-CMX":
            level = "Capital city"
        rows[code] = {
            "place_id": code, "parent_id": iso, "country_iso2": iso, "level_type": level, "kind": "admin",
            "name_en": a["name_en"], "name_local": a["name_local"], "is_planning_unit": "", "day_trip_from": "",
            "iso_3166_2": code, "wikidata": a["wikidata"], "osm_relation": a["osm_relation"], "lat": a["lat"],
            "lon": a["lon"], "notes": "", "source": "Wikidata", "status": "reviewed",
        }

    links, pending_trips, marks = [], [], []
    for iso in ORDER:
        parent = None
        for raw in (DATA / "curated" / f"{iso}.txt").read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("= "):
                parent = line[2:].strip()
                assert parent in rows, f"{iso}: unknown parent {parent}"
                continue
            if line.startswith("A "):
                codes, _, target = line[2:].partition(">")
                for code in codes.split():
                    rows[code]["parent_id"] = target.strip()
                continue
            if line.startswith("M "):
                marks.append(line[2:].strip())
                continue
            kind, body = line[0], line[2:]
            parts = [p.strip() for p in body.split("|")]
            if kind == "R":
                rid, name, level, q = parts[0], parts[1], parts[2], (parts[3] if len(parts) > 3 else "")
                rows[rid] = {
                    "place_id": rid, "parent_id": parent, "country_iso2": iso, "level_type": level, "kind": "travel",
                    "name_en": name, "is_planning_unit": "", "day_trip_from": "", "notes": "", "_q": q or name,
                    "source": "Curated", "status": "draft",
                }
            elif kind == "P":
                name, level = parts[0], parts[1]
                opts = parse_opts(parts[2]) if len(parts) > 2 else {}
                pid = opts.get("id") or f"{iso}-P-{slug(name)}"
                assert pid not in rows, f"duplicate id {pid}"
                rows[pid] = {
                    "place_id": pid, "parent_id": parent, "country_iso2": iso, "level_type": level, "kind": "travel",
                    "name_en": name, "is_planning_unit": "yes", "day_trip_from": "", "notes": opts.get("note", ""),
                    "_q": opts.get("q") or name, "source": "Curated", "status": "draft",
                }
                if "trip" in opts:
                    pending_trips.append((pid, iso, opts["trip"]))
                for other in [x for x in opts.get("link", "").split(",") if x]:
                    links.append({"place_id": pid, "linked_place_id": other, "relation": "also in"})
            else:
                raise ValueError(f"{iso}: cannot read line {raw!r}")
    for pid in marks:
        rows[pid]["is_planning_unit"] = "yes"
    # A day trip starts from a base you'd stay in, so a planning unit wins over a same-named official region
    # ("Tokyo" the planning unit, not Tokyo prefecture).
    by_name = {}
    for r in sorted(rows.values(), key=lambda r: not r["is_planning_unit"]):
        by_name.setdefault((r["country_iso2"], r["name_en"]), r["place_id"])
    for pid, iso, trip in pending_trips:
        target = trip if trip in rows else by_name.get((iso, trip))
        assert target, f"{pid}: day trip base {trip!r} not found"
        rows[pid]["day_trip_from"] = target
    return rows, links


def coords(ent):
    for c in ent.get("claims", {}).get("P625", []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if v:
            return f"{v['latitude']:.5f}", f"{v['longitude']:.5f}"
    return "", ""


def claim_ids(ent, prop):
    out = []
    for c in ent.get("claims", {}).get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            out.append(v["id"])
    return out


def label(ent, lang):
    labels = ent.get("labels", {})
    for l in [lang, "zh", "en"] if lang.startswith("zh") else [lang]:
        if l in labels:
            return labels[l]["value"]
    return ""


def overrides():
    out = {}
    path = DATA / "curated" / "_overrides.txt"
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            parts = line.split()
            out[parts[0]] = (parts[1], parts[2] if len(parts) > 2 else None)
    return out


def apply_entity(r, qid, e, iso, coord_e=None):
    r["wikidata"] = qid
    r["lat"], r["lon"] = coords(e)
    if not r["lat"] and coord_e:
        r["lat"], r["lon"] = coords(coord_e)
    r["name_local"] = label(e, LOCAL_LANG[iso]) if LOCAL_LANG[iso] != "en" else ""
    osm = [c["mainsnak"].get("datavalue", {}).get("value") for c in e.get("claims", {}).get("P402", [])]
    r["osm_relation"] = osm[0] if osm and osm[0] else ""
    r["iso_3166_2"] = ""


def match(rows):
    report = []
    fixed = overrides()
    curated = [r for r in rows.values() if r["source"] == "Curated"]
    for r in curated:
        iso = r["country_iso2"]
        if r["place_id"] in fixed:
            qid, coord_qid = fixed[r["place_id"]]
            ents = entities([qid] + ([coord_qid] if coord_qid else []))
            e = ents.get(qid, {})
            apply_entity(r, qid, e, iso, ents.get(coord_qid) if coord_qid else None)
            report.append({
                "place_id": r["place_id"], "name_en": r["name_en"], "query": "(picked by hand)", "wikidata": qid,
                "wikidata_label": e.get("labels", {}).get("en", {}).get("value", ""),
                "wikidata_description": e.get("descriptions", {}).get("en", {}).get("value", ""),
                "why": "country + coordinates" if r["lat"] else "picked by hand, no coordinates",
            })
            continue
        # Search labels only match plain names, so try the hint, then without its qualifier, then the name.
        q = r["_q"]
        bare = re.sub(r"\s*\(.*?\)", "", q).split(",")[0].strip()
        tries = list(dict.fromkeys([q, bare, re.sub(r"\s*\(.*?\)", "", r["name_en"]).strip()]))
        chosen, why, ents = None, "no match", {}
        for t in tries:
            hits = search(t, SEARCH_LANG.get(iso, "en"), 15)
            ents = entities([h["id"] for h in hits]) if hits else {}
            for h in hits:
                e = ents.get(h["id"], {})
                if COUNTRY_QID[iso] in claim_ids(e, "P17") and coords(e)[0]:
                    chosen, why = h, "country + coordinates"
                    break
            if chosen:
                break
        if chosen:
            e = ents[chosen["id"]]
            r["wikidata"] = chosen["id"]
            r["lat"], r["lon"] = coords(e)
            r["name_local"] = label(e, LOCAL_LANG[iso]) if LOCAL_LANG[iso] != "en" else ""
            osm = [c["mainsnak"].get("datavalue", {}).get("value") for c in e.get("claims", {}).get("P402", [])]
            r["osm_relation"] = osm[0] if osm and osm[0] else ""
            r["iso_3166_2"] = ""
        else:
            r.update({"wikidata": "", "lat": "", "lon": "", "name_local": "", "osm_relation": "", "iso_3166_2": ""})
        report.append({
            "place_id": r["place_id"], "name_en": r["name_en"], "query": r["_q"], "wikidata": r.get("wikidata", ""),
            "wikidata_label": chosen.get("label", "") if chosen else "", "wikidata_description": chosen.get("description", "") if chosen else "",
            "why": why,
        })
    return report


def region_centres(rows):
    """Travel regions sit where their planning units are: Wikidata's point for the 'Andaman Sea' is out at sea,
    and a region's count bubble belongs over its places. Uses the mean of the planning units below it."""
    children = {}
    for r in rows.values():
        children.setdefault(r["parent_id"], []).append(r["place_id"])

    def units(pid):
        out = []
        for c in children.get(pid, []):
            if rows[c]["is_planning_unit"] and rows[c].get("lat"):
                out.append(rows[c])
            out.extend(units(c))
        return out

    for r in rows.values():
        if r["kind"] == "travel" and not r["is_planning_unit"]:
            pts = units(r["place_id"])
            if pts:
                r["lat"] = f"{sum(float(p['lat']) for p in pts) / len(pts):.5f}"
                r["lon"] = f"{sum(float(p['lon']) for p in pts) / len(pts):.5f}"


def finish(rows):
    def depth(pid):
        d, p = 0, rows[pid]["parent_id"]
        while p:
            d += 1
            p = rows[p]["parent_id"]
        return d

    def path(pid):
        names, p = [], pid
        while p:
            names.append(rows[p]["name_en"])
            p = rows[p]["parent_id"]
        return " › ".join(reversed(names))

    for pid, r in rows.items():
        r["depth"] = depth(pid)
        r["path"] = path(pid)
        r["slug"] = slug(r["name_en"]).lower()
        if r["level_type"] == "Country":
            r["default_zoom"] = BIG_COUNTRIES.get(r["country_iso2"], 5)
        else:
            r["default_zoom"] = ZOOM.get(r["level_type"], 9)
        r.pop("_q", None)


def main():
    rows, links = load()
    report = match(rows)
    region_centres(rows)
    for x in report:  # a region placed from its planning units has coordinates after all
        if x["why"] == "picked by hand, no coordinates" and rows[x["place_id"]].get("lat"):
            x["why"] = "country + coordinates"
    finish(rows)
    cols = ["place_id", "parent_id", "country_iso2", "depth", "level_type", "kind", "name_en", "name_local", "slug",
            "is_planning_unit", "day_trip_from", "iso_3166_2", "wikidata", "osm_relation", "lat", "lon", "default_zoom",
            "path", "notes", "source", "status"]
    ordered = sorted(rows.values(), key=lambda r: (ORDER.index(r["country_iso2"]), r["path"]))
    with open(DATA / "places.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(ordered)
    with open(DATA / "place_links.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["place_id", "linked_place_id", "relation"])
        w.writeheader()
        w.writerows(links)
    with open(DATA / "match_report.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(report[0]))
        w.writeheader()
        w.writerows(report)
    pu = sum(1 for r in rows.values() if r["is_planning_unit"])
    print(f"places {len(rows)}, planning units {pu}, links {len(links)}")
    print("needs check:", sum(1 for x in report if x["why"] != "country + coordinates"))


if __name__ == "__main__":
    main()
