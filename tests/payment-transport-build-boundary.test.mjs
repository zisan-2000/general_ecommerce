import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const guard = fileURLToPath(new URL("./helpers/payment-transport-build-guard.cjs", import.meta.url));
function run(source) {
  const result = spawnSync(process.execPath, ["--require", guard, "-e", source], {
    timeout: 5000, encoding: "utf8", windowsHide: true,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  assert.equal(result.status, 0, "isolated guard process must finish successfully");
  assert.equal(result.stdout.trim(), "BOUNDARY_PASS");
}
test("build preloader blocks external sockets, PostgreSQL and external DNS before I/O", () => {
  run(`const assert = require('node:assert/strict');
    const net = require('node:net'); const dns = require('node:dns');
    assert.throws(() => net.connect({host:'example.invalid',port:443}), /UAT_BUILD_NETWORK_BLOCKED/);
    assert.throws(() => net.connect({host:'127.0.0.1',port:5432}), /UAT_BUILD_NETWORK_BLOCKED/);
    assert.throws(() => dns.lookup('example.invalid',()=>{}), /UAT_BUILD_DNS_BLOCKED/);
    console.log('BOUNDARY_PASS');`);
});
test("build preloader survives child NODE_OPTIONS replacement without a global dispatcher change", () => {
  run(`const assert = require('node:assert/strict'); const cp = require('node:child_process');
    const child = cp.spawn(process.execPath, ['-e',
      "const assert=require('node:assert/strict');assert.throws(()=>require('node:net').connect({host:'127.0.0.1',port:5432}),/UAT_BUILD_NETWORK_BLOCKED/);console.log('BOUNDARY_PASS')"
    ], {env:{...process.env,NODE_OPTIONS:''},stdio:['ignore','pipe','pipe']});
    let output=''; child.stdout.on('data',chunk=>output+=chunk);
    child.on('exit',code=>{assert.equal(code,0);assert.equal(output.trim(),'BOUNDARY_PASS');console.log('BOUNDARY_PASS')});`);
});
test("build wrapper invokes the existing build with an unusable DB and disabled monitoring", () => {
  const source = readFileSync(new URL("../scripts/payment-transport-uat-build.mjs", import.meta.url), "utf8");
  assert.match(source, /\[npmCli, "run", "build"\]/);
  assert.match(source, /DATABASE_URL: "postgresql:\/\/offline:offline@127\.0\.0\.1:1\/offline_build/);
  assert.match(source, /PAYMENT_TRANSPORT_MONITORING_MODE: "off"/);
  assert.match(source, /PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: "false"/);
  assert.doesNotMatch(source, /shell: true|setGlobalDispatcher|loadEnvConfig/);
});
