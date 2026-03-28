const { parse } = require('csv-parse/sync');

/**
 * Parse Google Contacts "Contacts" CSV export (Google Takeout or Contacts → Export).
 * Maps flexible column names to { name, phone, email, relationLabel }.
 */
function parseGoogleContactsCsv(csvText) {
  const bomStripped = String(csvText || '').replace(/^\uFEFF/, '');
  if (!bomStripped.trim()) {
    return { contacts: [], meta: { rowCount: 0, skipped: 0, message: 'Empty file' } };
  }

  let records;
  try {
    records = parse(bomStripped, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (e) {
    return {
      contacts: [],
      meta: { rowCount: 0, skipped: 0, message: `CSV parse error: ${e.message}` },
    };
  }

  const contacts = [];
  let skipped = 0;

  for (const row of records) {
    const keys = Object.keys(row || {});
    const val = (pred) => {
      const k = keys.find(pred);
      return k ? String(row[k] ?? '').trim() : '';
    };

    const given = val((k) => /^given name$/i.test(k));
    const family = val((k) => /^family name$/i.test(k) || /^last name$/i.test(k));
    const middle = val((k) => /^middle name$/i.test(k));
    const full = val((k) => /^name$/i.test(k));

    let name = full;
    if (!name) {
      name = [given, middle, family].filter(Boolean).join(' ').trim();
    }
    if (!name) name = val((k) => /^organization name$/i.test(k));

    let phone = '';
    for (const k of keys) {
      if (/phone \d+ - value/i.test(k) || /^phone$/i.test(k)) {
        const p = String(row[k] ?? '').trim();
        if (p && p.replace(/\D/g, '').length >= 8) {
          phone = p;
          break;
        }
      }
    }

    let email = '';
    for (const k of keys) {
      if (/e-?mail \d+ - value/i.test(k) || /^e-?mail$/i.test(k)) {
        const e = String(row[k] ?? '').trim();
        if (e.includes('@')) {
          email = e;
          break;
        }
      }
    }

    const labels = val((k) => /^labels$/i.test(k)) || val((k) => /group membership/i.test(k));
    const notes = val((k) => /^notes$/i.test(k));
    const org = val((k) => /organization \d+ - name/i.test(k)) || val((k) => /^company$/i.test(k));
    const title = val((k) => /job title/i.test(k)) || val((k) => /^title$/i.test(k));

    const relationParts = [labels, notes, org, title].filter(Boolean);
    const relationLabel = relationParts.join(' | ');

    if (!name && !phone && !email) {
      skipped += 1;
      continue;
    }
    if (!name) {
      skipped += 1;
      continue;
    }

    contacts.push({
      name,
      phone: phone || '',
      email: email || '',
      relationLabel,
    });
  }

  return {
    contacts,
    meta: {
      rowCount: records.length,
      skipped,
      imported: contacts.length,
    },
  };
}

module.exports = { parseGoogleContactsCsv };
