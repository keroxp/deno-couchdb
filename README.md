# deno-couchdb

![https://travis-ci.com/keroxp/deno-couchdb](https://travis-ci.com/keroxp/deno-couchdb.svg?branch=master)
![https://img.shields.io/github/tag/keroxp/deno-couchdb.svg](https://img.shields.io/github/tag/keroxp/deno-couchdb.svg)
[![license](https://img.shields.io/github/license/keroxp/deno-couchdb.svg)](https://github.com/keroxp/deno-couchdb)
[![tag](https://img.shields.io/badge/deno__std-v0.9.0-green.svg)](https://github.com/denoland/deno_std)
[![tag](https://img.shields.io/badge/deno-v0.9.0-green.svg)](https://github.com/denoland/deno)

CouchDB client for Deno built top of fetch

# Usage

```ts
import { CouchClient } from "https://denopkg.com/keroxp/deno-couchdb/couch.ts";

export type User = {
  id: number;
  name: string;
  years: number[];
};
async function main() {
  // create couch client with endpoint
  const couch = new CouchClient("http://localhost:5984");
  // choose db to use
  const db = couch.database<User>("users");
  // check if specified database exists
  if (!(await couch.databaseExists("users"))) {
    // create new database
    await couch.createDatabase("users");
  }
  // insert new document
  const uesr = {
    id: 100,
    name: "deno",
    years: [2018, 2019]
  };
  const { id, rev } = await db.insert(user);
  // get existing document
  let user = await db.get(id); // {id: 100, name: "deno", years: [2018,2019]}
  // update existing document
  user.years.push(2020);
  await db.put(id, user, { rev });
  // delete existing document
  await db.delete(id);
}
```

# Compatibility Table

## Document

- [x] `HEAD /{db}/{docid}`
- [x] `GET /{db}/{docid}`
- [x] `PUT /{db}/{docid}`
- [x] `DELETE /{db}/{docid}`
- [x] `COPY /{db}/{docid}`

## Attachments

- [x] `HEAD /{db}/{docid}/{attname}`
- [x] `GET /{db}/{docid}/{attname}`
- [x] `PUT /{db}/{docid}/{attname}`
- [x] `DELETE /{db}/{docid}/{attname}`

## Server

- WIP...

## Contributing

WELCOME!  
There are still missing features and actually I'm not familiar with CouchDB😇