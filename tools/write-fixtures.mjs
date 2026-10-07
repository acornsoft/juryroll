import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import core from '../shared/src/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const samples = path.join(root, 'shared', 'samples');
const templates = path.join(root, 'shared', 'templates');
fs.mkdirSync(templates, { recursive: true });

const jurorTemplate = 'Juror Number,Last,First,MI,Sfx,Birth Date,Address,Zip,Disqualification Reason,Disqualification Date\n';
const voterTemplate = 'voter_id,name_last,name_first,name_middle,name_suffix,date_of_birth,res_street,res_zip,status,status_reason,registration_date\n';
fs.writeFileSync(path.join(templates, 'juror-template.csv'), jurorTemplate);
fs.writeFileSync(path.join(templates, 'voter-template.csv'), voterTemplate);

function rowsOf(text) {
  const delim = core.detectDelimiter(text);
  const rows = [];
  core.iterCSV(text, delim, (row) => { rows.push(row.slice()); });
  return rows;
}

function serial(y, m, d) {
  const utc = Date.UTC(y, m - 1, d);
  const epoch = Date.UTC(1899, 11, 30);
  return (utc - epoch) / 86400000;
}

function sheetFromRows(rows) {
  const ws = {};
  let maxC = 0;
  rows.forEach((row, r) => {
    maxC = Math.max(maxC, row.length - 1);
    row.forEach((value, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const text = value ?? '';
      const mdy = r > 0 && /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
      const iso = r > 0 && /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (mdy) {
        ws[addr] = { t: 'n', v: serial(Number(mdy[3]), Number(mdy[1]), Number(mdy[2])), z: 'm/d/yyyy' };
      } else if (iso) {
        ws[addr] = { t: 'n', v: serial(Number(iso[1]), Number(iso[2]), Number(iso[3])), z: 'yyyy-mm-dd' };
      } else {
        ws[addr] = { t: 's', v: String(text) };
      }
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: Math.max(maxC, 0) } });
  return ws;
}

function writeBook(filePath, sheets) {
  if (fs.existsSync(filePath)) return;
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of sheets) XLSX.utils.book_append_sheet(wb, sheetFromRows(rows), name);
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: false });
  fs.writeFileSync(filePath, Buffer.from(out));
  console.log('wrote', path.relative(root, filePath));
}

writeBook(path.join(templates, 'juror-template.xlsx'), [['Juror', rowsOf(jurorTemplate)]]);
writeBook(path.join(templates, 'voter-template.xlsx'), [['Voter', rowsOf(voterTemplate)]]);
writeBook(path.join(samples, 'sample_juror_disqualifications.xlsx'), [['Jurors', rowsOf(fs.readFileSync(path.join(samples, 'sample_juror_disqualifications.csv'), 'utf8'))]]);
writeBook(path.join(samples, 'sample_voter_roll.xlsx'), [['Voters', rowsOf(fs.readFileSync(path.join(samples, 'sample_voter_roll.csv'), 'utf8'))]]);
console.log('fixtures ready');
