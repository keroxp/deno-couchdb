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
    readonly reason?: string
  ) {
    super(status + ":" + error);
  }
}

export type NotModified = Symbol;
export const NotModified = Symbol("NotModified");

class CouchDatabase<T> {
  constructor(readonly endpoint: string, readonly db: string) {}

  path() {
    return `${this.endpoint}/${this.db}`;
  }

  async insert(
    doc: T,
    opts?: {
      batch?: "ok";
      fullCommit?: boolean;
    }
  ): Promise<{
    id: string;
    ok: boolean;
    rev: string;
  }> {
    const headers = new Headers({
      "content-type": "application/json",
      accept: "application/json"
    });
    let path = this.path();
    if (opts) {
      if (opts.fullCommit != null) {
        headers.set("X-Couch-Full-Commit", opts.fullCommit ? "true" : "false");
      }
      if (opts.batch != null) {
        path += "?batch=ok";
      }
    }
    const body = JSON.stringify(doc);
    const res = await fetch(path, {
      method: "POST",
      headers,
      body
    });
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async info(id: string): Promise<Headers | undefined> {
    const res = await fetch(`${this.path()}/${id}`, {
      method: "HEAD"
    });
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
    }>
  ): Promise<(CouchDocument & T) | NotModified> {
    return this._get("json", id, opts);
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
    }>
  ): Promise<[CouchDocument & T, FormData] | NotModified> {
    return this._get("multipart", id, opts);
  }

  private async _get<A extends "json" | "multipart">(
    accept: A,
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
    }>
  ): Promise<
    {
      json: (CouchDocument & T) | NotModified;
      multipart: [(CouchDocument & T), FormData] | NotModified;
    }[A]
  > {
    const params = new URLSearchParams();
    if (opts != null) {
      if (opts.attachments != null) {
        params.set("attachments", opts.attachments ? "true" : "false");
      }
      if (opts.att_encoding_info != null) {
        params.set(
          "att_encoding_info",
          opts.att_encoding_info ? "true" : "false"
        );
      }
    }
    const res = await fetch(`${this.path()}/${id}?${params.toString()}`, {
      method: "GET",
      headers: new Headers({ accept })
    });
    if (res.status === 200) {
      if (accept === "multipart/related") {
        const form = await res.formData();
        const json = JSON.parse(form[0]);
        return [json, form];
      } else if (accept === "application/json") {
        return res.json();
      }
    } else if (res.status === 304) {
      return NotModified;
    }
    throw new CouchError(res.status, await res.text());
  }

  async put(
    id: string,
    doc: T,
    opts?: {
      fullCommit?: boolean;
      rev?: string;
      batch?: "ok";
      new_edits?: boolean;
    }
  ): Promise<{ id: string; ok: boolean; rev: string }> {
    const body = JSON.stringify(doc);
    const headers = new Headers({
      "content-type": "application/json"
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
    const res = await fetch(`${this.path()}/${id}?${params.toString()}`, {
      method: "PUT",
      headers,
      body
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
    }
  ): Promise<CouchResponse> {
    const headers = new Headers({
      "content-type": "application/json"
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
    const res = await fetch(`${this.path()}/${id}?${params.toString()}`, {
      method: "DELETE"
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
    }
  ): Promise<Headers | undefined> {
    const params = new URLSearchParams();
    if (opts) {
      params.append("rev", opts.rev);
    }
    const res = await fetch(
      `${this.path()}/${id}/${attachment}?${params.toString()}`,
      {
        method: "GET"
      }
    );
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
    opts: {
      rev: string;
    }
  ): Promise<ArrayBuffer> {
    const params = new URLSearchParams();
    if (opts) {
      params.append("rev", opts.rev);
    }
    const res = await fetch(
      `${this.path()}/${id}/${attachment}?${params.toString()}`,
      {
        method: "GET"
      }
    );
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
      rev
    }: {
      data: Reader;
      contentType: string;
      rev?: string;
    }
  ): Promise<CouchResponse> {
    const params = new URLSearchParams();
    const headers = new Headers({
      "content-type": contentType
    });
    if (rev != null) {
      params.append("rev", rev);
    }
    // TODO: use ReadableStream if possible
    const buf = new Buffer();
    await copy(buf, data);
    const res = await fetch(
      `${this.path()}/${id}/${attachment}?${params.toString()}`,
      {
        method: "PUT",
        headers,
        body: buf.bytes()
      }
    );
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  async deleteAttachment(
    id: string,
    attachment: string,
    {
      rev,
      batch,
      fullCommit
    }: {
      rev: string;
      fullCommit?: boolean;
      batch?: "ok";
    }
  ): Promise<CouchResponse> {
    const params = new URLSearchParams();
    const headers = new Headers();
    if (rev != null) {
      params.append("rev", rev);
    }
    if (batch != null) {
      params.append("batch", "ok");
    }
    if (fullCommit != null) {
      headers.set("X-Couch-Full-Commit", fullCommit ? "true" : "false");
    }
    const res = await fetch(
      `${this.path()}/${id}/${attachment}?${params.toString()}`,
      {
        method: "GET"
      }
    );
    if (res.status === 201 || res.status === 202) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }
}

export class CouchClient {
  constructor(readonly endpoint: string) {}

  async metadata(): Promise<CouchMetadata> {
    const res = await fetch(`${this.endpoint}`, {
      method: "GET",
      headers: new Headers({
        accept: "application/json"
      })
    });
    if (res.status === 200) {
      return res.json();
    }
    throw new CouchError(res.status, await res.text());
  }

  // DB
  async databaseExists(name: string): Promise<boolean> {
    const res = await fetch(`${this.endpoint}/${name}`, { method: "HEAD" });
    if (res.status === 200) {
      return true;
    } else if (res.status === 404) {
      return false;
    }
    throw new CouchError(res.status, await res.text());
  }

  async getDatabase(name: string): Promise<CouchDatabaseInfo> {
    const res = await fetch(`${this.endpoint}/${name}`);
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
    }
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
    const res = await fetch(`${this.endpoint}/${name}?${params.toString()}`, {
      method: "PUT",
      headers: new Headers({
        accept: "application/json"
      })
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
    name: string
  ): Promise<{
    ok: boolean;
  }> {
    const res = await fetch(`${this.endpoint}/${name}`, {
      method: "DELETE"
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
    return new CouchDatabase<T>(this.endpoint, db);
  }
}
