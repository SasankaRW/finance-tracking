"""Cut Material Symbols Rounded down to the icons the app uses, so it ships a few KB instead of 5.4 MB.

    pip install fonttools brotli
    python scripts/icons.py      (from the repo root, after npm ci; writes src/fonts/material-symbols-rounded.woff2)

Run it again after using a new icon. Names are harvested from every string literal in src (the icons.tsx shim, <Symbol name>, <Icon name>) and every CSS
`content: "..."` in src that is a Material Symbols name (plus EXTRA below for names built at run time), so a new
icon in the shim or a page is picked up on its own.
The font is pinned to weight 500, grade 0, 24 px optical size and keeps the FILL axis (0 outlined, 1 filled).
"""

import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parents[1]
SRC = HERE / "node_modules" / "material-symbols" / "material-symbols-rounded.woff2"
OUT = HERE / "src" / "fonts" / "material-symbols-rounded.woff2"
EXTRA: list[str] = []  # icon names the code builds at run time (none today)

font = TTFont(SRC)
rev: dict[str, str] = {}
for code, glyph in sorted(font.getBestCmap().items()):
    rev.setdefault(glyph, chr(code).lower())  # 'A' and 'a' share a glyph
# Every icon is a ligature of its name's letters; map each name to the glyph it turns into.
lig_of: dict[str, str] = {}
for lookup in font["GSUB"].table.LookupList.Lookup:
    for st in lookup.SubTable:
        st = getattr(st, "ExtSubTable", st)
        for first, ligs in getattr(st, "ligatures", {}).items():
            for lig in ligs:
                lig_of.setdefault("".join(rev.get(g, "?") for g in [first, *lig.Component]), lig.LigGlyph)

found: set[str] = set(EXTRA)
for f in [*(HERE / "src").rglob("*.ts"), *(HERE / "src").rglob("*.tsx")]:
    found |= set(re.findall(r"""['"`]([a-z][a-z0-9_]*)['"`]""", f.read_text(encoding="utf-8")))
for f in (HERE / "src").rglob("*.css"):
    found |= set(re.findall(r"""content:\s*["']([a-z][a-z0-9_]*)["']""", f.read_text(encoding="utf-8")))
names = sorted(n for n in found if n in lig_of)
bad = [n for n in EXTRA if n not in lig_of]
assert not bad, f"not in Material Symbols: {bad}"

chars = sorted({c for n in names for c in n})
opts = subset.Options()
opts.layout_features = ["rlig", "rclt", "liga"]
opts.layout_closure = False  # only the ligatures asked for, not every icon spelled with the same letters
opts.notdef_outline = False
sub = subset.Subsetter(opts)
sub.populate(glyphs=sorted(lig_of[n] for n in names), unicodes=[ord(c) for c in chars])
sub.subset(font)
font = instancer.instantiateVariableFont(font, {"wght": 500, "GRAD": 0, "opsz": 24})
font.flavor = "woff2"
font.recalcTimestamp = False  # the same names give the same file
font.save(OUT)
(HERE / "scripts" / "icons.txt").write_text("\n".join(names) + "\n", encoding="utf-8")
print(f"{len(names)} icons -> {OUT.relative_to(HERE)} ({OUT.stat().st_size // 1024} KB); list in scripts/icons.txt", file=sys.stderr)
