"""List Wikidata candidates for places whose automatic match was wrong, to pick the right one by hand."""
import sys

from wd import entities, search

FIX = [
    ("FR-R-PROVENCE", "Provence"), ("ES-P-MONTSERRAT", "Montserrat"), ("ES-P-LEON", "León"), ("ES-P-IBIZA", "Ibiza"),
    ("US-R-SOCAL", "Southern California"), ("US-P-MAUI", "Maui"), ("US-P-HAWAII-ISLAND", "Hawaii island"),
    ("IT-P-BERGAMO", "Bergamo"), ("CN-P-WUZHEN", "Wuzhen"), ("CN-P-LUOYANG", "Luoyang"), ("CN-P-THREE-GORGES", "Three Gorges"),
    ("CN-P-HUANGSHAN", "Huangshan"), ("TR-R-MEDITERRANEAN", "Mediterranean Region"), ("TR-P-CANAKKALE", "Çanakkale"),
    ("TR-P-FETHIYE", "Fethiye"), ("TR-P-GAZIANTEP", "Gaziantep"), ("MX-P-PUEBLA", "Puebla de Zaragoza"), ("MX-P-TULUM", "Tulum"),
    ("MX-P-PLAYA-DEL-CARMEN", "Playa del Carmen"), ("MX-P-VALLADOLID", "Valladolid"), ("MX-P-SAN-MIGUEL-DE-ALLENDE", "San Miguel de Allende"),
    ("MX-P-BACALAR", "Bacalar"), ("MX-P-PALENQUE", "Palenque"), ("MX-P-TEQUILA", "Tequila"), ("GB-P-WINDSOR", "Windsor"),
    ("GB-P-OXFORD", "Oxford"), ("GR-P-MILOS", "Milos"), ("GR-P-AGIOS-NIKOLAOS-ELOUNDA", "Agios Nikolaos"), ("JP-R-SHIKOKU", "Shikoku"),
    ("TH-P-AYUTTHAYA", "Ayutthaya"), ("TH-P-KANCHANABURI", "Kanchanaburi"), ("TH-P-CHIANG-MAI", "Chiang Mai"),
    ("TH-P-CHIANG-RAI", "Chiang Rai"), ("GR-P-HYDRA", "Hydra"), ("JP-P-KISO-VALLEY", "Tsumago-juku"), ("JP-P-KISO-VALLEY", "Kiso Valley"),
    ("TH-P-PAI", "Pai"), ("TH-P-PAI", "Pai District"),
]

out = open(sys.argv[1], "w", encoding="utf-8")
for pid, q in FIX:
    hits = search(q, "en", 15)
    ents = entities([h["id"] for h in hits]) if hits else {}
    out.write(f"\n== {pid}  [{q}]\n")
    for h in hits[:12]:
        e = ents.get(h["id"], {})
        has_coord = "P625" in e.get("claims", {})
        cty = ",".join(c["mainsnak"].get("datavalue", {}).get("value", {}).get("id", "") for c in e.get("claims", {}).get("P17", []))
        out.write(f"  {h['id']:<11} {h.get('label','')[:34]:<34} | {h.get('description','')[:70]:<70} | {cty} | {'xy' if has_coord else '--'}\n")
out.close()
