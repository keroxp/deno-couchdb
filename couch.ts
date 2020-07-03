import Reader = Deno.Reader;
import Buffer = Deno.Buffer;
import copy = Deno.copy;

export type CouchResponse = {
  id: string;
  ok: boolean;
  rev: string;
};
export type CouchMetadata = {
  couchdb: string;
  uuid: string;
  vendor: {
    name: string;
    version: string;
  };
  version: string;
};
export type CouchDatabaseInfo = {
  cluster: {
    n: number;
    q: number;
    r: number;
    w: number;
  };
  compact_running: boolean;
  data_size: number;
  db_name: string;
  disk_format_version: number;
  disk_size: number;
  doc_count: number;
  doc_del_count: number;
  instance_start_time: "0";
  /** @deprecated */
  other: {
    data_size: number;
  };
  purge_seq: number;
  sizes: {
    active: number;
    external: number;
    file: number;
  };
  update_seq: string;
};

export type CouchDocument = {
  _id: string;
  _ok: boolean;
  _rev: string;
  _deleted?: boolean;
  _attachments?: {
    [file: string]: {
      content_type: string;
      digest: string;
      data?: string;
      length: number;
      revpos: number;
      stub?: boolean;
      encoding?: string;
      encoded_length?: number;
    };
  };
  _conflicts?: any[];
  _deleted_conflicts?: any[];
  _local_seq?: string;
  _revs_info?: any[];
  _revisions?: {
    ids: string;
    start: number;
  };
};

export class CouchError extends Error {
  constructor(
    readonly status: number,
    readonly error: string,
    readonly reason?: string,
  ) {
    super(status + ":" + error);
  }
}

export type NotModified = Symbol;
export const NotModified = Symbol("NotModified");
export type CouchOptions = {
  basicAuth?: {
    username: string;
    password: string;
  };
};

function makeFetch(
  endpoint: string,
  opts: CouchOptions = {},
) {
  return (
    path: string,
    {
      method = "GET",
      body,
      headers = new Headers(),
    }: {
      method: string;
      body?: string | ArrayBuffer;
      headers?: Headers;
    },
  ) => {
    if (opts.basicAuth) {
      const { username, password } = opts.basicAuth;
      const authorization = `Basic ${btoa(username + ":" + password)}`;
      headers.set("authorization", authorization);
    }
    console.log('inside makefetch', `${endpoint}` + path)
    return fetch(`${endpoint}` + path, {
      headers,
      body,
      method,
    });
  };
}

class CouchDatabase<T> {
  constructor(
    readonly endpoint: string,
    readonly db: string,
    readonly opts: CouchOptions = {},
  ) {}

  private fetch = makeFetch(`${this.endpoint}/${this.db}`, this.opts);

  async insert(
    doc: T,
    opts?: {
      batch?: "ok";
      fullCommit?: boolean;
    },
  ): Promise<{
    id: string;
    ok: boolean;
    rev: string;
  }> {
    const headers = new Headers({
      "content-type": "application/json",
      accept: "application/json",
    });
    let path = "";
    if (opts) {
      if (opts.fullCommit != null) {
        headers.set("X-Couch-Full-Commit", opts.fullCommit ? "true" : "false");
      }
      if (opts.batch != null) {
        path += "?batch=ok";
      }
    }
    const body = JSON.stringify(doc);
    const res = await this.fetch(path, {
      method: "POST",
      headers,
      body,
    });
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async info(id: string): Promise<Headers | undefined> {
    const res = await this.fetch(`/${id}`, {
      method: "HEAD",
    });
    await res.text();
    if (res.status === 200 || res.status === 304) {
      return res.headers;
    } else if (res.status === 404) {
      return void 0;
    }
    throw new CouchError(res.status, await res.text());
  }

  async get(
    id: string,
    opts?: Partial<{
      attachments: boolean;
      att_encoding_info: boolean;
      atts_since: any[];
      conflicts: boolean;
      deleted_conflicts: boolean;
      latest: boolean;
      local_seq: boolean;
      meta: boolean;
      open_revs: any[];
      rev: string;
      revs: boolean;
      revs_info: boolean;
    }>,
  ): Promise<(CouchDocument & T) | NotModified> {
            console.log('inside get')
    const res = await this._get("json", id, opts);
    console.log('res', res);
    const json = await res.json();
    console.log('json', json);
    return json;
  }

  async getMultipart(
    id: string,
    opts?: Partial<{
      attachments: boolean;
      att_encoding_info: boolean;
      atts_since: any[];
      conflicts: boolean;
      deleted_conflicts: boolean;
      latest: boolean;
      local_seq: boolean;
      meta: boolean;
      open_revs: any[];
      rev: string;
      revs: boolean;
      revs_info: boolean;
    }>,
  ): Promise<Response> {
    return this._get("multipart", id, opts);
  }

  async _get(
    accept: "json" | "multipart",
    id: string,
    opts?: Partial<{
      attachments: boolean;
      att_encoding_info: boolean;
      atts_since: any[];
      conflicts: boolean;
      deleted_conflicts: boolean;
      latest: boolean;
      local_seq: boolean;
      meta: boolean;
      open_revs: any[];
      rev: string;
      revs: boolean;
      revs_info: boolean;
    }>,
  ): Promise<String> {
             return Promise.resolve( 'inside _Get')
    //console.log('inside _Get')
             /*
    const params = new URLSearchParams();
    if (opts != null) {
      if (opts.attachments != null) {
        params.set("attachments", opts.attachments ? "true" : "false");
      }
      if (opts.att_encoding_info != null) {
        params.set(
          "att_encoding_info",
          opts.att_encoding_info ? "true" : "false",
        );
      }
    }
    console.log('inside _Get, before this fetch')
    const res = await this.fetch(`/${id}?${params.toString()}`, {
      method: "GET",
      headers: new Headers({ accept }),
    });
console.log('res _get', res);
    if (res.status === 200 || res.status === 304) {
      return res;
    }
    throw new CouchError(res.status, await res.text());
    */
  }

  async put(
    id: string,
    doc: T,
    opts?: {
      fullCommit?: boolean;
      rev?: string;
      batch?: "ok";
      new_edits?: boolean;
    },
  ): Promise<{ id: string; ok: boolean; rev: string }> {
    const body = JSON.stringify(doc);
    const headers = new Headers({
      "content-type": "application/json",
      accept: "application/json",
    });
    let params = new URLSearchParams();
    if (opts) {
      if (opts.fullCommit != null) {
        headers.set("X-Couch-Full-Commit", opts.fullCommit ? "true" : "false");
      }
      if (opts.rev) {
        params.append("rev", opts.rev);
      }
      if (opts.batch) {
        params.append("batch", "ok");
      }
      if (opts.new_edits != null) {
        params.append("new_edits", opts.new_edits ? "true" : "false");
      }
    }
    const res = await this.fetch(`/${id}?${params.toString()}`, {
      method: "PUT",
      headers,
      body,
    });
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async copy(
    id: string,
    destination: string,
    opts?: {
      rev?: string;
      batch?: "ok";
      fullCommit?: boolean;
    },
  ): Promise<CouchResponse> {
    const params = new URLSearchParams();
    const headers = new Headers({
      destination,
      accept: "application/json",
    });
    if (opts) {
      if (opts.fullCommit != null) {
        headers.set("X-Couch-Full-Commit", opts.fullCommit ? "true" : "false");
      }
      if (opts.rev) {
        params.append("rev", opts.rev);
      }
      if (opts.batch) {
        params.append("batch", "ok");
      }
    }
    const res = await this.fetch(`/${id}?${params.toString()}`, {
      method: "COPY",
      headers,
    });
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async delete(
    id: string,
    rev: string,
    opts?: {
      batch?: "ok";
      fullCommit?: boolean;
    },
  ): Promise<CouchResponse> {
    const headers = new Headers({
      "content-type": "application/json",
    });
    let params = new URLSearchParams();
    params.append("rev", rev);
    if (opts) {
      if (opts.fullCommit != null) {
        headers.set("X-Couch-Full-Commit", opts.fullCommit ? "true" : "false");
      }
      if (opts.batch) {
        params.append("batch", "ok");
      }
    }
    const res = await this.fetch(`/${id}?${params.toString()}`, {
      method: "DELETE",
      headers: new Headers({
        accept: "application/json",
      }),
    });
    if (res.status === 200 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async attachmentInfo(
    id: string,
    attachment: string,
    opts?: {
      rev: string;
    },
  ): Promise<Headers | undefined> {
    const params = new URLSearchParams();
    if (opts) {
      params.append("rev", opts.rev);
    }
    const res = await this.fetch(`/${id}/${attachment}?${params.toString()}`, {
      method: "GET",
      headers: new Headers({
        accept: "application/json",
      }),
    });
    await res.text();
    if (res.status === 200) {
      return res.headers;
    } else if (res.status === 404) {
      return;
    }
    throw new CouchError(res.status, await res.text());
  }

  async getAttachment(
    id: string,
    attachment: string,
    opts?: {
      rev: string;
    },
  ): Promise<ArrayBuffer> {
    const params = new URLSearchParams();
    if (opts) {
      params.append("rev", opts.rev);
    }
    const res = await this.fetch(`/${id}/${attachment}?${params.toString()}`, {
      method: "GET",
    });
    if (res.status === 200) {
      return res.arrayBuffer();
    }
    throw new CouchError(res.status, await res.text());
  }

  async putAttachment(
    id: string,
    attachment: string,
    {
      data,
      contentType,
      rev,
    }: {
      data: Reader;
      contentType: string;
      rev?: string;
    },
  ): Promise<CouchResponse> {
    const params = new URLSearchParams();
    const headers = new Headers({
      "content-type": contentType,
      accept: "application/json",
    });
    if (rev != null) {
      params.append("rev", rev);
    }
    // TODO: use ReadableStream if possible
    const buf = new Buffer();
    await copy(data, buf);
    const res = await this.fetch(`/${id}/${attachment}?${params.toString()}`, {
      method: "PUT",
      headers,
      body: buf.bytes(),
    });
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async deleteAttachment(
    id: string,
    attachment: string,
    rev: string,
    opts?: {
      fullCommit?: boolean;
      batch?: "ok";
    },
  ): Promise<CouchResponse> {
    const params = new URLSearchParams();
    const headers = new Headers({
      accept: "application/json",
    });
    params.append("rev", rev);
    if (opts) {
      if (opts.batch != null) {
        params.append("batch", "ok");
      }
      if (opts.fullCommit != null) {
        headers.set("X-Couch-Full-Commit", opts.fullCommit ? "true" : "false");
      }
    }
    const res = await this.fetch(`/${id}/${attachment}?${params.toString()}`, {
      method: "GET",
    });
    if (res.status === 200 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async find<T>(
    selector: any,
    opts: Partial<{
      limit: number;
      skip: number;
      sort: (string | { [key: string]: "asc" | "desc" })[];
      fields: string[];
      use_index: string | [string, string];
      r: number;
      bookmark: string;
      update: boolean;
      stable: boolean;
      stale: string;
      execution_stats: boolean;
    }> = {},
  ): Promise<{
    docs: T[];
    warning?: string;
    execution_stats?: {
      total_keys_examined: number;
      total_docs_examined: number;
      total_quorum_docs_examined: number;
      results_returned: number;
      execution_time_ms: number;
    };
    bookmark?: string;
  }> {
    const body = JSON.stringify({
      selector,
      limit: opts.limit,
      skip: opts.skip,
      sort: opts.sort,
      fields: opts.fields,
      use_index: opts.use_index,
      r: opts.r,
      bookmark: opts.bookmark,
      update: opts.update,
      stale: opts.stale,
      stable: opts.stable,
      execution_stats: opts.execution_stats,
    });
    const res = await this.fetch(`/_find`, {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
        accept: "application/json",
      }),
      body,
    });
    if (res.status === 200) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }
}

export class CouchClient {
  constructor(readonly endpoint: string, readonly opts: CouchOptions = {}) {}

  private readonly fetch = makeFetch(this.endpoint, this.opts);

  async metadata(): Promise<CouchMetadata> {
    const res = await this.fetch("/", {
      method: "GET",
      headers: new Headers({
        accept: "application/json",
      }),
    });
    if (res.status === 200) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  // DB
  async databaseExists(name: string): Promise<boolean> {
    const res = await this.fetch(`/${name}`, { method: "HEAD" });
    await res.text();
    if (res.status === 200) {
      return true;
    } else if (res.status === 404) {
      return false;
    }
    throw new CouchError(res.status, await res.text());
  }

  async getDatabase(name: string): Promise<CouchDatabaseInfo> {
    const res = await this.fetch(`/${name}`, { method: "GET" });
    if (res.status === 200) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async createDatabase(
    name: string,
    opts?: {
      q?: number;
      n?: number;
    },
  ): Promise<{ ok: boolean }> {
    const params = new URLSearchParams();
    if (opts != null) {
      if (opts.q != null) {
        params.append("q", opts.q + "");
      }
      if (opts.n != null) {
        params.append("n", opts.n + "");
      }
    }
    const res = await this.fetch(`/${name}?${params.toString()}`, {
      method: "PUT",
      headers: new Headers({
        accept: "application/json",
      }),
    });
    if (res.status === 201 || res.status === 202) {
      return res.json();
    } else if (400 <= res.status && res.status < 500) {
      const { error, reason } = await res.json();
      throw new CouchError(res.status, error, reason);
    } else {
      throw new CouchError(res.status, await res.text());
    }
  }

  async deleteDatabase(
    name: string,
  ): Promise<{
    ok: boolean;
  }> {
    const res = await this.fetch(`/${name}`, {
      method: "DELETE",
    });
    if (res.status === 200 || res.status === 202) {
      return res.json();
    } else if (400 <= res.status && res.status < 500) {
      const { error, reason } = await res.json();
      throw new CouchError(res.status, error, reason);
    }
    throw new CouchError(res.status, await res.text());
  }

  database<T>(db: string): CouchDatabase<T> {
    return new CouchDatabase<T>(this.endpoint, db, this.opts);
  }
}
