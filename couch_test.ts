import { runIfMain, test } from "https://deno.land/std@v0.7.0/testing/mod.ts";
import { CouchClient } from "./couch.ts";
import {
  assert,
  assertEquals
} from "https://deno.land/std@v0.7.0/testing/asserts.ts";

const kDbName = "testdb";
const client = new CouchClient("http://localhost:5984");
const db = client.database(kDbName);

async function beforeAll() {
  if (await client.databaseExists(kDbName)) {
    await client.deleteDatabase(kDbName);
  }
  await client.createDatabase(kDbName);
}

async function afterAll() {
  await client.deleteDatabase(kDbName);
}

async function useDatabase(f: (db: string) => Promise<unknown>) {
  const name = "testdb-" + Math.round(Math.random() * 10000000);
  return client
    .databaseExists(name)
    .then(ok => (ok ? null : client.createDatabase(name)))
    .then(_ => f(name))
    .finally(async () => {
      if (await client.databaseExists(name)) {
        await client.deleteDatabase(name);
      }
    });
}

test(async function metadata() {
  const data = await client.metadata();
  assertEquals(data.couchdb, "Welcome");
  assertEquals(data.version, "2.3.0");
});
test(async function databaseExists() {
  const exists = await client.databaseExists("nodb");
  assertEquals(exists, false);
});
test(async function createDatabase() {
  const db = "testdb1";
  try {
    assertEquals(await client.databaseExists(db), false);
    const { ok } = await client.createDatabase(db);
    assertEquals(ok, true);
  } finally {
    await client.deleteDatabase(db);
  }
});
test(async function getDatabase() {
  await useDatabase(async db => {
    const info = await client.getDatabase(db);
    assertEquals(info.db_name, db);
  });
});
test(async function deleteDatabase() {
  await useDatabase(async db => {
    const { ok } = await client.deleteDatabase(db);
    assertEquals(ok, true);
    assertEquals(await client.databaseExists(db), false);
  });
});

test(async function createDocument() {
  const obj = {
    name: "deno",
    nice: true
  };
  await useDatabase(async _ => {
    const res = await db.insert(obj);
    assertEquals(res.ok, true);
  });
});
test(async function getDocument() {
  const obj = {
    name: "deno",
    nice: true,
    years: [2018, 2019]
  };
  await useDatabase(async _ => {
    const res = await db.insert(obj);
    assertEquals(res.ok, true);
    const doc = await db.get(res.id);
    assertEquals(doc["_id"], res.id);
    assertEquals(doc["name"], "deno");
    assertEquals(doc["nice"], true);
    assertEquals(doc["years"], [2018, 2019]);
  });
});
test(async function putDocument() {
  const doc = {
    name: "deno",
    nice: true,
    years: [2018, 2019]
  };
  const _id = "denode";
  const { id, rev, ok } = await db.put(_id, doc);
  assertEquals(id, _id);
  assertEquals(ok, true);
  const doc2 = {
    name: "node",
    nice: true,
    years: [2009, 2019]
  };
  const res = await db.put(id, doc2, { rev });
  assertEquals(res.id, id);
  const _doc = await db.get(id);
  assertEquals(_doc["name"], "node");
  assertEquals(_doc["nice"], true);
  assertEquals(_doc["years"], [2009, 2019]);
});
test(async function documentInfo() {
  const { id } = await db.insert({ name: "deno" });
  const info = await db.info(id);
  assert(info !== void 0, "info must be defined");
  assertEquals(await db.info("xxx"), void 0);
});
test(async function deleteDocument() {
  const doc = {
    name: "deno"
  };
  const { id, rev } = await db.insert(doc);
  const res = await db.delete(id, rev);
  assertEquals(res.id, id);
  assertEquals(await db.info(id), void 0);
});

beforeAll()
  .then(() =>
    runIfMain(import.meta, {
      parallel: true
    })
  )
  .then(afterAll);
