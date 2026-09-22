import http from "node:http";
import net from "node:net";

// Explicit private listener and source are required; this is not a public proxy.
const [listenHost, portText, allowedClient] = process.argv.slice(2);
const listenPort = Number(portText);
if (!net.isIPv4(listenHost ?? "") || !net.isIPv4(allowedClient ?? "")
  || !Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535
  || listenHost === "0.0.0.0") {
  throw new Error("Usage: github-connect-proxy.mjs <private-listen-ip> <port> <allowed-client-ip>");
}

const server = http.createServer((_request, response) => {
  response.writeHead(405, { Connection: "close" });
  response.end();
});

server.on("connect", (request, client, head) => {
  if (client.remoteAddress !== allowedClient || request.url !== "github.com:443") {
    client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }
  const upstream = net.connect({ host: "github.com", port: 443 });
  let connected = false;
  client.on("error", () => upstream.destroy());
  client.on("close", () => upstream.destroy());
  upstream.on("close", () => client.destroy());
  upstream.on("error", () => {
    if (connected) client.destroy();
    else client.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
  });
  upstream.setTimeout(15_000, () => upstream.destroy(new Error("Upstream timeout")));
  upstream.once("connect", () => {
    connected = true;
    upstream.setTimeout(120_000);
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length) upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
});

server.listen(listenPort, listenHost, () => {
  console.log(`mystra-git-proxy listening on ${listenHost}:${listenPort}; source=${allowedClient}; destination=github.com:443`);
});
