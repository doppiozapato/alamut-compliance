#!/usr/bin/env python3
"""Parse Alamut executed Firm policy PDFs into a single JSON for the dashboard.

Reads every PDF under a source directory (default
`../executed_policies_import` relative to the repo root) and writes a single
JSON file at `script/executedPoliciesData.json`.

Each entry contains:
  - title, slug, category, version, year, effective_date_label
  - source_filename, page_count
  - summary (first non-trivial paragraph, ~280 chars)
  - content (full text, headers/footers stripped)

The script depends only on the system `pdftotext` binary (poppler-utils).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = REPO_ROOT.parent / "executed_policies_import"
OUTPUT_JSON = REPO_ROOT / "script" / "executedPoliciesData.json"

# ─── Per-file metadata (title / category / year / effective date) ──────────
# Keyed by source filename. Year and effective_date_label come from the cover
# page of each PDF (provided by the firm) — we record them explicitly here so
# the dashboard surfaces the same labels the document itself carries.
FILE_META: dict[str, dict] = {
    "Alamut-Allocation-Policy.pdf": {
        "title": "Aggregation and Allocation Policy",
        "category": "Trading & Execution",
        "year": 2024,
        "effective_date_label": "2024",
        "version": "2024",
    },
    "Alamut-AML-Policy.pdf": {
        "title": "Anti-Money Laundering (AML) Policy",
        "category": "Financial Crime",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Cash-Controls-Policy.pdf": {
        "title": "Cash Controls Policy",
        "category": "Operations & Controls",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Conflicts-of-Interest-Policy.pdf": {
        "title": "Conflicts of Interest Policy",
        "category": "Governance",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Cybersecurity-Policy.pdf": {
        "title": "Cybersecurity Policy",
        "category": "IT & Information Security",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-DR-BCP-Policy.pdf": {
        "title": "Disaster Recovery & Business Continuity Policy",
        "category": "Operational Resilience",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Expert-Networks-Policy-May-2025-2.pdf": {
        "title": "Expert Networks Policy",
        "category": "Market Integrity",
        "year": 2025,
        "effective_date_label": "May 2025",
        "version": "May 2025",
    },
    "Alamut-IT-Security-Policy-3.pdf": {
        "title": "IT Security Policy",
        "category": "IT & Information Security",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Order-Execution-Policy-4.pdf": {
        "title": "Order Execution Policy",
        "category": "Trading & Execution",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Privacy-Notice.pdf": {
        "title": "Privacy Notice",
        "category": "Data Protection",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Remuneration-Policy-2.pdf": {
        "title": "Remuneration Policy",
        "category": "Governance",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Trade-Error-Policy-3.pdf": {
        "title": "Trade Error Policy",
        "category": "Trading & Execution",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
    "Alamut-Valuation-Policy.pdf": {
        "title": "Valuation Policy",
        "category": "Operations & Controls",
        "year": 2025,
        "effective_date_label": "2025",
        "version": "2025",
    },
}


# Recurring page chrome lines we always want to drop from the rendered body.
NOISE_PATTERNS = [
    re.compile(r"^\s*Alamut Investment Management LLP\s*$"),
    re.compile(
        r"^\s*P\s*R\s*I\s*V\s*A\s*T\s*E\s*&?\s*C\s*O\s*N\s*F\s*I\s*D\s*E\s*N\s*T\s*I\s*A\s*L\s*$",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*\d+\s*\|\s*P\s*a\s*g\s*e\s*$", re.IGNORECASE),
    re.compile(r"^\s*Page\s+\d+(\s+of\s+\d+)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*\d+\s*$"),  # page number alone
    re.compile(r"^Alamut Investment Management LLP\s*\|"),
    re.compile(r"^Registered Office:"),
    re.compile(r"^Alamut Investment Management LLP is a limited liability"),
    re.compile(r"^Partnership Number"),
    re.compile(r"^Authorised and regulated by the Financial Conduct Authority"),
]


def run_pdftotext(pdf: Path, layout: bool = False) -> str:
    args = ["pdftotext"]
    if layout:
        args.append("-layout")
    args += [str(pdf), "-"]
    return subprocess.check_output(args, text=True)


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s[:80] if s else "policy"


def page_count(pdf: Path) -> int:
    try:
        out = subprocess.check_output(["pdfinfo", str(pdf)], text=True)
        for line in out.splitlines():
            if line.startswith("Pages:"):
                return int(line.split(":", 1)[1].strip())
    except Exception:
        pass
    # Fallback — count form-feed chars in pdftotext output.
    return run_pdftotext(pdf, layout=False).count("\f") + 1


def clean_page(page: str) -> list[str]:
    out: list[str] = []
    for raw in page.splitlines():
        line = raw.rstrip()
        if any(p.match(line) for p in NOISE_PATTERNS):
            continue
        out.append(line)
    return out


def extract_text(pdf: Path) -> str:
    raw = run_pdftotext(pdf, layout=False)
    pages = raw.split("\f")
    cleaned_pages: list[str] = []
    for p in pages:
        lines = clean_page(p)
        if not any(l.strip() for l in lines):
            continue
        # Trim leading/trailing blanks per page.
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        if lines:
            cleaned_pages.append("\n".join(lines))
    body = "\n\n".join(cleaned_pages)
    # Collapse 3+ blank lines into one paragraph break.
    body = re.sub(r"\n{3,}", "\n\n", body)
    # Reflow paragraphs: lines inside a paragraph are joined with a single
    # space, but we keep paragraph breaks (blank lines) intact.
    paragraphs: list[str] = []
    for chunk in body.split("\n\n"):
        chunk = chunk.strip()
        if not chunk:
            continue
        # If a chunk contains short lines that look like a heading or list,
        # keep them separate. Otherwise join soft line breaks.
        if any(re.match(r"^[\-•\*\d+\.\)]+\s", l.strip()) for l in chunk.splitlines()):
            paragraphs.append(chunk)
        else:
            paragraphs.append(re.sub(r"\s*\n\s*", " ", chunk).strip())
    return "\n\n".join(paragraphs).strip()


def first_paragraph(text: str) -> str:
    # Pick the first paragraph that looks like prose: at least 80 chars, not
    # a title line, not a TOC/contents header, and at least one period — this
    # skips the cover page header (e.g. "AML Policy") and section headings.
    for chunk in text.split("\n\n"):
        s = re.sub(r"\s+", " ", chunk.strip())
        if not s:
            continue
        if re.match(r"^(table of contents|contents)\b", s, re.IGNORECASE):
            continue
        if len(s) < 80:
            continue
        if "." not in s:
            continue
        return s[:280]
    # Fallback: first non-empty paragraph regardless.
    for chunk in text.split("\n\n"):
        s = re.sub(r"\s+", " ", chunk.strip())
        if s:
            return s[:280]
    return ""


def fingerprint_meta(filename: str) -> dict:
    if filename in FILE_META:
        return dict(FILE_META[filename])
    # Best-effort fallback when an unexpected filename appears.
    base = filename.rsplit(".", 1)[0].replace("-", " ").strip()
    return {
        "title": base,
        "category": "Firm Policy",
        "year": datetime.now(timezone.utc).year,
        "effective_date_label": str(datetime.now(timezone.utc).year),
        "version": str(datetime.now(timezone.utc).year),
    }


def build_entry(pdf: Path) -> dict:
    meta = fingerprint_meta(pdf.name)
    text = extract_text(pdf)
    pages = page_count(pdf)
    return {
        "title": meta["title"],
        "slug": slugify(meta["title"]),
        "category": meta["category"],
        "year": meta["year"],
        "version": meta["version"],
        "effective_date_label": meta["effective_date_label"],
        "source_filename": pdf.name,
        "page_count": pages,
        "summary": first_paragraph(text),
        "content": text,
    }


def main(src_dir: Path, output: Path) -> None:
    if not src_dir.exists():
        sys.exit(f"Source directory not found: {src_dir}")
    pdfs = sorted(src_dir.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"No PDFs found under {src_dir}")
    entries = [build_entry(p) for p in pdfs]
    out = {
        "meta": {
            "title": "Alamut Executed Firm Policies",
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source_directory": str(src_dir),
            "policy_count": len(entries),
        },
        "policies": entries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    total_pages = sum(e["page_count"] for e in entries)
    print(
        f"Wrote {output} — {len(entries)} executed policies, {total_pages} pages total."
    )


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUTPUT_JSON
    main(src, out)
