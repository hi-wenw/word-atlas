import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const scope = "https://example.test/words/";

function worker(online = false) {
  const handlers: Record<string, (event: any) => void> = {};
  const storage = new Map<string, Map<string, Response>>();
  const key = (req: string | Request) => typeof req === "string" ? req : req.url;
  const caches = {
    keys: async () => [...storage.keys()],
    delete: async (name: string) => storage.delete(name),
    open: async (name: string) => {
      if (!storage.has(name)) storage.set(name, new Map());
      const cache = storage.get(name)!;
      return {
        keys: async () => [...cache.keys()],
        match: async (req: string | Request) => cache.get(key(req))?.clone(),
        put: async (req: string | Request, res: Response) => { cache.set(key(req), res); },
        delete: async (req: string | Request) => cache.delete(key(req)),
      };
    },
  };
  runInNewContext(source, {
    URL, caches,
    fetch: async () => {
      if (!online) throw new Error("offline");
      const response = new Response("network");
      Object.defineProperty(response, "type", { value: "basic" });
      return response;
    },
    self: {
      registration: { scope },
      clients: { claim: async () => {} },
      skipWaiting: () => {},
      addEventListener: (name: string, handler: (event: any) => void) => { handlers[name] = handler; },
    },
  });
  return { handlers, caches, storage };
}

test("worker upgrades only its own scope's caches", async () => {
  const { handlers, caches, storage } = worker();
  const own = `word-atlas:${scope}:`;
  const names = ["another-app", "atlas-v1-shell", "word-atlas:https://example.test/other/:v1-shell", `${own}v1-shell`, `${own}v2-shell`];
  for (const name of names) await caches.open(name);
  let done!: Promise<unknown>;
  handlers.activate({ waitUntil: (p: Promise<unknown>) => { done = p; } });
  await done;
  assert.deepEqual([...storage.keys()], names.filter((n) => n !== `${own}v1-shell`));
});

test("worker does not intercept requests outside its path scope or partial media", () => {
  const { handlers } = worker();
  for (const url of ["https://example.test/other/image.webp", "https://elsewhere.test/words/image.webp", `${scope}../private.json`]) {
    handlers.fetch({ request: new Request(url), respondWith: () => assert.fail("outside scope") });
  }
  handlers.fetch({ request: new Request(`${scope}audio.mp3`, { headers: { range: "bytes=0-" } }), respondWith: () => assert.fail("partial response") });
});

test("offline JSON never falls back to HTML or another application's cache", async () => {
  const { handlers, caches } = worker();
  await (await caches.open(`word-atlas:${scope}:v2-shell`)).put(scope, new Response("<html>shell</html>"));
  await (await caches.open("another-app")).put(`${scope}atlas/index.json`, new Response("wrong dataset"));
  let response!: Promise<Response>;
  let done!: Promise<unknown>;
  handlers.fetch({
    request: new Request(`${scope}atlas/index.json`),
    respondWith: (p: Promise<Response>) => { response = p; },
    waitUntil: (p: Promise<unknown>) => { done = p; },
  });
  await assert.rejects(response, /offline/);
  await done;
});

test("fetch event retains the worker until a successful response is cached", async () => {
  const { handlers, caches } = worker(true);
  const request = new Request(`${scope}atlas/img/library.webp`);
  let response!: Promise<Response>;
  let done!: Promise<unknown>;
  handlers.fetch({ request, respondWith: (p: Promise<Response>) => { response = p; }, waitUntil: (p: Promise<unknown>) => { done = p; } });
  assert.equal(await (await response).text(), "network");
  await done;
  assert.equal(await (await (await caches.open(`word-atlas:${scope}:v2-media`)).match(request))?.text(), "network");
});
