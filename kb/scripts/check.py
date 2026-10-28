"""Integrity checks on kb/data/places.csv and the built workbook."""
import csv
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(ROOT / "data" / "places.csv", encoding="utf-8")))
links = list(csv.DictReader(open(ROOT / "data" / "place_links.csv", encoding="utf-8")))
ids = {r["place_id"]: r for r in rows}
problems = []

for r in rows:
    if r["parent_id"] and r["parent_id"] not in ids:
        problems.append(f"{r['place_id']}: parent {r['parent_id']} missing")
    if r["parent_id"] and ids[r["parent_id"]]["country_iso2"] != r["country_iso2"]:
        problems.append(f"{r['place_id']}: parent in another country")
    if r["day_trip_from"] and r["day_trip_from"] not in ids:
        problems.append(f"{r['place_id']}: day-trip base missing")
    if r["day_trip_from"] == r["place_id"]:
        problems.append(f"{r['place_id']}: day trip from itself")
    if not r["lat"] or not r["lon"]:
        problems.append(f"{r['place_id']}: no coordinates")
    else:
        lat, lon = float(r["lat"]), float(r["lon"])
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            problems.append(f"{r['place_id']}: coordinates out of range")
    if not r["wikidata"]:
        problems.append(f"{r['place_id']}: no Wikidata ID")
    if r["is_planning_unit"]:
        # nothing below a planning unit in v1
        if any(x["parent_id"] == r["place_id"] for x in rows):
            problems.append(f"{r['place_id']}: planning unit has children")
for l in links:
    if l["linked_place_id"] not in ids:
        problems.append(f"link {l['place_id']} -> {l['linked_place_id']} missing")

for r in rows:
    if r["day_trip_from"] and not ids[r["day_trip_from"]]["is_planning_unit"]:
        problems.append(f"{r['place_id']}: day-trip base {r['day_trip_from']} is not a planning unit")

KNOWN_SHARED = {"Q1037393", "Q1490"}  # Hokkaido region = prefecture; Tokyo planning unit ~ Tokyo prefecture
dupes = [q for q, n in Counter(r["wikidata"] for r in rows if r["wikidata"]).items() if n > 1 and q not in KNOWN_SHARED]
for q in dupes:
    problems.append(f"Wikidata {q} used by " + ", ".join(r["place_id"] for r in rows if r["wikidata"] == q))

# Each country: planning units reachable, depth range, and the 'Singapore' case
by_country = Counter(r["country_iso2"] for r in rows if r["is_planning_unit"])
depths = {}
for r in rows:
    if r["is_planning_unit"]:
        depths.setdefault(r["country_iso2"], set()).add(int(r["depth"]))

wb = load_workbook(ROOT / "fitline-places.xlsx")
print("sheets:", wb.sheetnames)
print("places sheet rows:", wb["places"].max_row - 1, "| countries:", wb["countries"].max_row - 1, "| links:", wb["place_links"].max_row - 1)
print("planning units by country:", dict(by_country))
print("planning-unit depths:", {k: sorted(v) for k, v in depths.items()})
print("statuses:", dict(Counter(r["status"] for r in rows)))
print("day trips:", sum(1 for r in rows if r["day_trip_from"]))
print(f"\n{len(problems)} problems")
for p in problems:
    print(" -", p)
