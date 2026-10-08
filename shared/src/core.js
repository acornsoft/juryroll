
/* JuryRoll core: pure functions, no DOM. The test runner (node) loads this block. */
var JuryRollCore = (function () {
  'use strict';
  var SUFFIX = { JR:'JR', JUNIOR:'JR', SR:'SR', SENIOR:'SR', II:'II', '2ND':'II', III:'III', '3RD':'III', IV:'IV', '4TH':'IV', V:'V', '5TH':'V' };
  var MONTHS = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, SEPT:9, OCT:10, NOV:11, DEC:12 };
  var STREET_WORDS = { STREET:'ST', STR:'ST', AVENUE:'AVE', AV:'AVE', ROAD:'RD', DRIVE:'DR', LANE:'LN', COURT:'CT', BOULEVARD:'BLVD',
    PLACE:'PL', TERRACE:'TER', CIRCLE:'CIR', PARKWAY:'PKWY', HIGHWAY:'HWY', SQUARE:'SQ', TRAIL:'TRL', PIKE:'PK', ALLEY:'ALY',
    NORTH:'N', SOUTH:'S', EAST:'E', WEST:'W', NORTHEAST:'NE', NORTHWEST:'NW', SOUTHEAST:'SE', SOUTHWEST:'SW', MOUNT:'MT', SAINT:'ST' };
  var UNIT_WORDS = { APT:1, APARTMENT:1, UNIT:1, STE:1, SUITE:1, FL:1, FLOOR:1, RM:1, ROOM:1, BLDG:1, LOT:1, NO:1 };

  var FIELDS = {
    juror_id: { label:'Juror record ID', pats:['jurorid','jurornumber','jurorno','jurornum','participantid','recordid','juror','badgenumber','id'] },
    voter_id: { label:'Voter ID', pats:['voterid','sosvoterid','voterregistrationnumber','registrationnumber','regnum','voternumber','voterno','ncid','idnumber','id'] },
    last:     { label:'Last name', pats:['lastname','last','lname','surname','namelast','familyname','lastnm'], req:true },
    first:    { label:'First name', pats:['firstname','first','fname','namefirst','givenname','firstnm'], req:true },
    middle:   { label:'Middle name / initial', pats:['middlename','middle','mname','mi','middleinitial','namemiddle','middlenm'] },
    suffix:   { label:'Suffix (Jr, Sr, III)', pats:['suffix','sfx','namesuffix','suffixname','suff','namesfx'] },
    fullname: { label:'Full name (only if no first/last columns)', pats:['name','fullname','jurorname','votername','personname'], exact:true },
    dob:      { label:'Date of birth (or birth year)', pats:['dob','dateofbirth','birthdate','birthdt','birthday','dobdate','birthyear','yearofbirth','yob'] },
    house_no: { label:'House number (only if separate)', pats:['housenumber','houseno','streetnumber','housenum','resnumber','addressnumber','resstreetnum'] },
    street:   { label:'Street address', pats:['streetaddress','address','resstreet','residentialaddress','resaddress','address1','addressline1','residenceaddress','street','streetname','resaddr','addr'] },
    zip:      { label:'ZIP code', pats:['zip','zipcode','postalcode','reszip','zip5','postcode','zipcd','reszipcode'] },
    reason:   { label:'Disqualification reason', pats:['disqualificationreason','reason','disqualreason','disqualifyreason','excusereason','reasoncode','disqualification','exemptionreason','disqualified','status'] }
  };
  var JUROR_FIELDS = ['juror_id','last','first','middle','suffix','fullname','dob','house_no','street','zip','reason'];
  var VOTER_FIELDS = ['voter_id','last','first','middle','suffix','fullname','dob','house_no','street','zip'];
  var NONCITIZEN_RE = /non[\s\-_]*citizen|not\s+(a\s+)?(u\.?\s?s\.?\s+|united\s+states\s+)?citizen|alien|citizenship|non[\s\-_]*cit\b|noncit/i;

  function detectDelimiter(text) {
    var end = text.indexOf('\n'); var line = end < 0 ? text : text.slice(0, end);
    var best = ',', bestN = 0;
    [',', '\t', '|', ';'].forEach(function (d) { var n = line.split(d).length - 1; if (n > bestN) { bestN = n; best = d; } });
    return best;
  }

  /* CSV reader. Calls cb(rowArray). Return false from cb to stop. Handles quotes, "" escapes, CRLF, BOM. */
  function iterCSV(text, delim, cb) {
    var i = 0, n = text.length, dc = delim.charCodeAt(0), row = [], c, s, field;
    if (text.charCodeAt(0) === 0xFEFF) i = 1;
    function emit() { var r = row; row = []; if (r.length === 1 && r[0].trim() === '') return true; return cb(r) !== false; }
    while (i < n) {
      if (text.charCodeAt(i) === 34) {
        i++; s = i; field = '';
        for (;;) {
          var q = text.indexOf('"', i);
          if (q < 0) { field += text.slice(s); i = n; break; }
          if (text.charCodeAt(q + 1) === 34) { field += text.slice(s, q + 1); i = q + 2; s = i; continue; }
          field += text.slice(s, q); i = q + 1; break;
        }
        s = i; while (i < n) { c = text.charCodeAt(i); if (c === dc || c === 10 || c === 13) break; i++; }
        if (i > s) field += text.slice(s, i);
      } else {
        s = i; while (i < n) { c = text.charCodeAt(i); if (c === dc || c === 10 || c === 13) break; i++; }
        field = text.slice(s, i);
      }
      row.push(field);
      if (i >= n) { emit(); return; }
      c = text.charCodeAt(i);
      if (c === dc) { i++; if (i >= n) { row.push(''); emit(); return; } continue; }
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      i++;
      if (!emit()) return;
    }
    if (row.length) emit();
  }

  function readHead(text, hasHeader, previewRows) {
    var delim = detectDelimiter(text), headers = null, preview = [], rows = 0, maxCols = 0;
    iterCSV(text, delim, function (r) {
      if (hasHeader && headers === null) { headers = r.map(function (h) { return h.trim(); }); return; }
      rows++; if (r.length > maxCols) maxCols = r.length;
      if (preview.length < (previewRows || 5)) preview.push(r);
    });
    if (!headers) { headers = []; for (var k = 0; k < maxCols; k++) headers.push('Column ' + (k + 1)); }
    return { delim: delim, headers: headers, preview: preview, rows: rows };
  }

  function normHeader(h) { return String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function guessMapping(headers, fieldKeys) {
    var nh = headers.map(normHeader), cand = [];
    fieldKeys.forEach(function (f) {
      var def = FIELDS[f];
      nh.forEach(function (h, idx) {
        if (!h) return;
        def.pats.forEach(function (p, pi) {
          var sc = 0;
          if (h === p) sc = 1000 - pi;
          else if (!def.exact && p.length >= 4 && h.indexOf(p) >= 0) sc = 500 - pi * 5 - (h.length - p.length);
          if (sc > 0) cand.push({ f: f, idx: idx, sc: sc });
        });
      });
    });
    cand.sort(function (a, b) { return b.sc - a.sc; });
    var map = {}, used = {};
    cand.forEach(function (c) { if (map[c.f] === undefined && !used[c.idx]) { map[c.f] = c.idx; used[c.idx] = true; } });
    fieldKeys.forEach(function (f) { if (map[f] === undefined) map[f] = -1; });
    if (map.first >= 0 && map.last >= 0 && map.fullname >= 0) map.fullname = -1;
    return map;
  }

  function deaccent(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
  function nameTokens(s) { return deaccent(s).replace(/['\u2019`]/g, '').split(/[^A-Z0-9]+/).filter(Boolean); }
  function normSuffix(s) { var t = nameTokens(s).join(''); return SUFFIX[t] || (t ? t : ''); }

  function parseDOB(raw, order) {
    var s = String(raw || '').trim(), m, y, mo, d;
    if (!s) return null;
    var nowY = new Date().getFullYear();
    function y2(v) { v = +v; if (v < 100) { v = (v > nowY % 100) ? 1900 + v : 2000 + v; } return v; }
    function ok(Y, M, D) {
      if (!(Y >= 1890 && Y <= nowY)) return null;
      if (M === undefined) return { y: Y, full: null };
      if (!(M >= 1 && M <= 12 && D >= 1 && D <= 31)) return null;
      var dt = new Date(Date.UTC(Y, M - 1, D)); if (dt.getUTCMonth() !== M - 1) return null;
      return { y: Y, m: M, d: D, full: Y + '-' + (M < 10 ? '0' : '') + M + '-' + (D < 10 ? '0' : '') + D };
    }
    if ((m = s.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{8})$/))) {
      var t = m[1];
      if (/^(18|19|20)/.test(t)) return ok(+t.slice(0, 4), +t.slice(4, 6), +t.slice(6, 8));
      return order === 'DMY' ? ok(+t.slice(4), +t.slice(2, 4), +t.slice(0, 2)) : ok(+t.slice(4), +t.slice(0, 2), +t.slice(2, 4));
    }
    if ((m = s.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{2,4})\b/))) {
      var a = +m[1], b = +m[2]; y = y2(m[3]);
      if (a > 12 && b <= 12) return ok(y, b, a);
      if (b > 12 && a <= 12) return ok(y, a, b);
      return order === 'DMY' ? ok(y, b, a) : ok(y, a, b);
    }
    if ((m = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,})\.?[\s\-,]+(\d{2,4})$/))) { mo = MONTHS[m[2].toUpperCase().slice(0, 3)]; if (mo) return ok(y2(m[3]), mo, +m[1]); }
    if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/))) { mo = MONTHS[m[1].toUpperCase().slice(0, 3)]; if (mo) return ok(+m[3], mo, +m[2]); }
    if ((m = s.match(/^(\d{4})$/))) return ok(+m[1]);
    return null;
  }

  function normAddress(house, street) {
    var s = deaccent(((house || '') + ' ' + (street || '')).trim());
    if (!s) return '';
    var comma = s.indexOf(','); if (comma > 0) s = s.slice(0, comma);
    s = s.replace(/#/g, ' UNIT ').replace(/['\u2019`.]/g, '').replace(/[^A-Z0-9 ]+/g, ' ');
    var toks = s.split(/\s+/).filter(Boolean), out = [];
    for (var i = 0; i < toks.length; i++) { if (UNIT_WORDS[toks[i]] && i > 0) break; out.push(STREET_WORDS[toks[i]] || toks[i]); }
    return out.join(' ');
  }
  function normZip(z) { var m = String(z || '').match(/\d{5}/); return m ? m[0] : ''; }

  function splitFullName(full) {
    var s = String(full || '').trim(), first = '', last = '', middle = '';
    if (!s) return { first: first, last: last, middle: middle };
    if (s.indexOf(',') >= 0) {
      var parts = s.split(','); last = parts[0].trim();
      var rest = parts.slice(1).join(' ').trim().split(/\s+/);
      first = rest[0] || ''; middle = rest.slice(1).join(' ');
    } else {
      var t = s.split(/\s+/); first = t[0] || ''; last = t.length > 1 ? t[t.length - 1] : '';
      if (t.length > 2 && SUFFIX[nameTokens(last).join('')]) { last = t[t.length - 2] + ' ' + last; middle = t.slice(1, -2).join(' '); }
      else middle = t.slice(1, -1).join(' ');
    }
    return { first: first, last: last, middle: middle };
  }

  function makeRecord(row, map, order) {
    function g(k) { var ix = map[k]; return (ix !== undefined && ix >= 0 && row[ix] !== undefined) ? String(row[ix]).trim() : ''; }
    var rawFirst = g('first'), rawLast = g('last'), rawMiddle = g('middle'), rawSuffix = g('suffix');
    if ((!rawFirst || !rawLast) && g('fullname')) { var sp = splitFullName(g('fullname')); rawFirst = rawFirst || sp.first; rawLast = rawLast || sp.last; rawMiddle = rawMiddle || sp.middle; }
    var suffix = normSuffix(rawSuffix);
    var lt = nameTokens(rawLast);
    if (lt.length > 1 && SUFFIX[lt[lt.length - 1]]) { var sx = SUFFIX[lt.pop()]; if (!suffix) suffix = sx; }
    var ft = nameTokens(rawFirst), middle = nameTokens(rawMiddle).join('');
    if (ft.length > 1 && SUFFIX[ft[ft.length - 1]] && ft[ft.length - 1].length > 1) { var sf = SUFFIX[ft.pop()]; if (!suffix) suffix = sf; }
    if (ft.length > 1 && ft[ft.length - 1].length === 1) { var mi = ft.pop(); if (!middle) middle = mi; }
    var dobRaw = g('dob'), house = g('house_no'), street = g('street'), zipRaw = g('zip');
    return {
      lastKey: lt.join(''), firstKey: ft.join(''), firstInit: ft.length ? ft.join('')[0] : '',
      midInit: middle ? middle[0] : '', suffix: suffix,
      dob: parseDOB(dobRaw, order), dobRaw: dobRaw,
      addr: normAddress(house, street), zip: normZip(zipRaw),
      id: g('juror_id') || g('voter_id'), reason: g('reason'),
      display: [rawFirst, rawMiddle, rawLast, rawSuffix].filter(Boolean).join(' '),
      addrDisplay: [[house, street].filter(Boolean).join(' '), zipRaw].filter(Boolean).join(', ')
    };
  }

  function reasonValues(text, delim, hasHeader, idx) {
    var counts = {}, first = true;
    if (idx < 0) return [];
    iterCSV(text, delim, function (r) { if (first && hasHeader) { first = false; return; } first = false; var v = (r[idx] || '').trim(); counts[v] = (counts[v] || 0) + 1; });
    return Object.keys(counts).sort().map(function (v) { return { value: v, count: counts[v], auto: !/^[=+\-@\t\r]/.test(v) && NONCITIZEN_RE.test(v) }; });
  }

  /* opts: { order, reasonFilter: null | {value:true} } */
  function buildRecords(text, delim, hasHeader, map, opts) {
    opts = opts || {};
    var recs = [], total = 0, kept = 0, skipped = 0, first = true, rf = opts.reasonFilter || null, rix = map.reason;
    iterCSV(text, delim, function (r) {
      if (first && hasHeader) { first = false; return; } first = false;
      total++;
      if (rf && rix !== undefined && rix >= 0) {
        var v = (r[rix] || '').trim();
        var keep = typeof rf === 'function' ? rf(v) : rf[v];
        if (!keep) return;
      }
      kept++;
      var rec = makeRecord(r, map, opts.order);
      rec.rowNum = total;
      if (!rec.lastKey || !rec.firstKey) { skipped++; return; }
      recs.push(rec);
    });
    return { records: recs, total: total, kept: kept, skipped: skipped };
  }

  var TIERS = ['Strong', 'Probable', 'Weak'];
  function match(jurors, voters) {
    var idx = {};
    voters.forEach(function (v) { (idx[v.lastKey] = idx[v.lastKey] || []).push(v); });
    var pairs = [], counts = { Strong: 0, Probable: 0, Weak: 0 }, jurorBest = {};
    jurors.forEach(function (j, ji) {
      (idx[j.lastKey] || []).forEach(function (v) {
        var bothFirstFull = j.firstKey.length > 1 && v.firstKey.length > 1;
        var firstEq = bothFirstFull && j.firstKey === v.firstKey;
        var initEq = j.firstInit && j.firstInit === v.firstInit;
        var jd = j.dob, vd = v.dob;
        var dobFullBoth = !!(jd && vd && jd.full && vd.full);
        var dobFullEq = dobFullBoth && jd.full === vd.full;
        var yearBoth = !!(jd && vd);
        var yearEq = yearBoth && jd.y === vd.y;
        var dobConflict = (dobFullBoth && !dobFullEq) || (yearBoth && !yearEq);
        var addrEq = !!(j.addr && v.addr && j.addr === v.addr && (!j.zip || !v.zip || j.zip === v.zip));
        var t = -1, f = ['last name'], notes = [];
        if (firstEq && dobFullEq) { t = 0; f.push('first name', 'full DOB'); }
        else if (initEq && dobFullEq) { t = 1; f.push('first initial', 'full DOB'); if (bothFirstFull) notes.push('first names differ (' + j.firstKey + ' / ' + v.firstKey + ')'); }
        else if (firstEq && yearEq && addrEq && !dobConflict) { t = 1; f.push('first name', 'birth year', 'street address'); notes.push('full DOB not in both files'); }
        else if (firstEq) { t = 2; f.push('first name');
          if (dobConflict) notes.push('DOB differs (' + (jd.full || jd.y) + ' / ' + (vd.full || vd.y) + ')');
          else if (!jd || !vd) notes.push('DOB missing in ' + (!jd && !vd ? 'both files' : (!jd ? 'juror record' : 'voter roll')));
          else notes.push('birth year agrees, address does not');
        }
        if (t < 0) return;
        if (addrEq && f.indexOf('street address') < 0) f.push('street address');
        if (j.zip && v.zip && j.zip === v.zip) f.push('ZIP');
        if (j.midInit && v.midInit) { if (j.midInit === v.midInit) f.push('middle initial'); else { notes.push('middle initial conflict (' + j.midInit + ' / ' + v.midInit + '): tier lowered'); t = Math.min(2, t + 1); } }
        if (j.suffix && v.suffix) { if (j.suffix === v.suffix) f.push('suffix'); else { notes.push('suffix conflict (' + j.suffix + ' / ' + v.suffix + '): tier lowered'); t = Math.min(2, t + 1); } }
        var tier = TIERS[t]; counts[tier]++;
        if (jurorBest[ji] === undefined || t < jurorBest[ji]) jurorBest[ji] = t;
        pairs.push({ tier: tier, tierRank: t, voterId: v.id, voterName: v.display, voterDob: vd ? (vd.full || String(vd.y)) : v.dobRaw,
          voterAddress: v.addrDisplay, jurorId: j.id || ('row ' + j.rowNum), reason: j.reason,
          matched: f.join(', ') + (notes.length ? '. Note: ' + notes.join('; ') : ''),
          jurorName: j.display, jurorDob: jd ? (jd.full || String(jd.y)) : j.dobRaw });
      });
    });
    pairs.sort(function (a, b) { return a.tierRank - b.tierRank || String(a.voterName).localeCompare(String(b.voterName)); });
    var jurorsByBest = { Strong: 0, Probable: 0, Weak: 0 };
    Object.keys(jurorBest).forEach(function (k) { jurorsByBest[TIERS[jurorBest[k]]]++; });
    return { pairs: pairs, counts: counts, jurorsByBest: jurorsByBest, jurorsMatched: Object.keys(jurorBest).length };
  }

  var EXPORT_COLS = [['tier','Tier'],['voterId','Voter ID'],['voterName','Voter name'],['voterDob','Voter DOB'],['voterAddress','Voter address'],
    ['jurorId','Juror record ID'],['reason','Disqualification reason'],['matched','Matched fields'],['jurorName','Juror name (as recorded)'],['jurorDob','Juror DOB (as recorded)']];
  function csvCell(v) {
    var s = v === undefined || v === null ? '' : String(v);
    if (!/^-?\d+(\.\d+)?$/.test(s) && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(pairs, includeWeak, dateStr) {
    var rows = pairs.filter(function (p) { return includeWeak || p.tier !== 'Weak'; });
    var lines = [
      csvCell('Referral for official verification'),
      csvCell('Leads only. A match is not proof of non-citizenship. Only election officials can verify citizenship. Send to the county board of elections. Do not publish.'),
      csvCell('Made with JuryRoll v1 on ' + dateStr + '. Tiers included: Strong, Probable' + (includeWeak ? ', Weak (name only - caution)' : '') + '. Rows: ' + rows.length + '.'),
      '',
      EXPORT_COLS.map(function (c) { return csvCell(c[1]); }).join(',')
    ];
    rows.forEach(function (p) { lines.push(EXPORT_COLS.map(function (c) { return csvCell(p[c[0]]); }).join(',')); });
    return lines.join('\r\n') + '\r\n';
  }

  return { FIELDS: FIELDS, JUROR_FIELDS: JUROR_FIELDS, VOTER_FIELDS: VOTER_FIELDS, NONCITIZEN_RE: NONCITIZEN_RE, EXPORT_COLS: EXPORT_COLS,
    detectDelimiter: detectDelimiter, iterCSV: iterCSV, readHead: readHead, guessMapping: guessMapping, parseDOB: parseDOB,
    normAddress: normAddress, makeRecord: makeRecord, reasonValues: reasonValues, buildRecords: buildRecords, match: match, toCSV: toCSV };
})();
export default JuryRollCore;
