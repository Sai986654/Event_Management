const { parseGoogleContactsCsv } = require('../utils/googleContactsCsv');

describe('parseGoogleContactsCsv', () => {
  it('parses Google-style headers into contacts', () => {
    const csv = [
      'Given Name,Family Name,Phone 1 - Value,E-mail 1 - Value,Labels,Notes',
      '"Jane","Doe","+91 98100 11223","jane@example.com","Family","Sister side"',
      '"Alex","Smith","9876500011","alex@work.com","Work","Manager"',
    ].join('\n');

    const { contacts, meta } = parseGoogleContactsCsv(csv);
    expect(meta.imported).toBe(2);
    expect(contacts[0].name).toMatch(/Jane/);
    expect(contacts[0].relationLabel).toMatch(/Family|Sister/);
    expect(contacts[1].relationLabel).toMatch(/Work|Manager/);
  });
});
