import http from "node:http";
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://supplier");
  if (url.pathname !== "/quote") {
    res.writeHead(404).end();
    return;
  }
  const mode = url.searchParams.get("mode");
  const send = () => {
    res.setHeader("Content-Type", "application/json");
    if (mode === "error") {
      res.writeHead(503).end(JSON.stringify({ error: "SIMULATION" }));
      return;
    }
    res.end(
      JSON.stringify({
        reference: "SIMULATED-QUOTE",
        leadDays: 7,
        available: true,
      }),
    );
  };
  if (mode === "timeout") setTimeout(send, 1500);
  else send();
});
server.listen(3010, "0.0.0.0");
process.on("SIGTERM", () => server.close());
