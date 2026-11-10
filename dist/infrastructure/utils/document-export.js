import { deflateRawSync } from 'node:zlib';
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function u16(value) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(value & 0xffff, 0);
    return b;
}
function u32(value) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(value >>> 0, 0);
    return b;
}
/** Minimal standards-compliant ZIP writer sufficient for .docx packages. */
function createZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const [name, value] of Object.entries(files)) {
        const nameBuffer = Buffer.from(name, 'utf8');
        const source = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
        const compressed = deflateRawSync(source);
        const crc = crc32(source);
        const localHeader = Buffer.concat([
            Buffer.from([0x50, 0x4b, 0x03, 0x04]),
            u16(20), u16(0x0800), u16(8), u16(0), u16(0),
            u32(crc), u32(compressed.length), u32(source.length),
            u16(nameBuffer.length), u16(0), nameBuffer
        ]);
        localParts.push(localHeader, compressed);
        const centralHeader = Buffer.concat([
            Buffer.from([0x50, 0x4b, 0x01, 0x02]),
            u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
            u32(crc), u32(compressed.length), u32(source.length),
            u16(nameBuffer.length), u16(0), u16(0), u16(0), u16(0),
            u32(0), u32(offset), nameBuffer
        ]);
        centralParts.push(centralHeader);
        offset += localHeader.length + compressed.length;
    }
    const centralDirectory = Buffer.concat(centralParts);
    const localDirectory = Buffer.concat(localParts);
    const end = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x05, 0x06]),
        u16(0), u16(0), u16(Object.keys(files).length), u16(Object.keys(files).length),
        u32(centralDirectory.length), u32(localDirectory.length), u16(0)
    ]);
    return Buffer.concat([localDirectory, centralDirectory, end]);
}
function xmlEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
export function buildDocxDocument(title, sections) {
    const escape = xmlEscape;
    const border = `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E2F3"/><w:left w:val="single" w:sz="4" w:color="D9E2F3"/><w:bottom w:val="single" w:sz="4" w:color="D9E2F3"/><w:right w:val="single" w:sz="4" w:color="D9E2F3"/><w:insideH w:val="single" w:sz="4" w:color="E6EAF0"/><w:insideV w:val="single" w:sz="4" w:color="E6EAF0"/></w:tblBorders>`;
    const table = (rows) => {
        const body = rows.map(([label, value]) => `
      <w:tr>
        <w:tc><w:tcPr><w:shd w:fill="F4F7FB"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escape(label)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escape(value)}</w:t></w:r></w:p></w:tc>
      </w:tr>`).join('');
        return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${border}</w:tblPr>${body}</w:tbl>`;
    };
    const dataTable = (columns, rows) => {
        const cell = (value, header = false) => `
      <w:tc>
        <w:tcPr>${header ? '<w:shd w:fill="163A5F"/>' : ''}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>
        <w:p><w:r><w:rPr>${header ? '<w:b/><w:color w:val="FFFFFF"/>' : ''}</w:rPr><w:t xml:space="preserve">${escape(value)}</w:t></w:r></w:p>
      </w:tc>`;
        const header = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${columns.map((column) => cell(column, true)).join('')}</w:tr>`;
        const body = rows.map((row) => `<w:tr>${columns.map((_, index) => cell(row[index] ?? '')).join('')}</w:tr>`).join('');
        const emptyRow = rows.length ? '' : `<w:tr>${cell('No cleaned records to display.')}${columns.slice(1).map(() => cell('')).join('')}</w:tr>`;
        return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${border}</w:tblPr><w:tblGrid>${columns.map(() => '<w:gridCol w:w="1800"/>').join('')}</w:tblGrid>${header}${body}${emptyRow}</w:tbl>`;
    };
    const body = [];
    body.push(`<w:p><w:pPr><w:spacing w:after="260"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="163A5F"/><w:sz w:val="34"/></w:rPr><w:t>${escape(title)}</w:t></w:r></w:p>`);
    for (const section of sections) {
        body.push(`<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="246B9A"/><w:sz w:val="24"/></w:rPr><w:t>${escape(section.heading)}</w:t></w:r></w:p>`);
        if (section.table) {
            body.push(dataTable(section.table.columns, section.table.rows));
        }
        else {
            body.push(table(section.rows));
        }
    }
    body.push(`<w:p><w:pPr><w:spacing w:before="240"/></w:pPr><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:t>Generated by BOSS Data Import Centre</w:t></w:r></w:p>`);
    body.push('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>');
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const documentRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    return createZip({
        '[Content_Types].xml': contentTypes,
        '_rels/.rels': rootRels,
        'word/document.xml': documentXml,
        'word/styles.xml': stylesXml,
        'word/_rels/document.xml.rels': documentRels
    });
}
function pdfEscape(value) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function wrapText(text, maxChars) {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!clean)
        return [''];
    const words = clean.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = candidate;
        }
    }
    if (current)
        lines.push(current);
    return lines;
}
function wrapTableCell(value, maxChars) {
    const lines = [];
    for (const word of String(value ?? '').split(/\s+/)) {
        if (word.length > maxChars) {
            for (let offset = 0; offset < word.length; offset += maxChars) {
                lines.push(word.slice(offset, offset + maxChars));
            }
            continue;
        }
        const current = lines.length ? lines[lines.length - 1] : '';
        if (current && `${current} ${word}`.length <= maxChars) {
            lines[lines.length - 1] = `${current} ${word}`;
        }
        else {
            lines.push(word);
        }
    }
    return lines.length ? lines : [''];
}
export function buildPdfDocument(title, lines) {
    const sections = [{ heading: 'Summary', rows: lines.map((line, i) => [`Item ${i + 1}`, line]) }];
    return buildPdfSummaryDocument(title, sections);
}
/** Standards-compliant, readable PDF report with section headings and key/value rows. */
export function buildPdfSummaryDocument(title, sections) {
    const pageWidth = 612;
    const pageHeight = 792;
    const left = 42;
    const right = 42;
    const top = 48;
    const bottom = 44;
    const usableWidth = pageWidth - left - right;
    const lineHeight = 14;
    const sectionGap = 12;
    const contentPages = [[]];
    let y = pageHeight - top;
    const push = (line) => {
        const page = contentPages[contentPages.length - 1];
        page.push(line);
    };
    const ensure = (needed) => {
        if (y - needed < bottom) {
            contentPages.push([]);
            y = pageHeight - top;
        }
    };
    const text = (value, fontSize, color, x = left) => {
        push(`BT /F1 ${fontSize} Tf ${color} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(value)}) Tj ET`);
        y -= lineHeight;
    };
    const rect = (x, yy, w, h, fill, stroke = '') => {
        push(`q ${fill} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f Q`);
        if (stroke)
            push(`q ${stroke} RG 1 w ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S Q`);
    };
    // Header
    ensure(72);
    rect(left, y - 42, usableWidth, 52, '0.09 0.23 0.37');
    push(`BT /F1 18 Tf 1 1 1 rg ${left + 16} ${y - 20} Td (${pdfEscape(title)}) Tj ET`);
    push(`BT /F1 8 Tf 0.84 0.89 0.94 rg ${left + 16} ${y - 35} Td (BOSS Data Import Centre) Tj ET`);
    y -= 68;
    for (const section of sections) {
        ensure(40);
        rect(left, y - 22, usableWidth, 22, '0.94 0.96 0.98');
        push(`BT /F1 11 Tf 0.10 0.32 0.50 rg ${left + 10} ${y - 15} Td (${pdfEscape(section.heading)}) Tj ET`);
        y -= 34;
        if (section.table) {
            const { columns, rows } = section.table;
            const columnWidth = usableWidth / Math.max(columns.length, 1);
            const fontSize = columns.length > 8 ? 5.5 : columns.length > 5 ? 6.5 : 7.5;
            const maxChars = Math.max(3, Math.floor((columnWidth - 8) / (fontSize * 0.52)));
            const headerCells = columns.map((column) => wrapTableCell(column, maxChars));
            const headerHeight = Math.max(24, Math.max(...headerCells.map((cell) => cell.length)) * 9 + 8);
            const drawHeader = () => {
                for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
                    const x = left + columnIndex * columnWidth;
                    rect(x, y - headerHeight + 6, columnWidth, headerHeight, '0.09 0.23 0.37', '0.72 0.78 0.84');
                    headerCells[columnIndex].forEach((line, lineIndex) => {
                        push(`BT /F1 ${fontSize} Tf 1 1 1 rg ${(x + 4).toFixed(1)} ${(y - 7 - lineIndex * 9).toFixed(1)} Td (${pdfEscape(line)}) Tj ET`);
                    });
                }
                y -= headerHeight;
            };
            ensure(headerHeight + 12);
            drawHeader();
            const tableRows = rows.length ? rows : [['No cleaned records to display.', ...columns.slice(1).map(() => '')]];
            for (const row of tableRows) {
                const cells = columns.map((_, index) => wrapTableCell(row[index] ?? '', maxChars));
                const rowHeight = Math.max(22, Math.max(...cells.map((cell) => cell.length)) * 9 + 8);
                if (y - rowHeight < bottom) {
                    contentPages.push([]);
                    y = pageHeight - top;
                    drawHeader();
                }
                for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
                    const x = left + columnIndex * columnWidth;
                    rect(x, y - rowHeight + 6, columnWidth, rowHeight, '1 1 1', '0.86 0.89 0.93');
                    cells[columnIndex].forEach((line, lineIndex) => {
                        push(`BT /F1 ${fontSize} Tf 0.10 0.12 0.16 rg ${(x + 4).toFixed(1)} ${(y - 7 - lineIndex * 9).toFixed(1)} Td (${pdfEscape(line)}) Tj ET`);
                    });
                }
                y -= rowHeight;
            }
            y -= sectionGap;
            continue;
        }
        for (const [label, value] of section.rows) {
            const labelLines = wrapText(label, 28);
            const valueLines = wrapText(value, 68);
            const rowLines = Math.max(labelLines.length, valueLines.length);
            const rowH = Math.max(24, rowLines * lineHeight + 8);
            ensure(rowH + 4);
            rect(left, y - rowH + 8, usableWidth, rowH, '1 1 1', '0.86 0.89 0.93');
            const mid = left + 175;
            for (let i = 0; i < rowLines; i++) {
                const ly = y - 11 - i * lineHeight;
                if (i < labelLines.length)
                    push(`BT /F1 8.5 Tf 0.25 0.30 0.36 rg ${left + 8} ${ly.toFixed(1)} Td (${pdfEscape(labelLines[i])}) Tj ET`);
                if (i < valueLines.length)
                    push(`BT /F1 8.5 Tf 0.10 0.12 0.16 rg ${mid + 8} ${ly.toFixed(1)} Td (${pdfEscape(valueLines[i])}) Tj ET`);
            }
            push(`q 0.86 0.89 0.93 RG 0.7 w ${mid} ${y - rowH + 8} m ${mid} ${y + 8} l S Q`);
            y -= rowH;
        }
        y -= sectionGap;
    }
    // footer per page later; build page objects
    const pageBuffers = [];
    const objects = [];
    const pagesKids = [];
    const fontObject = 5 + contentPages.length * 2;
    for (let i = 0; i < contentPages.length; i++) {
        const lines = contentPages[i];
        const footer = `BT /F1 7 Tf 0.42 0.46 0.52 rg ${left} 26 Td (${pdfEscape(`Generated by BOSS Data Import Centre — Page ${i + 1} of ${contentPages.length}`)}) Tj ET`;
        const content = Buffer.from([...lines, footer].join('\n'), 'latin1');
        const streamObj = objects.length + 1;
        const pageObj = objects.length + 2;
        objects.push(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream', 'latin1')]));
        objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${streamObj} 0 R >>`, 'latin1'));
        pagesKids.push(pageObj);
    }
    // Catalog/pages must come before/after references can point forward.
    const catalogObj = objects.length + 1;
    const pagesObj = objects.length + 2;
    objects.push(Buffer.from(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`));
    objects.push(Buffer.from(`<< /Type /Pages /Kids [${pagesKids.map(n => `${n} 0 R`).join(' ')}] /Count ${pagesKids.length} >>`));
    const fontObjActual = objects.length + 1;
    objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
    // Fix object references to the actual catalog/pages/font object numbers.
    // Rebuild page objects with correct refs because the object numbers above are dynamic.
    const pageAndStreams = [];
    const fixedPagesKids = [];
    for (let i = 0; i < contentPages.length; i++) {
        const content = Buffer.from([...contentPages[i], `BT /F1 7 Tf 0.42 0.46 0.52 rg ${left} 26 Td (${pdfEscape(`Generated by BOSS Data Import Centre — Page ${i + 1} of ${contentPages.length}`)}) Tj ET`].join('\n'), 'latin1');
        pageAndStreams.push(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream', 'latin1')]));
        // page object number assigned immediately after stream in final layout
    }
    const finalObjects = [];
    const streamNums = [];
    const pageNums = [];
    for (const stream of pageAndStreams) {
        streamNums.push(finalObjects.length + 1);
        finalObjects.push(stream);
        pageNums.push(finalObjects.length + 1);
        finalObjects.push(Buffer.alloc(0));
    }
    const finalPagesNum = finalObjects.length + 1;
    const finalCatalogNum = finalObjects.length + 2;
    const finalFontNum = finalObjects.length + 3;
    for (let i = 0; i < pageNums.length; i++) {
        finalObjects[pageNums[i] - 1] = Buffer.from(`<< /Type /Page /Parent ${finalPagesNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${finalFontNum} 0 R >> >> /Contents ${streamNums[i]} 0 R >>`, 'latin1');
    }
    finalObjects.push(Buffer.from(`<< /Type /Pages /Kids [${pageNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`, 'latin1'));
    finalObjects.push(Buffer.from(`<< /Type /Catalog /Pages ${finalPagesNum} 0 R >>`, 'latin1'));
    finalObjects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'latin1'));
    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets = [0];
    let position = chunks[0].length;
    finalObjects.forEach((object, index) => {
        offsets[index + 1] = position;
        const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), object, Buffer.from('\nendobj\n', 'latin1')]);
        chunks.push(chunk);
        position += chunk.length;
    });
    const xrefOffset = position;
    let xref = `xref\n0 ${finalObjects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= finalObjects.length; i++)
        xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${finalObjects.length + 1} /Root ${finalCatalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(chunks);
}
//# sourceMappingURL=document-export.js.map