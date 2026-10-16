#!/usr/bin/env node
/**
 * スマホでPDF・印刷したときの紙面を確かめる
 *   node verify/print-mobile.mjs [出力フォルダ] [--desktop]
 * Chrome をスマホ（iPhone 相当 390px・文字自動拡大あり）として動かし、ひよりさんの命式を立てて A4 の PDF にする。
 * 出力フォルダに mobile.pdf（--desktop なら desktop.pdf）を書く。PNG化は print-pages.py で。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(here, 'out');
const desktop = process.argv.includes('--desktop');
mkdirSync(out, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 9333 + Math.floor(Math.random() * 500);
const prof = path.join(out, 'chrome-prof');
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const wait = {};
const send = (method, params = {}) => new Promise(res => { const i = ++id; wait[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let tgt;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(250); try { tgt = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait[m.id]) { wait[m.id](m.result || m.error); delete wait[m.id]; } };
  await send('Page.enable'); await send('Runtime.enable');
  if (!desktop) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  }
  await send('Page.navigate', { url: pathToFileURL(path.join(here, '..', 'index.html')).href });
  await sleep(3500);
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async()=>{
    const $=i=>document.getElementById(i);
    $('nameSei').value='春野'; $('nameMei').value='ひより'; $('birth').value='1998-05-14'; $('sex').value='女性';
    const h=$('hour'); h.value=[...h.options].find(o=>/^14/.test(o.value)||o.textContent.startsWith('14'))?.value ?? h.value;
    $('go').click(); await new Promise(r=>setTimeout(r,1500));
    return { hour:h.value, who:($('who')||{}).textContent, width:innerWidth };
  })()` });
  console.log('命式を立てた:', JSON.stringify(r.result && r.result.value));
  const pdf = await send('Page.printToPDF', { paperWidth: 8.27, paperHeight: 11.69, printBackground: true, preferCSSPageSize: true });
  const file = path.join(out, desktop ? 'desktop.pdf' : 'mobile.pdf');
  writeFileSync(file, Buffer.from(pdf.data, 'base64'));
  console.log('PDF:', file);
} finally { try { ws && ws.close(); } catch {} ch.kill(); }
