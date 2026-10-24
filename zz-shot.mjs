import { chromium } from 'playwright';
const [,, file, out] = process.argv;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 760 } });
await pg.goto('file://' + file); await pg.screenshot({ path: out }); await b.close();
