import { CouchClient } from "./couch.ts";
import {
  assert,
  assertEquals,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import open = Deno.open;
const { test } = Deno;

const kDbName = "testdb";
const endpoint = Deno.env.get("COUCHDB_ENDPOINT") || "http://127.0.0.1:5984";
const client = new CouchClient(endpoint);
const db = client.database<any>(kDbName);

if (await client.databaseExists(kDbName)) {
  await client.deleteDatabase(kDbName);
}
await client.createDatabase(kDbName);

async function useDatabase(f: (db: string) => Promise<unknown>) {
  const name = "testdb-" + Math.round(Math.random() * 10000000);
  return client
    .databaseExists(name)
    .then((ok) => (ok ? null : client.createDatabase(name)))
    .then((_) => f(name))
    .finally(async () => {
      if (await client.databaseExists(name)) {
        await client.deleteDatabase(name);
      }
    });
}

test({
  name: "metadata",
  fn: async () => {
    const data = await client.metadata();
    assertEquals(data.couchdb, "Welcome");
  },
});
test({
  name: "databaseExists",
  fn: async () => {
    const exists = await client.databaseExists("nodb");
    assertEquals(exists, false);
  },
});

test({
  name: "createDatabase",
  fn: async () => {
    const db = "testdb1";
    try {
      assertEquals(await client.databaseExists(db), false);
      const { ok } = await client.createDatabase(db);
      assertEquals(ok, true);
    } finally {
      await client.deleteDatabase(db);
    }
  },
});
test({
  name: "getDatabase",
  fn: async function getDatabase() {
    await useDatabase(async (db) => {
      const info = await client.getDatabase(db);
      assertEquals(info.db_name, db);
    });
  },
});

test({
  name: "deleteDatabase",
  fn: async function deleteDatabase() {
    await useDatabase(async (db) => {
      const { ok } = await client.deleteDatabase(db);
      assertEquals(ok, true);
      assertEquals(await client.databaseExists(db), false);
    });
  },
});

test({
  name: "createDocument",
  fn: async function createDocument() {
    const obj = {
      name: "deno",
      nice: true,
    };
    await useDatabase(async (_) => {
      const res = await db.insert(obj);
      assertEquals(res.ok, true);
    });
  },
});
test({
  name: "getDocument",
  fn: async function getDocument() {
    const obj = {
      name: "deno",
      nice: true,
      years: [2018, 2019],
    };
    await useDatabase(async (_) => {
      const res = await db.insert(obj);
      assertEquals(res.ok, true);
      const doc = await db.get(res.id);
      assertEquals(doc["_id"], res.id);
      assertEquals(doc["name"], "deno");
      assertEquals(doc["nice"], true);
      assertEquals(doc["years"], [2018, 2019]);
    });
  },
});
test({
  name: "putDocument",
  fn: async function putDocument() {
    const doc = {
      name: "deno",
      nice: true,
      years: [2018, 2019],
    };
    const _id = "denode";
    const { id, rev, ok } = await db.put(_id, doc);
    assertEquals(id, _id);
    assertEquals(ok, true);
    const doc2 = {
      name: "node",
      nice: true,
      years: [2009, 2019],
    };
    const res = await db.put(id, doc2, { rev });
    assertEquals(res.id, id);
    const _doc = await db.get(id);
    assertEquals(_doc["name"], "node");
    assertEquals(_doc["nice"], true);
    assertEquals(_doc["years"], [2009, 2019]);
  },
});
test({
  name: "documentInfo",
  fn: async function documentInfo() {
    const { id } = await db.insert({ name: "deno" });
    const info = await db.info(id);
    assert(info !== void 0, "info must be defined");
    assertEquals(await db.info("xxx"), void 0);
  },
});
test({
  name: "deleteDocument",
  fn: async function deleteDocument() {
    const doc = {
      name: "deno",
    };
    const { id, rev } = await db.insert(doc);
    const res = await db.delete(id, rev);
    assertEquals(res.id, id);
    assertEquals(await db.info(id), void 0);
  },
});

test({
  name: "copyDocument",
  fn: async function copyDocument() {
    await db.put("deno", {
      myNameIs: "deno",
    });
    await db.copy("deno", "node");
    const o = await db.get("node");
    assertEquals(o["myNameIs"], "deno");
  },
});

test({
  name: "findDocument",
  fn: async function findDocument() {
    await Promise.all([
      db.insert({
        id: 100,
        name: "deno",
      }),
      db.insert({
        id: 101,
        name: "node",
      }),
    ]);
    const res = await db.find<any>({
      id: 100,
    });
    assertEquals(res.docs.length, 1);
    assertEquals(res.docs[0]["id"], 100);
    assertEquals(res.docs[0]["name"], "deno");
  },
});

test({
  name: "putAttachment",
  fn: async function putAttachment() {
    const { id, rev } = await db.insert({
      name: "couch.ts",
    });
    const data = await open("./fixtures/sample.json");
    const res = await db.putAttachment(id, "fixtures/sample.json", {
      contentType: "application/json",
      data,
      rev,
    });
    assertEquals(res.ok, true);
    data.close();
  },
});

test({
  name: "getAttachment",
  fn: async function getAttachment() {
    const { id, rev } = await db.insert({
      name: "couch.ts",
    });
    const data = await open("./fixtures/sample.json");
    await db.putAttachment(id, "fixtures/sample.json", {
      contentType: "application/json",
      data,
      rev,
    });
    const attach = await db.getAttachment(id, "fixtures/sample.json");
    const json = new TextDecoder().decode(attach);
    const content = JSON.parse(json);
    assertEquals(content["deno"], "land");
    data.close();
  },
});

test({
  name: "deleteAttachment",
  fn: async function deleteAttachment() {
    const { id, rev } = await db.insert({
      name: "couch.ts",
    });
    const data = await open("./fixtures/sample.json");
    const at = await db.putAttachment(id, "fixtures/sample.json", {
      contentType: "application/json",
      data,
      rev,
    });
    await db.deleteAttachment(id, "fixtures/sample.json", at.rev);
    const res = await db.attachmentInfo(id, "fixtures/sample.json", {
      rev,
    });
    assertEquals(res, void 0);
    data.close();
  },
});
