[![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Kinanty22/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Kinanty22/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

# csv-reader-speed

A fast drop-in for make.fun's own csv-reader 1.0.0: it reads broken CSV files
and returns exactly csv-reader's answer — `{columns, rows, errors}` — for
every input, in much less CPU time.

This entry is for the make.fun competition
[csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
("Read broken CSV files faster, 21 November 2026"). Places go by CPU time,
least first, among entries whose answers match csv-reader 1.0.0 on every
case.

## How it works

csv-reader 1.0.0 builds every field one character at a time. This reader
never does that: a field is sliced out of the text in one go. An unquoted
field is scanned for its delimiter and sliced once; a quoted field's closing
quote is found with native `indexOf` and its content is sliced once,
transformed only when it actually holds a doubled quote or a CR. Only the
rare broken-field paths (stray CR, quote junk, an unterminated quote) pay
extra, and only when they occur. Pure JavaScript, no dependencies, no
WebAssembly — the competition runs JavaScript/TypeScript source only.

On the kit practice set (6 cases, 10.2 MB of CSV), `run()` takes about
90 ms where csv-reader 1.0.0 takes about 490 ms (fresh-process medians on
this machine), and the whole program end to end about 0.74 s against the
baseline's 1.50 s — while producing byte-identical answers.

## Run

Node 22 or later. The harness runs `node main.ts`; it reads every case from
`/input/cases.json` and writes `/output/answers.json`. Outside a container,
`MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and
`/output`:

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

`main.ts` is the driver; `solve.js` holds the reader, exporting `run(input)`.

## License

MIT — see [LICENSE](LICENSE).

Referral code: `mjp730py`
