#!/usr/bin/env python3
"""
Parse a quarterly Alamut Regulatory Updates DOCX into structured JSON.

Usage:
    python3 script/parseRegulatoryUpdatesDocx.py \
        /path/to/Alamut-<Quarter>-<Year>-Regulatory-Updates.docx \
        script/regulatoryUpdatesData.json

Output JSON shape:
    {
      "quarter": "Q1",
      "year": 2026,
      "label": "Q1 2026",
      "source_document": "Alamut-Q1-2026-Regulatory-Updates.docx",
      "imported_at": "2026-04-27T...Z",
      "updates": [
        {
          "section": "regulatory" | "enforcement",
          "date_published": "2026-01-09",
          "date_published_label": "9 January 2026",
          "category": "Enforcement / Market Conduct",
          "title": "FCA: Enforcement Activity and Fines",
          "body": "The FCA has updated its Fines webpage...",
          "effective_date": null | "2027-10-11" | "End-2026 (recommended)",
          "useful_links": [
            { "label": "2025 fines | FCA", "url": "https://..." }
          ]
        }, ...
      ]
    }

The parser walks word/document.xml directly (no python-docx dependency) and
reconstructs each table row's cell paragraphs by joining `w:t` runs with
single spaces. It then performs light, well-tested cleanup:
  • collapses soft line wraps that pandoc fragments into many w:t nodes
  • normalises curly punctuation
  • parses dates like "9th January 2026" / "22^nd^ January 2026" into ISO
  • extracts hyperlinks via word/_rels/document.xml.rels
The output is deterministic so the seed JSON is stable across re-runs.
"""

from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"w": W, "r": R}


def _text_with_links(
    elem: ET.Element, rels: dict[str, str]
) -> tuple[str, list[dict], list[tuple[int, int]]]:
    """Walk a paragraph/cell element, returning plain text, links, and the
    [start, end) character ranges for any text rendered in bold."""
    parts: list[str] = []
    links: list[dict] = []
    bold_ranges: list[tuple[int, int]] = []

    def _is_bold(run: ET.Element) -> bool:
        rpr = run.find(f"{{{W}}}rPr")
        if rpr is None:
            return False
        b = rpr.find(f"{{{W}}}b")
        if b is None:
            return False
        val = b.get(f"{{{W}}}val")
        return val is None or val.lower() not in {"0", "false", "off"}

    def walk(node: ET.Element, in_link: str | None) -> None:
        tag = node.tag.split("}", 1)[-1]
        if tag == "r":
            run_start = len("".join(parts))
            for child in node:
                walk(child, in_link)
            run_end = len("".join(parts))
            if _is_bold(node) and run_end > run_start:
                bold_ranges.append((run_start, run_end))
            return
        if tag == "t":
            parts.append(node.text or "")
            return
        if tag == "tab":
            parts.append("\t")
            return
        if tag == "br":
            parts.append("\n")
            return
        if tag == "p":
            for child in node:
                walk(child, in_link)
            parts.append("\n")
            return
        if tag == "hyperlink":
            rid = node.get(f"{{{R}}}id")
            href = rels.get(rid, "") if rid else ""
            label_start = len("".join(parts))
            for child in node:
                walk(child, href or in_link)
            label_end = len("".join(parts))
            label = "".join(parts)[label_start:label_end].strip()
            if href and label:
                links.append({"label": label, "url": href})
            return
        for child in node:
            walk(child, in_link)

    walk(elem, None)
    return "".join(parts), links, bold_ranges


def _normalise_text(s: str) -> str:
    # Collapse runs of whitespace within a line, but keep blank-line breaks.
    s = s.replace("\xa0", " ")
    s = s.replace("–", "-").replace("—", "—")
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace("“", '"').replace("”", '"')
    # Normalise newlines
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in s.split("\n")]
    # Collapse 3+ blank lines to 2
    out: list[str] = []
    blanks = 0
    for ln in lines:
        if not ln:
            blanks += 1
            if blanks <= 1:
                out.append("")
        else:
            blanks = 0
            out.append(ln)
    return "\n".join(out).strip()


_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_published_date(raw: str) -> tuple[str | None, str]:
    """Parse 'Date Published' cells like '9th January 2026' into (iso, label)."""
    s = _normalise_text(raw).replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    m = re.search(
        r"(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})",
        s,
        flags=re.IGNORECASE,
    )
    if not m:
        return None, s
    day = int(m.group(1))
    month_name = m.group(2).lower()
    year = int(m.group(3))
    month = _MONTHS.get(month_name)
    if not month:
        return None, s
    iso = f"{year:04d}-{month:02d}-{day:02d}"
    label = f"{day} {month_name.capitalize()} {year}"
    return iso, label


def parse_effective_date(raw: str) -> tuple[str | None, str | None]:
    """Return (iso, display) for the Effective Date cell.

    Many entries have free text ("End-2026 (recommended)" or "N/A"); we keep
    the original string in `display` and only return an ISO date when one is
    unambiguous (DD/MM/YYYY, D Month YYYY, etc).
    """
    s = _normalise_text(raw).replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if not s or s.upper() in {"N/A", "NA", "—", "-"}:
        return None, None
    # DD/MM/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}", s
    iso, label = parse_published_date(s)
    if iso:
        return iso, label
    return None, s


def _load_rels(z: zipfile.ZipFile) -> dict[str, str]:
    rels: dict[str, str] = {}
    try:
        with z.open("word/_rels/document.xml.rels") as f:
            tree = ET.parse(f)
    except KeyError:
        return rels
    for rel in tree.getroot().iter():
        tag = rel.tag.split("}", 1)[-1]
        if tag == "Relationship":
            rid = rel.get("Id")
            target = rel.get("Target", "")
            type_ = rel.get("Type", "")
            if rid and "hyperlink" in type_.lower() and target.startswith(("http://", "https://")):
                rels[rid] = target
    return rels


def _iter_tables(root: ET.Element):
    for tbl in root.iter(f"{{{W}}}tbl"):
        yield tbl


def _row_cells(
    tr: ET.Element, rels: dict[str, str]
) -> tuple[list[str], list[list[dict]], list[str | None]]:
    """Return (normalised cell text, hyperlinks per cell, leading-bold per cell)."""
    cells_text: list[str] = []
    cells_links: list[list[dict]] = []
    cells_lead_bold: list[str | None] = []
    for tc in tr.findall(f"{{{W}}}tc"):
        text, links, bold_ranges = _text_with_links(tc, rels)
        cells_text.append(_normalise_text(text))
        cells_links.append(links)
        cells_lead_bold.append(_extract_leading_bold(text, bold_ranges))
    return cells_text, cells_links, cells_lead_bold


def _extract_leading_bold(raw: str, bold_ranges: list[tuple[int, int]]) -> str | None:
    """Concatenate the first contiguous bold span (allowing tiny non-bold gaps)
    starting at the beginning of the cell. This isolates the title that the
    DOCX renders in bold above the body paragraphs.
    """
    if not bold_ranges:
        return None
    bold_ranges = sorted(bold_ranges)
    text = raw
    n = len(text)
    # Find the first bold range; ignore leading whitespace before it.
    pos = 0
    while pos < n and text[pos].isspace():
        pos += 1
    head = bold_ranges[0]
    if head[0] > pos + 4:  # title should be at the very top of the cell
        return None
    end = head[1]
    # Merge adjacent bold ranges separated only by whitespace/punctuation.
    for s, e in bold_ranges[1:]:
        between = text[end:s]
        if not between or between.strip(" \t-—:") == "":
            end = e
        else:
            break
    title = text[head[0]:end]
    title = _normalise_text(title).replace("\n", " ").strip(" :")
    return title or None


def _looks_like_header(cells: list[str]) -> bool:
    joined = " ".join(c.lower() for c in cells)
    return "date published" in joined and "category" in joined and "update" in joined


def _split_title_body(update_cell: str, bold_title: str | None = None) -> tuple[str, str]:
    """Split the Update cell into (title, body).

    The DOCX marks the title in bold; when we have it, strip exactly that
    prefix from the cell text and treat the rest as the body. Without a bold
    title (legacy / damaged DOCX), fall back to a paragraph split.
    """
    text = _normalise_text(update_cell)
    if not text:
        return "", ""
    if bold_title:
        # Walk forward through the cell text matching letters of `bold_title`
        # while skipping whitespace differences. Once exhausted, the remainder
        # is the body.
        title_norm = re.sub(r"\s+", "", bold_title)
        ti = 0
        i = 0
        n = len(text)
        body_start = None
        while i < n and ti < len(title_norm):
            if text[i].isspace():
                i += 1
                continue
            if text[i] == title_norm[ti]:
                ti += 1
                i += 1
                if ti == len(title_norm):
                    body_start = i
                    break
            else:
                # Mismatch; bail out to the fallback splitter.
                body_start = None
                break
        if body_start is not None:
            body = text[body_start:].lstrip(" :\n\t-—.")
            return bold_title.strip().rstrip(":"), _normalise_text(body)
    # Fallback: paragraph split.
    parts = text.split("\n\n", 1)
    title = parts[0].strip().rstrip(":")
    body = parts[1].strip() if len(parts) > 1 else ""
    if not body and "\n" in title:
        first, rest = title.split("\n", 1)
        title = first.strip()
        body = rest.strip()
    return title, body


def _dedupe_links(links: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for ln in links:
        url = ln.get("url", "").strip()
        label = ln.get("label", "").strip() or url
        if not url or url in seen:
            continue
        seen.add(url)
        out.append({"label": label, "url": url})
    return out


def parse_docx(path: str) -> dict:
    with zipfile.ZipFile(path) as z:
        rels = _load_rels(z)
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)
    root = tree.getroot()

    tables = list(_iter_tables(root))
    if not tables:
        raise SystemExit("No tables found in DOCX")

    updates: list[dict] = []

    # First table is the regulatory updates table; subsequent tables are
    # "Enforcement Cases" sections (4-column variant: no Effective Date).
    for table_idx, tbl in enumerate(tables):
        rows = list(tbl.findall(f"{{{W}}}tr"))
        if not rows:
            continue
        section = "regulatory" if table_idx == 0 else "enforcement"
        # Skip header rows.
        for tr in rows:
            cells, cell_links, cell_bold = _row_cells(tr, rels)
            if not cells or not any(cells):
                continue
            if _looks_like_header(cells):
                continue
            if section == "regulatory" and len(cells) >= 5:
                date_cell, cat_cell, upd_cell, eff_cell, _links_cell = cells[:5]
                links_for_row = cell_links[4] if len(cell_links) > 4 else []
                bold_title = cell_bold[2] if len(cell_bold) > 2 else None
                effective_iso, effective_display = parse_effective_date(eff_cell)
            elif section == "enforcement" and len(cells) >= 4:
                date_cell, cat_cell, upd_cell, _links_cell = cells[:4]
                eff_cell = ""
                links_for_row = cell_links[3] if len(cell_links) > 3 else []
                bold_title = cell_bold[2] if len(cell_bold) > 2 else None
                effective_iso, effective_display = None, None
            else:
                continue

            iso, label = parse_published_date(date_cell)
            if not iso:
                # Skip stray rows that don't look like updates.
                continue
            title, body = _split_title_body(upd_cell, bold_title)
            if not title:
                continue
            updates.append(
                {
                    "section": section,
                    "date_published": iso,
                    "date_published_label": label,
                    "category": _normalise_text(cat_cell) or None,
                    "title": title,
                    "body": body,
                    "effective_date": effective_iso,
                    "effective_date_label": effective_display,
                    "useful_links": _dedupe_links(links_for_row),
                }
            )

    # Detect quarter/year from filename, with body-date fallback.
    fname = os.path.basename(path)
    qm = re.search(r"Q([1-4])-(\d{4})", fname, flags=re.IGNORECASE)
    if qm:
        quarter = f"Q{qm.group(1)}"
        year = int(qm.group(2))
    else:
        # Fallback: derive from earliest update date.
        years = sorted({u["date_published"][:4] for u in updates if u.get("date_published")})
        months = sorted({int(u["date_published"][5:7]) for u in updates if u.get("date_published")})
        year = int(years[0]) if years else datetime.now().year
        if months:
            q = (months[0] - 1) // 3 + 1
            quarter = f"Q{q}"
        else:
            quarter = "Q1"

    # Stable sort: by section (regulatory first), then by date_published asc.
    updates.sort(key=lambda u: (0 if u["section"] == "regulatory" else 1, u["date_published"]))

    return {
        "quarter": quarter,
        "year": year,
        "label": f"{quarter} {year}",
        "source_document": fname,
        "imported_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updates": updates,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    docx_path = sys.argv[1]
    data = parse_docx(docx_path)
    if len(sys.argv) >= 3:
        out_path = sys.argv[2]
    else:
        # Default: script/regulatoryUpdates/<Q>-<YYYY>.json so multiple
        # quarters can coexist for the dropdown selector.
        out_dir = os.path.join("script", "regulatoryUpdates")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{data['quarter']}-{data['year']}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {out_path}: {len(data['updates'])} updates ({data['label']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
