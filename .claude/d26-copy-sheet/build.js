const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, HeadingLevel, ExternalHyperlink, LevelFormat, AlignmentType, Footer, PageNumber,
  HeightRule, TableLayoutType,
} = require("docx");

const [, , itemsPath, outPath] = process.argv;
const sections = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const total = sections.reduce((n, s) => n + s.rows.length, 0);

const FONT = "Arial";
const INK = "23262B", MUTED = "66625B", SLATE = "3E4C59", HAIR = "DAD2C4", FILL = "FFF8D6", ID_BG = "F1EEE7";
const COLS = [1300, 2000, 3080, 3700];
const W = COLS.reduce((a, b) => a + b, 0);
const SITE = "https://lightsonit.com/review/";

const border = { style: BorderStyle.SINGLE, size: 4, color: HAIR };
const borders = { top: border, bottom: border, left: border, right: border };
const pad = { top: 90, bottom: 90, left: 110, right: 110 };

function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: opts.after ?? 120 }, ...opts.para, children: [new TextRun({ text, font: FONT, size: opts.size ?? 21, color: opts.color ?? INK, bold: opts.bold, italics: opts.italics })] });
}

function cell(children, width, shade) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders, margins: pad,
    shading: shade ? { fill: shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    children,
  });
}

function headerRow() {
  const labels = ["Number", "What it is", "Stand-in now", "Your copy"];
  return new TableRow({
    tableHeader: true, cantSplit: true,
    children: labels.map((t, i) => cell([new Paragraph({ children: [new TextRun({ text: t, font: FONT, size: 18, bold: true, color: "FFFFFF" })] })], COLS[i], SLATE)),
  });
}

function lengthNote(r) {
  if (r.what.startsWith("Note for reviewers")) return "Leave blank, or write Cut.";
  if (r.words <= 3) return "A few words";
  return `About ${r.words} words`;
}

function row(r) {
  const minH = r.words > 15 ? 1100 : r.words > 5 ? 760 : 520;
  return new TableRow({
    cantSplit: true,
    height: { value: minH, rule: HeightRule.ATLEAST },
    children: [
      cell([new Paragraph({ children: [new TextRun({ text: r.id, font: FONT, size: 19, bold: true, color: INK })] })], COLS[0], ID_BG),
      cell([new Paragraph({ children: [new TextRun({ text: r.what, font: FONT, size: 19, color: INK })] })], COLS[1]),
      cell([
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: r.now, font: FONT, size: 19, italics: true, color: MUTED })] }),
        new Paragraph({ children: [new TextRun({ text: lengthNote(r), font: FONT, size: 16, color: MUTED })] }),
      ], COLS[2]),
      cell([new Paragraph({ children: [new TextRun({ text: "", font: FONT, size: 21 })] })], COLS[3], FILL),
    ],
  });
}

function link(text, url) {
  return new ExternalHyperlink({ link: url, children: [new TextRun({ text, font: FONT, size: 21, color: SLATE, underline: {} })] });
}

const steps = [
  ["Open the review site at ", link("lightsonit.com/review", SITE), ". Every piece of text we still need from you is highlighted in yellow and tagged with a number, such as Home 3."],
  ["Use the Needed copy bar in the bottom right corner of each page to step through the highlights, or press ] for the next one and [ for the previous one. The bar shows the number of the highlight you are on."],
  ["Find that number below and write your version in the Your copy column. The Stand-in now column shows the text that is there today and roughly how much space the design was built for. Longer or shorter is fine."],
  ["To remove an item from the site, write Cut. To come back to it later, leave the box empty."],
  ["The six items under Every page appear in the header or footer of all six pages, so they are listed only once."],
  ["Save the finished sheet and send it back to Norm. If you are both working on it, you can upload this file to Google Drive and edit it there together as a Google Doc."],
];

const body = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Division 26 Copy Sheet", font: FONT })] }),
  p(`${total} pieces of copy still needed for the review site, listed page by page.`, { color: MUTED, after: 240 }),
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "How to use this sheet", font: FONT })] }),
  ...steps.map((parts) => new Paragraph({
    numbering: { reference: "steps", level: 0 }, spacing: { after: 100 },
    children: parts.map((x) => typeof x === "string" ? new TextRun({ text: x, font: FONT, size: 21, color: INK }) : x),
  })),
  new Paragraph({
    spacing: { before: 200, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "FFE14D", space: 10 } },
    children: [new TextRun({ text: "The stand-in text was written only to show the layout. None of it will be published. Only your words go on the finished site.", font: FONT, size: 21, color: INK, bold: true })],
  }),
];

for (const s of sections) {
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: s.name, font: FONT })] }));
  const sub = [link(s.name === "Every page" ? "Any page of the site" : `Open the ${s.name} page`, s.url)];
  if (s.note) sub.push(new TextRun({ text: `   ${s.note}`, font: FONT, size: 21, color: MUTED }));
  sub.push(new TextRun({ text: `   ${s.rows.length} items`, font: FONT, size: 21, color: MUTED }));
  body.push(new Paragraph({ spacing: { after: 200 }, children: sub }));
  body.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: [headerRow(), ...s.rows.map(row)] }));
}

const doc = new Document({
  creator: "Lights On IT",
  title: "Division 26 Copy Sheet",
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: INK } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 44, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: SLATE }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 300 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: "Division 26 Copy Sheet   Page ", font: FONT, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED }),
      ] })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outPath, buf); console.log("wrote", outPath, buf.length, "bytes"); });
