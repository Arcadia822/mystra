// Decode the host-backed workload binding envelope for the guest mystra-agent wrapper.
//
// The AgentOS binding command answers with a JSON envelope from the sidecar:
//   { "ok": true, "result": { "exitCode": <int>, "stdout": <string>, "stderr": <string> } }
//   { "ok": false, "error": { ... } }
// The CLI's stdout and its exit code must survive verbatim; this script is the only
// decoder, and it never fabricates output. It is written without module syntax so the
// guest Node runtime can load it as either CommonJS or ESM.

function write(stream, value) {
  if (typeof value !== 'string' || value.length === 0) return;
  stream.write(value);
}

function decode(envelopeText) {
  var envelope;
  try {
    envelope = JSON.parse(envelopeText);
  } catch (error) {
    process.stderr.write('mystra-agent: binding envelope is not valid JSON\n');
    process.exitCode = 1;
    return;
  }
  if (envelope === null || typeof envelope !== 'object' || envelope.ok !== true) {
    process.stderr.write('mystra-agent: workload binding refused the command\n');
    write(process.stderr, JSON.stringify(envelope));
    process.stderr.write('\n');
    process.exitCode = 1;
    return;
  }
  var result = envelope.result;
  if (result === null || typeof result !== 'object') {
    process.stderr.write('mystra-agent: binding envelope carries no result\n');
    process.exitCode = 1;
    return;
  }
  write(process.stdout, result.stdout);
  write(process.stderr, result.stderr);
  process.exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
}

var envelopeText = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (chunk) { envelopeText += chunk; });
process.stdin.on('end', function () {
  if (envelopeText.length === 0) {
    process.stderr.write('mystra-agent: no binding envelope was provided\n');
    process.exitCode = 1;
    return;
  }
  decode(envelopeText);
});
