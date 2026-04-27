#!/usr/bin/env python3
"""Parse the Alamut Compliance Manual PDF into structured JSON.

Output schema (written to script/manualData.json):

{
  "meta": { "title": "...", "version": "...", "page_count": N,
             "source_file": "...", "generated_at": "..." },
  "chapters": [
    {
      "number": "1",
      "title": "INTRODUCTION",
      "slug": "introduction",
      "start_page": 10,
      "end_page": 19,
      "summary": "...",                      # first paragraph
      "content": "<full chapter markdown>",
      "sections": [
        { "number": "1.1", "title": "Purpose",
          "page": 10, "content": "..." },
        ...
      ]
    },
    ...
    # Appendices appear with number "Appendix A" etc. and no nested sections.
  ]
}

The script depends only on the system `pdftotext` binary (poppler-utils), so it
runs in any environment that has poppler available — no Python PDF libraries
needed.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── Configuration ──────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PDF = REPO_ROOT.parent / "manual_import" / "Alamut-Compliance-Manual_SEP25.pdf"
OUTPUT_JSON = REPO_ROOT / "script" / "manualData.json"

# Recurring page chrome to scrub from body extraction.
NOISE_PATTERNS = [
    re.compile(r"^\s*Alamut Investment Management LLP\s*$"),
    re.compile(r"^\s*P\s*R\s*I\s*V\s*A\s*T\s*E\s*&\s*C\s*O\s*N\s*F\s*I\s*D\s*E\s*N\s*T\s*I\s*A\s*L\s*$",
               re.IGNORECASE),
    re.compile(r"^\s*\d+\s*\|\s*P\s*a\s*g\s*e\s*$", re.IGNORECASE),
    re.compile(r"^\s*Page\s+\d+(\s+of\s+\d+)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*September\s*$", re.IGNORECASE),
    # Footer block "Alamut Investment Management LLP | +44 ... | IR@... | alamut-im.com"
    re.compile(r"^Alamut Investment Management LLP\s*\|"),
    re.compile(r"^Registered Office:"),
    re.compile(r"^Alamut Investment Management LLP is a limited liability"),
    re.compile(r"^Partnership Number"),
    re.compile(r"^Authorised and regulated by the Financial Conduct Authority FRN"),
]

# Chapter heading on a body page: a numeric line followed by an uppercased title.
# e.g.  "1." then "INTRODUCTION"
CHAPTER_NUM_RE = re.compile(r"^(\d{1,2})\.\s*$")
APPENDIX_RE = re.compile(r"^Appendix\s+([A-Z])\s*[:\-]\s*(.+?)\s*$")

# Section heading: "1.1 Purpose" / "1.10 Brexit/EU Directives" — usually
# on its own line, followed by paragraph text on next line(s).
SECTION_HEADING_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})\s+(.{2,140})$")

# ─── Helpers ────────────────────────────────────────────────────────────────


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
    return s[:80] if s else "section"


def clean_lines(lines: list[str]) -> list[str]:
    """Drop recurring header/footer chrome and trailing whitespace."""
    out: list[str] = []
    for raw in lines:
        line = raw.rstrip()
        if any(p.match(line) for p in NOISE_PATTERNS):
            continue
        out.append(line)
    # collapse 3+ blank lines
    cleaned: list[str] = []
    blanks = 0
    for line in out:
        if line.strip() == "":
            blanks += 1
            if blanks <= 1:
                cleaned.append("")
        else:
            blanks = 0
            cleaned.append(line)
    # trim leading/trailing blanks
    while cleaned and cleaned[0] == "":
        cleaned.pop(0)
    while cleaned and cleaned[-1] == "":
        cleaned.pop()
    return cleaned


# ─── TOC parsing (chapter/appendix list with start pages) ──────────────────


def parse_toc(toc_text: str) -> list[dict]:
    """Walk the contents pages and return chapters + appendices in order.

    The TOC lines look like:
        1. INTRODUCTION ............ 10
            1.1     Purpose ........ 10
        Appendix A: SYSC Responsibilities Table ...... 166
    """
    chapters: list[dict] = []
    current: dict | None = None

    # Two-phase: first try dotted-leaders form, then fall back to greedy form
    # where the page number is the last whitespace-separated token.
    chap_dotted_re = re.compile(r"^\s*(\d{1,2})\.\s+(.+?)\s*\.{2,}\s*(\d{1,3})\s*$")
    chap_greedy_re = re.compile(r"^\s*(\d{1,2})\.\s+(.+\S)\s+(\d{1,3})\s*$")
    chap_no_page_re = re.compile(r"^\s*(\d{1,2})\.\s+(.+?)\s*$")
    sec_dotted_re = re.compile(r"^\s*(\d{1,2}\.\d{1,2})\s+(.+?)\s*\.{2,}\s*(\d{1,3})\s*$")
    sec_greedy_re = re.compile(r"^\s*(\d{1,2}\.\d{1,2})\s+(.+\S)\s+(\d{1,3})\s*$")
    sec_no_page_re = re.compile(r"^\s*(\d{1,2}\.\d{1,2})\s+(.+?)\s*$")
    app_dotted_re = re.compile(r"^\s*Appendix\s+([A-Z])\s*[:\-]\s*(.+?)\s*\.{2,}\s*(\d{1,3})\s*$")
    app_greedy_re = re.compile(r"^\s*Appendix\s+([A-Z])\s*[:\-]\s*(.+\S)\s+(\d{1,3})\s*$")
    only_page_re = re.compile(r"^\s*(\d{1,3})\s*$")

    pending: dict | None = None  # holds last header that lacked a trailing page no.

    raw_lines = toc_text.splitlines()
    i = 0
    while i < len(raw_lines):
        line = raw_lines[i].strip()
        i += 1
        if not line:
            continue

        # If the previous header was missing its page number, the next pure
        # numeric line (possibly preceded by extra whitespace lines) is it.
        if pending and only_page_re.match(line):
            pending["start_page"] = int(line)
            chapters.append(pending)
            current = pending
            pending = None
            continue

        m = app_dotted_re.match(line) or app_greedy_re.match(line)
        if m:
            letter, title, page = m.groups()
            chapters.append({
                "kind": "appendix",
                "number": f"Appendix {letter}",
                "title": re.sub(r"\.+$", "", title).strip(),
                "start_page": int(page),
                "sections": [],
            })
            current = chapters[-1]
            continue

        m = chap_dotted_re.match(line) or chap_greedy_re.match(line)
        if m:
            num, title, page = m.groups()
            title = re.sub(r"\.+$", "", title).strip()
            chapters.append({
                "kind": "chapter",
                "number": num,
                "title": title,
                "start_page": int(page),
                "sections": [],
            })
            current = chapters[-1]
            continue

        m = chap_no_page_re.match(line)
        if m and not sec_no_page_re.match(line):
            num, title = m.groups()
            if "." not in num:
                pending = {
                    "kind": "chapter",
                    "number": num,
                    "title": re.sub(r"\.+$", "", title).strip(),
                    "start_page": 0,
                    "sections": [],
                }
                continue

        m = sec_dotted_re.match(line) or sec_greedy_re.match(line)
        if m and current and current["kind"] == "chapter":
            sec_num, title, page = m.groups()
            sec_chap = sec_num.split(".")[0]
            if sec_chap == current["number"]:
                current["sections"].append({
                    "number": sec_num,
                    "title": re.sub(r"\.+", "", title).strip(),
                    "page": int(page),
                })
            continue

    return chapters


# ─── Body extraction (chapter/section content) ─────────────────────────────


def split_body_by_chapter(pages: list[str], chapters: list[dict]) -> None:
    """For each chapter, pull body text using start_page → next chapter's start_page-1."""
    # Compute end_page for each chapter (exclusive of next chapter's start).
    for i, ch in enumerate(chapters):
        end = chapters[i + 1]["start_page"] - 1 if i + 1 < len(chapters) else len(pages)
        ch["end_page"] = end

    for ch in chapters:
        # PDF page index is 1-based; pages[] is 0-based.
        start_idx = max(ch["start_page"] - 1, 0)
        end_idx = min(ch["end_page"], len(pages))
        body_pages = pages[start_idx:end_idx]
        # Tag each line with its source page so section extraction can
        # record an accurate page anchor.
        tagged: list[tuple[int, str]] = []
        for offset, page_text in enumerate(body_pages):
            page_no = start_idx + offset + 1
            for line in page_text.splitlines():
                tagged.append((page_no, line))

        cleaned_pairs = [(p, l) for p, l in tagged if not any(rp.match(l.rstrip()) for rp in NOISE_PATTERNS)]
        # Strip leading/trailing blank lines.
        while cleaned_pairs and cleaned_pairs[0][1].strip() == "":
            cleaned_pairs.pop(0)
        while cleaned_pairs and cleaned_pairs[-1][1].strip() == "":
            cleaned_pairs.pop()

        ch["_lines"] = cleaned_pairs


def extract_chapter_content(ch: dict) -> None:
    """Convert tagged lines into chapter content + per-section content."""
    lines: list[tuple[int, str]] = ch.pop("_lines", [])
    if ch["kind"] == "appendix":
        body, _swallowed = drop_chapter_heading(lines, ch)
        ch["content"] = lines_to_markdown(body, heading_level=2, leading_title=ch["title"])
        ch["summary"] = first_paragraph(body)
        ch["sections"] = []
        return

    body, swallowed = drop_chapter_heading(lines, ch)
    if swallowed:
        # Re-inject swallowed section markers at the head of the body so the
        # section detector still recognises section starts buried in the heading.
        body = swallowed + [(swallowed[-1][0], "")] + body

    # Build a TOC map for *this* chapter so we can match split-line section
    # headings like "1.1\n\nPurpose" robustly. Keys are normalized titles.
    toc_by_number = {s["number"]: s["title"] for s in ch["sections"]}

    sections: list[dict] = []
    cur_sec: dict | None = None
    cur_lines: list[tuple[int, str]] = []
    preamble: list[tuple[int, str]] = []
    sec_num_only_re = re.compile(rf"^({re.escape(ch['number'])}\.\d{{1,2}})\s*$")

    i = 0
    while i < len(body):
        page_no, line = body[i]
        stripped = line.strip()

        # Single-line section header "1.1 Purpose".
        m_inline = SECTION_HEADING_RE.match(stripped)
        if m_inline and m_inline.group(1) == ch["number"]:
            sec_num = f"{m_inline.group(1)}.{m_inline.group(2)}"
            if sec_num in toc_by_number:
                if cur_sec is not None:
                    cur_sec["content"] = lines_to_markdown(cur_lines)
                    sections.append(cur_sec)
                cur_sec = {
                    "number": sec_num,
                    "title": m_inline.group(3).strip().rstrip(":"),
                    "page": page_no,
                }
                cur_lines = []
                i += 1
                continue

        # Split-line: "1.1\n\nPurpose" or "Purpose\n\n1.1" — number on its own
        # line, title on the next or previous non-blank line. Match title
        # against the TOC entry for that section number.
        m_split = sec_num_only_re.match(stripped)
        if m_split:
            sec_num = m_split.group(1)
            if sec_num in toc_by_number:
                expected = toc_by_number[sec_num].strip().rstrip(":")
                # Look ahead for the title — skip blanks and stray glyph-only lines.
                def _is_glyph_line(s: str) -> bool:
                    t = s.strip()
                    if not t:
                        return True
                    # Lines that are only non-alphanumeric / control / PUA glyphs.
                    return all(not ch.isalnum() for ch in t) and len(t) <= 4
                j = i + 1
                while j < len(body) and _is_glyph_line(body[j][1]):
                    j += 1
                ahead = body[j][1].strip().rstrip(":") if j < len(body) else ""
                # Look back at the most recent non-blank line we already
                # consumed into the current section/preamble.
                back_idx = len(cur_lines) - 1 if cur_sec is not None else len(preamble) - 1
                back_buf = cur_lines if cur_sec is not None else preamble
                while back_idx >= 0 and back_buf[back_idx][1].strip() == "":
                    back_idx -= 1
                back = back_buf[back_idx][1].strip().rstrip(":") if back_idx >= 0 else ""

                used_back = False
                title_used: str | None = None
                if _title_matches(ahead, expected):
                    title_used = ahead
                    advance_to = j + 1
                elif _title_matches(back, expected):
                    title_used = back
                    used_back = True
                    advance_to = i + 1
                else:
                    advance_to = None

                if title_used is not None:
                    if used_back:
                        # Pop the title line (and any blanks before it) from the
                        # buffer where it currently lives.
                        del back_buf[back_idx:]
                    if cur_sec is not None:
                        cur_sec["content"] = lines_to_markdown(cur_lines)
                        sections.append(cur_sec)
                    cur_sec = {
                        "number": sec_num,
                        "title": title_used,
                        "page": page_no,
                    }
                    cur_lines = []
                    i = advance_to
                    continue

        if cur_sec is None:
            preamble.append((page_no, line))
        else:
            cur_lines.append((page_no, line))
        i += 1

    if cur_sec is not None:
        cur_sec["content"] = lines_to_markdown(cur_lines)
        sections.append(cur_sec)

    # If the TOC listed sections we did not detect inline, fall back to
    # synthesising empty placeholders so the dashboard always reflects the
    # advertised structure.
    detected_numbers = {s["number"] for s in sections}
    for toc_sec in ch["sections"]:
        if toc_sec["number"] not in detected_numbers:
            sections.append({
                "number": toc_sec["number"],
                "title": toc_sec["title"],
                "page": toc_sec["page"],
                "content": "",
            })
    sections.sort(key=lambda s: tuple(int(p) for p in s["number"].split(".")))

    ch["sections"] = sections
    intro_md = lines_to_markdown(preamble) if preamble else ""
    chapter_body_md = intro_md
    for s in sections:
        chapter_body_md += f"\n\n## {s['number']} {s['title']}\n\n{s['content']}".rstrip()
    ch["content"] = chapter_body_md.strip()
    ch["summary"] = first_paragraph(preamble) if preamble else (
        first_paragraph_str(sections[0]["content"]) if sections else ""
    )


def drop_chapter_heading(lines: list[tuple[int, str]], ch: dict) -> tuple[list[tuple[int, str]], list[tuple[int, str]]]:
    """Remove the chapter title block.

    Returns (body_lines, swallowed_section_markers) where swallowed markers
    are section-number-only lines (e.g. "13.1") that appeared inside the
    chapter heading region — we re-inject them at the start of the body so
    the section detector still sees them.
    """
    chapter_num_label = ch["number"] + "." if ch["kind"] == "chapter" else None
    appendix_label = ch["number"] if ch["kind"] == "appendix" else None

    norm = lambda s: re.sub(r"[^A-Z0-9]+", "", s.upper())
    needle = norm(ch["title"])
    if not needle:
        return lines, []

    end_drop_at = None
    matched = ""
    started = False
    swallowed: list[tuple[int, str]] = []
    sec_num_inline = re.compile(rf"^{re.escape(ch['number'])}\.\d+\s*$") if chapter_num_label else None

    for idx, (page_no, line) in enumerate(lines):
        stripped = line.strip()
        if not started:
            if chapter_num_label and stripped == chapter_num_label:
                started = True
                continue
            if appendix_label and stripped.startswith(appendix_label):
                started = True
                continue
            continue
        if stripped == "":
            if matched and norm(matched) == needle:
                end_drop_at = idx
                break
            continue
        if sec_num_inline and sec_num_inline.match(stripped):
            swallowed.append((page_no, line))
            continue
        matched += stripped
        if norm(matched) == needle or norm(matched).startswith(needle):
            end_drop_at = idx
            break
        if len(matched) > len(needle) + 200:
            end_drop_at = idx - 1
            break

    if end_drop_at is None:
        return lines, []
    body = lines[end_drop_at + 1:]
    return body, swallowed


def _looks_like_section(stripped: str) -> bool:
    """Loose check: short line starting with N.M followed by Title-Cased text."""
    return bool(SECTION_HEADING_RE.match(stripped)) and len(stripped) <= 140


def _title_matches(candidate: str, expected: str) -> bool:
    """Loose comparison ignoring case, punctuation, and whitespace."""
    norm = lambda s: re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
    a, b = norm(candidate), norm(expected)
    if a == b:
        return True
    # Allow either side to be a prefix of the other (handles wrapped TOC titles).
    if a and b and (a.startswith(b[:30]) or b.startswith(a[:30])):
        return True
    return False


def lines_to_markdown(lines: list[tuple[int, str]], heading_level: int = 3,
                      leading_title: str | None = None) -> str:
    """Convert raw line list into reflowed markdown paragraphs and bullets."""
    if not lines:
        return ""
    text_lines = [l for _, l in lines]
    cleaned = clean_lines(text_lines)
    paras: list[str] = []
    buf: list[str] = []

    def flush():
        nonlocal buf
        if buf:
            joined = " ".join(s.strip() for s in buf if s.strip())
            joined = re.sub(r"\s+", " ", joined).strip()
            if joined:
                paras.append(joined)
            buf = []

    for line in cleaned:
        stripped = line.strip()
        if not stripped:
            flush()
            continue
        # Bulleted list patterns: " ", "•", "-", " ", numeric "1." with following text
        if re.match(r"^[•\-\*]\s+", stripped) or re.match(r"^[a-z]\)\s+", stripped):
            flush()
            paras.append("- " + re.sub(r"^[•\-\*]\s+|^[a-z]\)\s+", "", stripped))
            continue
        buf.append(stripped)
    flush()
    md = "\n\n".join(paras)
    if leading_title:
        md = f"{'#' * heading_level} {leading_title}\n\n{md}"
    return md.strip()


def first_paragraph(lines: list[tuple[int, str]]) -> str:
    if not lines:
        return ""
    cleaned = clean_lines([l for _, l in lines])
    buf: list[str] = []
    for line in cleaned:
        if line.strip():
            buf.append(line.strip())
        elif buf:
            break
    summary = " ".join(buf)
    summary = re.sub(r"\s+", " ", summary).strip()
    return summary[:280]


def first_paragraph_str(s: str) -> str:
    para = s.split("\n\n", 1)[0]
    para = re.sub(r"\s+", " ", para).strip()
    return para[:280]


# ─── Main ───────────────────────────────────────────────────────────────────


def derive_fca_refs(text: str) -> list[str]:
    """Heuristic FCA module tagging based on substring search."""
    keys = [
        "PRIN", "SYSC", "COBS", "CASS", "MAR", "FUND", "COLL", "FCG",
        "FCTR", "DISP", "SUP", "MIFIDPRU", "TC", "COCON", "FIT", "APER",
        "CTPS", "ESG", "EMIR", "AIFMD", "MiFID", "UCITS", "CONC", "PERG",
    ]
    found: list[str] = []
    upper = text.upper()
    for key in keys:
        if re.search(rf"\b{re.escape(key.upper())}\b", upper):
            found.append("MiFID" if key == "MiFID" else key)
    # de-dupe preserving order
    seen = set()
    out: list[str] = []
    for k in found:
        if k.upper() not in seen:
            seen.add(k.upper())
            out.append(k)
    return out


def derive_tags(title: str, content: str) -> list[str]:
    t = (title + " " + content).lower()
    tags: list[str] = []
    rules = [
        ("market-abuse", ["market abuse", "insider"]),
        ("aml", ["money laundering", "aml ", "kyc"]),
        ("sanctions", ["sanctions"]),
        ("conflicts", ["conflict of interest", "conflicts of interest"]),
        ("smcr", ["senior managers", "smcr", "certification regime"]),
        ("training", ["training", "competence"]),
        ("reporting", ["regdata", "regulatory reporting", "annex iv"]),
        ("client-assets", ["client money", "cass", "safeguarding"]),
        ("complaints", ["complaint"]),
        ("conduct", ["conduct of business"]),
        ("op-res", ["operational resilience"]),
        ("esg", ["esg", "sustainability", "tcfd"]),
        ("emir", ["emir"]),
        ("inducements", ["inducement", "research budget", "rpa"]),
        ("pa-dealing", ["personal account dealing", "pa dealing"]),
    ]
    for tag, needles in rules:
        if any(n in t for n in needles):
            tags.append(tag)
    return tags


def main(pdf_path: Path, output: Path) -> None:
    layout_raw = run_pdftotext(pdf_path, layout=True)
    layout_pages = layout_raw.split("\f")

    # Use layout output for both the contents pages (clean dotted leaders) and
    # the body (keeps "3.3   Title" on one line for left-gutter headings).
    toc_text = "\n".join(layout_pages[2:9])
    chapters = parse_toc(toc_text)
    if not chapters:
        sys.exit("No chapters parsed from TOC; aborting.")

    split_body_by_chapter(layout_pages, chapters)

    for ch in chapters:
        extract_chapter_content(ch)

    # Decorate with FCA refs / tags / order.
    for idx, ch in enumerate(chapters, start=1):
        ch["order_index"] = idx
        ch["slug"] = slugify(f"{ch['number']}-{ch['title']}")
        ch["fca_refs"] = derive_fca_refs(ch["content"])
        ch["tags"] = derive_tags(ch["title"], ch["content"])

    out = {
        "meta": {
            "title": "Alamut Compliance Manual",
            "version": "September 2025",
            "page_count": len(layout_pages),
            "source_file": pdf_path.name,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "chapters": [
            {
                "kind": ch["kind"],
                "number": ch["number"],
                "title": ch["title"],
                "slug": ch["slug"],
                "order_index": ch["order_index"],
                "start_page": ch["start_page"],
                "end_page": ch["end_page"],
                "summary": ch["summary"],
                "content": ch["content"],
                "fca_refs": ch["fca_refs"],
                "tags": ch["tags"],
                "sections": ch["sections"],
            }
            for ch in chapters
        ],
    }

    output.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    n_secs = sum(len(c["sections"]) for c in chapters)
    print(f"Wrote {output} — {len(chapters)} chapters, {n_secs} sections.")


if __name__ == "__main__":
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUTPUT_JSON
    if not pdf.exists():
        sys.exit(f"PDF not found: {pdf}")
    main(pdf, out)
