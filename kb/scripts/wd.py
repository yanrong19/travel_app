"""Small Wikidata helpers for the knowledge-base build (SPARQL + entity search), with a disk cache."""
import hashlib
import json
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import requests  # noqa: E402

UA = {"User-Agent": "FitlineKB/0.1 (travel knowledge base research; contact: project owner)"}
CACHE = Path(__file__).resolve().parent.parent / ".cache"
CACHE.mkdir(exist_ok=True)


def _cached(key: str, fetch):
    path = CACHE / (hashlib.sha1(key.encode()).hexdigest() + ".json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    for attempt in range(8):
        try:
            data = fetch()
            time.sleep(1.0)
            if not data:
                # Throttled responses can come back empty: keep them out of the cache so the next run retries.
                return data
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        except requests.HTTPError as e:  # rate limit: wait as long as Wikidata asks, then retry
            if attempt == 7:
                raise
            wait = int(e.response.headers.get("Retry-After", 0) or 0) or 10 * (attempt + 1)
            print("rate limited, waiting", wait, "s")
            time.sleep(wait)
        except Exception as e:  # network hiccup: back off and retry
            if attempt == 7:
                raise
            time.sleep(3 * (attempt + 1))
            print("retry", attempt + 1, e)


def sparql(query: str):
    def fetch():
        r = requests.get(
            "https://query.wikidata.org/sparql",
            params={"query": query, "format": "json"},
            headers=UA,
            timeout=90,
        )
        r.raise_for_status()
        return r.json()["results"]["bindings"]

    return _cached("sparql:" + query, fetch)


def search(name: str, lang: str = "en", limit: int = 7):
    def fetch():
        r = requests.get(
            "https://www.wikidata.org/w/api.php",
            params={"action": "wbsearchentities", "search": name, "language": lang, "uselang": "en", "limit": limit, "format": "json", "type": "item"},
            headers=UA,
            timeout=60,
        )
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(body["error"].get("info", "Wikidata API error"))
        return body.get("search", [])

    return _cached(f"search:{lang}:{limit}:{name}", fetch)


def entities(qids: list[str]):
    """Labels (en + a few local languages), coordinates, sitelink count and P31 for up to 50 QIDs."""
    out = {}
    for i in range(0, len(qids), 50):
        chunk = qids[i : i + 50]

        def fetch(chunk=chunk):
            r = requests.get(
                "https://www.wikidata.org/w/api.php",
                params={"action": "wbgetentities", "ids": "|".join(chunk), "props": "labels|claims|sitelinks|descriptions", "languages": "en|ja|zh|zh-hans|fr|es|it|de|el|tr|th|ms", "format": "json"},
                headers=UA,
                timeout=90,
            )
            r.raise_for_status()
            return r.json().get("entities", {})

        out.update(_cached("ents:" + ",".join(chunk), fetch))
    return out


def val(b, k):
    return b[k]["value"] if k in b else ""
