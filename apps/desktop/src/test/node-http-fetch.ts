import http from "node:http";

// Stand-in for @tauri-apps/plugin-http in tests: a plain Node request does the same job.
export function fetch(url: string, init: { method?: string; body?: string } = {}) {
  return new Promise((done, fail) => {
    const req = http.request(url, { method: init.method ?? "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => done({ text: async () => body }));
    });
    req.on("error", fail);
    req.end(init.body);
  });
}
