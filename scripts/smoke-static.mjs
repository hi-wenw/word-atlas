#!/usr/bin/env node
// Exercise an already-running production build; never installs browsers or deploys.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = new URL(process.argv[2] || "http://127.0.0.1:5190/");
assert.ok(base.pathname.endsWith("/"), "Base URL must end with /");
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const external = new Set();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (new URL(r.url()).origin !== base.origin && /^https?:/.test(r.url())) external.add(r.url()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem("word-atlas:settings")) localStorage.setItem("word-atlas:settings", JSON.stringify({ onboarded: true, splash: false, ambience: "off", sfx: false, autoplay: false }));
  });
  const wordURL = new URL("#/atlas?w=library", base).href;
  await page.goto(wordURL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "library", exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // Revisit under worker control to populate the on-demand offline cache.
  await page.reload({ waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog", { name: "library 词条", exact: true });
  await dialog.waitFor();
  await page.waitForFunction(() => [...document.images].some((i) => i.complete && i.naturalWidth > 0));
  await dialog.getByRole("button", { name: "收藏", exact: true }).click();
  await dialog.getByRole("button", { name: "取消收藏", exact: true }).waitFor();
  // Confirm actual media playback begins, rather than counting a 200 response as playback.
  const audio = await page.evaluate(async (url) => {
    const audio = new Audio(url);
    await audio.play();
    const result = { paused: audio.paused, readyState: audio.readyState };
    audio.pause();
    return result;
  }, new URL("atlas/audio/uk/library.mp3", base).href);
  assert.equal(audio.paused, false);
  assert.ok(audio.readyState >= 2);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto(new URL("#/me", base).href);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(backup.app, "word-atlas");
  assert.ok(backup.progress.bookmarks.includes("library"));
  // Import a real nonempty FSRS card and verify it survives a refresh and export.
  backup.progress.cards.library = { due: 1, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 };
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByText("已恢复 1 个词的记忆", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  const secondEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const second = JSON.parse(await readFile(await (await secondEvent).path(), "utf8"));
  assert.deepEqual(second.progress.cards.library, backup.progress.cards.library);
  assert.ok(second.progress.bookmarks.includes("library"));
  const manifest = await (await context.request.get(new URL("manifest.webmanifest", base).href)).json();
  assert.equal(new URL(manifest.start_url, new URL("manifest.webmanifest", base)).href, base.href);
  const html = await (await context.request.get(base.href)).text();
  assert.ok(!html.includes("0xlei.tech"));
  for (const file of ["LICENSE", "CONTENT_LICENSE.md", "FRAUNCES_LICENSE.txt"]) assert.equal((await context.request.get(new URL(file, base).href)).status(), 200);
  await page.goto(wordURL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "library", exact: true }).waitFor();
  // A cached image and app shell must still work after a real offline reload.
  await context.setOffline(true);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "library", exact: true }).waitFor();
  await page.waitForFunction(() => [...document.images].some((i) => i.complete && i.naturalWidth > 0));
  await page.getByRole("button", { name: "取消收藏", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual([...external], []);
  console.log(JSON.stringify({ base: base.href, wordDialog: "passed", recordedAudioPlayback: "passed", bookmarkAndRefresh: "passed", backupImportExportWithFSRSCard: "passed", offlineReloadWithImage: "passed", externalRequests: [...external], pageErrors: errors }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
