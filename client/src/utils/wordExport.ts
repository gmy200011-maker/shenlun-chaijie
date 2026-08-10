// 零依赖的 Word (.docx) 导出工具。
// 通过纯 JS 实现一个 store-only（不压缩）的 ZIP 容器 + OOXML，生成标准 .docx 文件，
// 无需任何第三方库，能在浏览器中直接触发下载。

// ---------- XML 转义 ----------
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- CRC32 ----------
const crcTable: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- store-only ZIP 编码 ----------
interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function zipStore(files: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: { name: string; crc: number; offset: number; size: number }[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); // method = store
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    chunks.push(local);
    central.push({ name: f.name, crc, offset, size: data.length });
    offset += local.length;
  }

  const centralStart = offset;
  for (const c of central) {
    const nameBytes = enc.encode(c.name);
    const cd = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(16, c.crc, true);
    dv.setUint32(20, c.size, true);
    dv.setUint32(24, c.size, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(38, 0, true);
    dv.setUint32(42, c.offset, true);
    cd.set(nameBytes, 46);
    chunks.push(cd);
    offset += cd.length;
  }

  const centralSize = offset - centralStart;
  const eocd = new Uint8Array(22);
  const dv = new DataView(eocd.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(4, 0, true);
  dv.setUint16(6, 0, true);
  dv.setUint16(8, central.length, true);
  dv.setUint16(10, central.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, centralStart, true);
  dv.setUint16(20, 0, true);
  chunks.push(eocd);

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ---------- Word 文档构建 ----------
class WordDoc {
  private body: string[] = [];

  private run(text: string, bold = false, size?: number): string {
    let rpr = "";
    if (bold) rpr += "<w:b/><w:bCs/>";
    if (size) rpr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    const rprXml = rpr ? `<w:rPr>${rpr}</w:rPr>` : "";
    return `<w:r>${rprXml}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  private paragraph(
    text: string,
    opts: { bold?: boolean; size?: number; align?: "left" | "center" | "right"; after?: number } = {}
  ): string {
    const jc = opts.align ? `<w:jc w:val="${opts.align}"/>` : "";
    const after = opts.after ?? 120;
    const ppr = `<w:pPr>${jc}<w:spacing w:after="${after}" w:line="276" w:lineRule="auto"/></w:pPr>`;
    return `<w:p>${ppr}${this.run(text, opts.bold, opts.size)}</w:p>`;
  }

  title(text: string) {
    this.body.push(
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>${this.run(text, true, 32)}</w:p>`
    );
  }

  h1(text: string) {
    this.body.push(this.paragraph(text, { bold: true, size: 24, after: 80 }));
  }

  h2(text: string) {
    this.body.push(
      `<w:p><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>${this.run(text, true, 22)}</w:p>`
    );
  }

  p(text: string, opts?: { bold?: boolean; size?: number; align?: "left" | "center" | "right" }) {
    this.body.push(this.paragraph(text, opts));
  }

  bullet(text: string) {
    this.body.push(
      `<w:p><w:pPr><w:ind w:left="440" w:hanging="220"/><w:spacing w:after="60"/></w:pPr>${this.run("•  " + text)}</w:p>`
    );
  }

  blank() {
    this.body.push('<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>');
  }

  toDocumentXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${this.body.join(
      ""
    )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
}

// ---------- 下载 ----------
function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : filename + ".docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildAndDownload(filename: string, build: (doc: WordDoc) => void) {
  const doc = new WordDoc();
  build(doc);
  const xml = doc.toDocumentXml();

  const enc = new TextEncoder();
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
  const docBytes = enc.encode(xml);
  const docWithBom = new Uint8Array(BOM.length + docBytes.length);
  docWithBom.set(BOM, 0);
  docWithBom.set(docBytes, BOM.length);

  const contentTypes = enc.encode(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  const rels = enc.encode(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );

  const zip = zipStore([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "word/document.xml", data: docWithBom },
  ]);

  triggerDownload(zip, filename);
}

// ---------- 各库导出实现 ----------
import type { Quote } from "../types";
import type { MaterialCase } from "../types";
import type { InterviewQuestion } from "../types";
import type { SolutionMethod } from "../types";

export function exportQuotesDoc(list: Quote[], filename = "金句库") {
  buildAndDownload(filename, (doc) => {
    doc.title("金句库");
    doc.p(`共 ${list.length} 条金句 · 导出时间 ${new Date().toLocaleString("zh-CN")}`, {
      size: 18,
      align: "center",
    });
    doc.blank();
    list.forEach((q, i) => {
      doc.p(`${i + 1}. ${q.quote}`, { bold: true });
      if (q.source) doc.p(`—— ${q.source}`, { size: 18 });
      const parts: string[] = [];
      if (q.articleTitle) parts.push(`来源：${q.articleTitle}`);
      if (q.tags && q.tags.length) parts.push(`标签：${q.tags.map((t) => "#" + t).join(" ")}`);
      if (parts.length) doc.p(parts.join("　|　"), { size: 18 });
      doc.blank();
    });
  });
}

export function exportMaterialsDoc(list: MaterialCase[], filename = "素材案例库") {
  buildAndDownload(filename, (doc) => {
    doc.title("素材案例库");
    doc.p(`共 ${list.length} 个素材案例 · 导出时间 ${new Date().toLocaleString("zh-CN")}`, {
      size: 18,
      align: "center",
    });
    doc.blank();
    list.forEach((c, i) => {
      doc.h2(`${i + 1}. ${c.summary || "(无摘要)"}`);
      const meta: string[] = [];
      if (c.domain) meta.push(`领域：${c.domain}`);
      if (c.type) meta.push(`类型：${c.type}`);
      if (meta.length) doc.p(meta.join("　|　"), { size: 18 });
      if (c.tags && c.tags.length) doc.p(`标签：${c.tags.map((t) => "#" + t).join(" ")}`, { size: 18 });
      if (c.usageScenario) doc.p(`适用场景：${c.usageScenario}`, { size: 18 });
      doc.blank();
    });
  });
}

export function exportInterviewsDoc(list: InterviewQuestion[], filename = "面试题目库") {
  buildAndDownload(filename, (doc) => {
    doc.title("面试题目库");
    doc.p(`共 ${list.length} 道面试题 · 导出时间 ${new Date().toLocaleString("zh-CN")}`, {
      size: 18,
      align: "center",
    });
    doc.blank();
    list.forEach((iq, i) => {
      doc.h2(`${i + 1}. [${iq.type || "综合分析"}] ${iq.question}`);
      if (iq.answerIdea) {
        doc.p("参考回答思路：", { bold: true, size: 20 });
        iq.answerIdea
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((line) => doc.bullet(line));
      }
      if (iq.articleTitle) doc.p(`来源文章：${iq.articleTitle}`, { size: 18 });
      doc.blank();
    });
  });
}

export function exportSolutionMethodsDoc(list: SolutionMethod[], filename = "解决方法库") {
  buildAndDownload(filename, (doc) => {
    doc.title("解决方法库");
    doc.p(`共 ${list.length} 条解决方法 · 导出时间 ${new Date().toLocaleString("zh-CN")}`, {
      size: 18,
      align: "center",
    });
    doc.blank();
    list.forEach((m, i) => {
      doc.h2(`${i + 1}. ${m.heading || "(无标题)"}`);
      const meta: string[] = [];
      if (m.domain) meta.push(`领域：${m.domain}`);
      if (m.tags && m.tags.length) meta.push(`自定义标签：${m.tags.map((t) => "#" + t).join(" ")}`);
      if (meta.length) doc.p(meta.join("　|　"), { size: 18 });
      doc.p(m.content, {});
      if (m.articleTitle) doc.p(`来源文章：${m.articleTitle}`, { size: 18 });
      doc.blank();
    });
  });
}
