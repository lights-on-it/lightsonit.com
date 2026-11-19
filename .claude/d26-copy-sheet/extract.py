import json, pathlib, re, sys
from html.parser import HTMLParser

site = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
BASE = "https://lightsonit.com/review/masthead/slate-dispatch/"
PAGES = [("index.html", "Home"), ("authors.html", "Authors"), ("books.html", "Books"),
         ("about.html", "About"), ("media.html", "Media"), ("contact.html", "Contact")]
VOID = {"img", "input", "br", "meta", "link", "hr", "source"}


class Walk(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.items, self.cur = [], [], None
        self.heading, self.htext = "", None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        node = (tag, set((a.get("class") or "").split()))
        if tag == "textarea" and a.get("data-need"):
            self.items.append({"id": a["data-need"], "text": a.get("placeholder", ""), "ctx": self.stack + [node], "near": self.heading})
        if tag in VOID:
            return
        self.stack.append(node)
        if tag in ("h1", "h2", "h3"):
            self.htext = ""
        if tag == "mark" and a.get("data-need"):
            self.cur = {"id": a["data-need"], "text": "", "ctx": list(self.stack[:-1]), "near": self.heading}

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag in ("h1", "h2", "h3") and self.htext is not None:
            t = re.sub(r"\s+", " ", self.htext).strip()
            if not t.startswith(("Praise for", "About ")):
                self.heading = t
            self.htext = None
        if tag == "mark" and self.cur:
            self.items.append(self.cur)
            self.cur = None
        while self.stack:
            t, _ = self.stack.pop()
            if t == tag:
                break

    def handle_data(self, data):
        if self.htext is not None:
            self.htext += data
        if self.cur is not None:
            self.cur["text"] += data


def has(ctx, tag=None, cls=None):
    return any((tag is None or t == tag) and (cls is None or cls in c) for t, c in ctx)


def describe(ctx, text):
    tag, cls = ctx[-1]
    if "working form" in text:
        return "Note for reviewers (no copy needed)"
    if tag == "textarea":
        return "Hint inside the message box"
    if has(ctx, "small") and has(ctx, cls="bt"):
        return "Line under the logo"
    if has(ctx, "footer"):
        if tag == "h4":
            return "Footer column heading"
        if has(ctx, cls="base"):
            return "Footer closing line"
        return "Footer description"
    if "eyebrow" in cls:
        return "Small label above a heading"
    if "tag" in cls:
        return "Small label at the top of a panel"
    if tag == "h1":
        return "Page headline"
    if tag == "h2":
        return "Banner headline" if has(ctx, cls="strip") else "Section headline"
    if tag == "h3":
        if has(ctx, cls="values"):
            return "Principle title"
        if has(ctx, cls="acard"):
            return "Card title"
        return "Subheading"
    if "lede" in cls:
        return "Intro paragraph under the headline"
    if has(ctx, cls="btn") or tag == "button":
        return "Button"
    if "role" in cls or "by" in cls:
        return "Role line under the name"
    if "ct" in cls:
        return "Title on a placeholder book cover"
    if "cby" in cls:
        return "Line under a placeholder cover title"
    if "meta" in cls:
        return "Note under the form" if has(ctx, "form") or has(ctx, cls="callout") and "form" in text.lower() else "Caption under the cover"
    if has(ctx, cls="acard"):
        return "Card text"
    if has(ctx, cls="values"):
        return "Principle text"
    if has(ctx, cls="strip"):
        return "Banner text"
    if "@" in text:
        return "Email address"
    if has(ctx, cls="section-head"):
        return "Section intro"
    if has(ctx, cls="prose"):
        return "Paragraph"
    return "Paragraph"


sections, seen_shared = [], {}
for fname, label in PAGES:
    w = Walk()
    w.feed((site / fname).read_text(encoding="utf-8"))
    rows = []
    for it in w.items:
        text = re.sub(r"\s+", " ", it["text"]).strip()
        what = describe(it["ctx"], text)
        near = it.get("near", "")
        heads = ("headline", "Card title", "Subheading", "label above", "Principle title")
        if near and not near.startswith("[") and not any(h in what for h in heads) and it["ctx"][-1][0] not in ("h1", "h2", "h3"):
            what += " (" + near + ")"
        row = {"id": it["id"], "what": what, "now": text.strip("[]"),
               "words": len(text.strip("[]").split())}
        if it["id"].startswith("Every page"):
            seen_shared.setdefault(it["id"], row)
        else:
            rows.append(row)
    rows.sort(key=lambda r: int(r["id"].split()[-1]))
    sections.append({"name": label, "url": BASE + fname, "rows": rows})

shared = sorted(seen_shared.values(), key=lambda r: int(r["id"].split()[-1]))
sections.insert(0, {"name": "Every page", "url": BASE + "index.html",
                    "note": "These appear in the header or footer of all six pages.", "rows": shared})
out.write_text(json.dumps(sections, indent=1, ensure_ascii=False), encoding="utf-8")
total = sum(len(s["rows"]) for s in sections)
print("total", total, {s["name"]: len(s["rows"]) for s in sections})
