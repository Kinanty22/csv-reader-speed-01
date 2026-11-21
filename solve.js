// csv-reader-speed: a fast drop-in for csv-reader 1.0.0 (make.fun's own CSV
// reader). Pure JavaScript, no dependencies, no WebAssembly: the competition
// requires JavaScript/TypeScript source only, so speed comes from the shape
// of the code, not from another runtime.
//
// It returns exactly csv-reader 1.0.0's answer for every input {text,
// header}: {columns, rows, errors}, following the same broken-row policy
// (BOM dropped, LF/CRLF record ends, stray CR dropped with a stray_cr
// error, quoted fields with "" escapes and LF-normalised line breaks inside,
// quote junk appended, an unterminated quote read again as unquoted, rows
// padded or cut to the first record's width with short_row/long_row errors).
//
// Why it is faster than the reference: the reference builds every field one
// character at a time (value += c per character, through helper closures).
// This reader never does that. A field is sliced out of the text in one go:
// an unquoted field is scanned for its delimiter and sliced once; a quoted
// field's closing quote is found with native indexOf and its content is
// sliced once, transformed only when it actually holds a doubled quote or
// a CR. The only per-character loops run over short spans, and the rare
// broken-field paths (stray CR, quote junk, unterminated quote) pay extra
// only when they occur.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  recordLoop: while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = COMMA;
    let quoted = false;

    do {
      quoted = text.charCodeAt(pos) === 34;
      let value;
      let done = false;
      let prefix = '';
      let junkMode = false;

      if (quoted) {
        const open = pos;
        const openLine = line;
        // The closing quote: the next quote that is not doubled.
        let search = pos + 1;
        let close = -1;
        let doubled = false;
        for (;;) {
          const q = text.indexOf('"', search);
          if (q === -1) break;
          if (text.charCodeAt(q + 1) === 34) {
            doubled = true;
            search = q + 2;
            continue;
          }
          close = q;
          break;
        }

        if (close === -1) {
          // The quote never closes: it is a literal character, and the text
          // after it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          prefix = '"';
        } else {
          const start = pos + 1;
          let content = text.slice(start, close);
          const hasCR = content.indexOf('\r') !== -1;
          const hasNL = content.indexOf('\n') !== -1;
          if (hasCR || hasNL) {
            // Every LF, CRLF and lone CR inside quotes is one line.
            for (let i = 0; i < content.length; i++) {
              const c = content.charCodeAt(i);
              if (c === 13) {
                line += 1;
                if (content.charCodeAt(i + 1) === 10) i += 1;
              } else if (c === 10) {
                line += 1;
              }
            }
          }
          if (doubled) content = content.replaceAll('""', '"');
          if (hasCR) content = content.replace(/\r\n?/g, '\n');
          pos = close + 1;
          if (pos >= n) {
            value = content;
            ended = END;
            done = true;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos += 1;
              value = content;
              ended = COMMA;
              done = true;
            } else if (c === 10) {
              pos += 1;
              line += 1;
              value = content;
              ended = LINE_BREAK;
              done = true;
            } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line += 1;
              value = content;
              ended = LINE_BREAK;
              done = true;
            } else {
              // What follows the closing quote is appended as it stands.
              prefix = content;
              junkMode = true;
            }
          }
        }
      }

      if (!done) {
        // Unquoted field from pos, prefixed with `prefix`: '' for a plain
        // field, the quoted content for quote junk, '"' after a quote that
        // never closes. Scanned for its delimiter, sliced once; a stray CR
        // is dropped (stray_cr) and the field continues.
        let start = pos;
        let cur = pos;
        let parts = null;
        let added = 0;
        let kind = END;
        while (cur < n) {
          const c = text.charCodeAt(cur);
          if (c === 44) {
            kind = COMMA;
            break;
          }
          if (c === 10) {
            kind = LINE_BREAK;
            break;
          }
          if (c === 13) {
            if (text.charCodeAt(cur + 1) === 10) {
              kind = LINE_BREAK;
              break;
            }
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            added += cur - start;
            if (parts === null) parts = [text.slice(start, cur)];
            else parts.push(text.slice(start, cur));
            cur += 1;
            start = cur;
            continue;
          }
          cur += 1;
        }
        added += cur - start;
        if (parts !== null) {
          parts.push(text.slice(start, cur));
          value = prefix + parts.join('');
        } else if (prefix !== '') {
          value = prefix + text.slice(start, cur);
        } else {
          value = text.slice(start, cur);
        }
        if (kind === COMMA) {
          pos = cur + 1;
          ended = COMMA;
        } else if (kind === LINE_BREAK) {
          pos = text.charCodeAt(cur) === 13 ? cur + 2 : cur + 1;
          line += 1;
          ended = LINE_BREAK;
        } else {
          pos = cur;
          ended = END;
        }
        if (junkMode && added > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
      }

      fields.push(value);
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue recordLoop;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue recordLoop;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
