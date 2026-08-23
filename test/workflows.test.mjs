// Fixture tests over the release workflows.
//
// Nothing here runs a workflow — these read the YAML as text and assert the
// couplings that are invisible until a release goes wrong. Every one of them is
// a defect that reached a real release in this org, and every one is silent: the
// run goes green and the release is simply absent, or is of the wrong tree.
//
// Two lessons are baked into the helpers, both learned by writing a check that
// passed against the very defect it was written for:
//
//   - `code()` strips comment lines. These workflows are heavily commented, and
//     a comment naming the thing being asserted satisfies a naive match.
//   - `jobBlocks()` slices ONE job each. Slicing "from this job to end of file"
//     is what let a dropped `tag:` pass on the strength of the NEXT job having
//     one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const DIR = ".github/workflows";
const wf = (name) => readFileSync(`${DIR}/${name}`, "utf8");
const names = () => readdirSync(DIR).filter((f) => f.endsWith(".yml"));
const code = (yaml) => yaml.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

function jobBlocks(yaml) {
  const section = yaml.slice(yaml.indexOf("\njobs:") + 1);
  const out = {};
  let cur = null;
  for (const line of section.split("\n").slice(1)) {
    const m = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (m) {
      cur = m[1];
      out[cur] = "";
      continue;
    }
    if (cur) out[cur] += line + "\n";
  }
  return out;
}

const ENTRY = "release.yml";
const LANE = "npm-publish.yml";

// THE PRESCRIBED CALLER FILENAME (mint#48).
//
// npm's trusted publishing validates the ENTRY workflow's filename, not the file
// containing `npm publish`, and a package may have exactly ONE trusted publisher
// configured. This repo had three registerable entry points — `cut.yml`
// (dispatch) and `publish.yml` (tag push AND dispatch) — so npm would validate a
// different name depending on how the release started and only one could ever be
// configured. The breakage is invisible until a release dies with ENEEDAUTH
// after the tag is already pushed.
//
// This is a property of the DIRECTORY, not of any one file, so the whole
// directory is the fixture.
test("exactly one workflow is an OIDC npm entry point, and it is the prescribed name", () => {
  const reaches = names().filter((f) => {
    const src = code(wf(f));
    return /\bnpm publish\b/.test(src) || src.includes(LANE);
  });

  // No exceptions remain. The bootstrap workflow carved one out while the
  // package did not exist — npm cannot attach a trusted publisher to a name it
  // has never seen (npm/cli#8544) — so that first publish had to authenticate
  // with a token. The package exists now, the publisher is configured, and both
  // the workflow and its token are deleted. The invariant is unconditional.
  assert.deepEqual(
    reaches.sort(),
    [ENTRY],
    `npm validates the entry workflow's filename and a package gets ONE trusted ` +
      `publisher, so exactly one file may reach npm over OIDC: ${ENTRY}. Found: ${reaches.join(", ")}`,
  );
});


// #48/mint#49. Each property below is the kind a later edit undoes by accident.
test("release.yml: three doors, a chained cut, and one resolved tag", () => {
  const src = code(wf(ENTRY));
  const blocks = jobBlocks(src);

  assert.match(src, /^\s{2}push:\n\s{4}tags: \["v\*"\]$/m, "the tag-push door is gone — a laptop cut would do nothing");
  assert.match(src, /^\s{2}workflow_dispatch:$/m, "the dispatch door is gone — the release needs a laptop again");

  // The cut must call mint's reusable release-cut, not reimplement it, and be
  // dispatch-only: on a tag push the tag already exists.
  assert.match(
    blocks.cut,
    /uses:\s+bounded-systems\/mint\/\.github\/workflows\/release-cut\.yml@[0-9a-f]{40}/,
    "the cut job must call mint's release-cut, pinned to a full commit SHA",
  );
  assert.match(
    blocks.cut,
    /if: github\.event_name == 'workflow_dispatch' && inputs\.recover-tag == ''/,
    "the cut must be dispatch-only and skipped on the recovery path",
  );

  // The chain must be gated on an ACTUAL cut: `cut` reports cut: 'false' for a
  // dry run, so gating `resolve` on that one output is what makes dry-run mean
  // "publish nothing". And `resolve` must survive `cut` being SKIPPED, which it
  // is on two of the three doors.
  assert.match(
    blocks.resolve,
    /needs\.cut\.outputs\.cut == 'true'/,
    "nothing gates the chain on a real cut — a dry run would publish",
  );
  assert.match(blocks.resolve, /!cancelled\(\)/, "resolve must run when the cut job is skipped");

  // Every checkout names the resolved tag. On a dispatch the run's ref is a
  // BRANCH, so one unpinned checkout publishes main under a version tag's name.
  const checkouts = src.split("\n").filter((l) => l.includes("actions/checkout@")).length;
  const pinned = (src.match(/ref: \$\{\{ needs\.resolve\.outputs\.tag \}\}/g) || []).length;
  assert.ok(checkouts > 0, "no checkouts found — did the job structure change?");
  assert.equal(
    pinned,
    checkouts,
    `${checkouts} checkout(s) but ${pinned} pinned to the resolved tag — an unpinned one releases the dispatch branch`,
  );
  assert.deepEqual(
    src.split("\n").filter((l) => l.includes("$GITHUB_REF_NAME")),
    [],
    "a $GITHUB_REF_NAME expansion survives — on a dispatched run that is the branch",
  );
});

// The recovery door re-runs the publish for a tag that already exists. Re-running
// the provenance for it is wrong: a published GitHub release is immutable, so the
// job would go red for work that had in fact succeeded (mint#19).
test("release.yml: the recovery door names a tag and skips the cut and the provenance", () => {
  const src = code(wf(ENTRY));
  const dispatch = src.slice(src.indexOf("workflow_dispatch:"), src.indexOf("\npermissions:"));
  assert.match(dispatch, /recover-tag:/, "workflow_dispatch must accept a tag to re-publish");

  const blocks = jobBlocks(src);
  assert.match(
    blocks.resolve,
    /RECOVER: \$\{\{ inputs\.recover-tag \}\}/,
    "resolve must read the recovery tag, or the door leads to the branch",
  );
  // The condition, not its exact spelling: the `if:` also has to carry a status
  // function (see the skip-taint test below), so pinning the whole expression
  // makes this fixture fight that one.
  assert.match(
    blocks.provenance,
    /if:.*inputs\.recover-tag == ''/,
    "provenance must be skipped on the recovery path — the release it would create already exists",
  );
  assert.doesNotMatch(
    blocks.npm,
    /recover-tag/,
    "the npm publish must still run on the recovery path — that is what the door is for",
  );
});

// GitHub validates a called reusable workflow's permission requests as the UNION
// of its `permissions:` block, AT LOAD TIME — before any `if:`, and regardless of
// which steps would run. Withholding one produces a `startup_failure`: no job
// starts, so there is no job log to read and no failing step to point at.
test("each chained caller grants what the called workflow's permissions block asks for", () => {
  const blocks = jobBlocks(wf(ENTRY));
  const required = {
    cut: ["contents: write"],
    provenance: ["contents: write", "id-token: write", "actions: read"],
    npm: ["contents: read", "id-token: write"],
  };
  for (const [job, perms] of Object.entries(required)) {
    const block = blocks[job];
    assert.ok(block, `${ENTRY} is missing the ${job} job`);
    for (const p of perms) {
      const [scope, level] = p.split(": ");
      // A real entry on its own line — not the substring, which the surrounding
      // comments also contain.
      assert.ok(
        new RegExp(`^\\s+${scope}: ${level}\\s*(#.*)?$`, "m").test(block),
        `${job} must grant \`${p}\` — the workflow it calls asks for it, and a ` +
          `caller that withholds it fails the run before any job starts`,
      );
    }
  }
});

// The floor lives in mint's lane now, which ASSERTS it rather than installing it.
// `npm install -g npm@latest` in a release path is how npm v12 arrived unannounced
// and killed a site-mcp publish, so the mutation stays forbidden here too — it
// would land in these files if it came back.
test("no workflow globally installs npm, and the publish goes through mint's lane", () => {
  for (const f of names()) {
    assert.doesNotMatch(
      code(wf(f)),
      /npm install -g npm@/,
      `${f}: an unpinned global npm upgrade is what broke site-mcp v0.3.0 — assert the floor instead`,
    );
  }
  assert.match(
    jobBlocks(code(wf(ENTRY))).npm,
    new RegExp(`uses: bounded-systems/mint/\\.github/workflows/${LANE.replace(".", "\\.")}@[0-9a-f]{40}`),
    "the npm publish must go through mint's lane, which owns the npm >= 11.5.1 floor",
  );
  // The environment claim is what npm's trusted-publisher Environment field pins,
  // and a job with `uses:` cannot declare `environment:` for itself — it can only
  // arrive as this input.
  assert.match(
    jobBlocks(code(wf(ENTRY))).npm,
    /environment: npm-publish/,
    "without this claim npm's Environment pin cannot be set",
  );
});

test("every mint call site is pinned to the same mint commit", () => {
  const files = names().filter((f) => wf(f).includes("bounded-systems/mint/"));
  const sites = files.flatMap((name) => [
    ...[...wf(name).matchAll(/bounded-systems\/mint\/[^@]+@([0-9a-f]{40})/g)].map((m) => ({ name, where: "uses", sha: m[1] })),
    // `ref:` is the mint runtime those workflows check out. It drifts
    // independently of the `uses:` pin, and a run pinned to two different mints
    // is a run whose behaviour matches neither.
    ...[...code(wf(name)).matchAll(/^\s+ref: ([0-9a-f]{40})\s*$/gm)].map((m) => ({ name, where: "ref", sha: m[1] })),
  ]);
  assert.ok(sites.length >= 5, `expected at least 5 mint pins, found ${sites.length}`);
  assert.equal(
    new Set(sites.map((s) => s.sha)).size,
    1,
    `mint pins disagree: ${sites.map((s) => `${s.name}:${s.where}=${s.sha.slice(0, 8)}`).join(", ")}`,
  );
});

// --- every job downstream of a skippable job needs a STATUS FUNCTION ---------
//
// GitHub propagates a skip through the entire `needs` CLOSURE, not one hop.
// `cut` is SKIPPED on two of the three doors (tag push, and recovery), so every
// job transitively needing it is skipped too — unless that job ITSELF calls a
// status function (`always()`, `cancelled()`, `success()`, `failure()`). A plain
// condition does NOT clear the taint, and neither does an upstream job having
// cleared it: `resolve`'s `!cancelled()` covers `resolve` alone.
//
// This shipped broken. site-mcp's v0.3.0 recovery dispatch resolved the tag,
// skipped every job beneath it, and reported SUCCESS having published nothing —
// the exact "green control that gates nothing" these fixtures exist to prevent.
// It survived because a DRY RUN skips those same jobs on purpose, so a green dry
// run carries no information about this defect at all.
//
// The rule is structural, so the assertion is too: the closure is derived from
// the file rather than from a list of job names a later edit would leave stale.
test("every job downstream of `cut` calls a status function", () => {
  const src = code(wf(ENTRY));
  const section = src.slice(src.indexOf("\njobs:") + 1);

  const jobs = {};
  let cur = null;
  for (const line of section.split("\n").slice(1)) {
    const m = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (m) { cur = m[1]; jobs[cur] = ""; continue; }
    if (cur) jobs[cur] += line + "\n";
  }

  const needsOf = (block) => {
    const m = /^\s*needs:\s*(.+)$/m.exec(block);
    if (!m) return [];
    const raw = m[1].trim();
    return raw.startsWith("[")
      ? raw.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
      : [raw];
  };

  const downstream = new Set();
  for (let grew = true; grew; ) {
    grew = false;
    for (const [job, block] of Object.entries(jobs)) {
      if (downstream.has(job)) continue;
      if (needsOf(block).some((n) => n === "cut" || downstream.has(n))) {
        downstream.add(job);
        grew = true;
      }
    }
  }
  assert.ok(downstream.size >= 3, `expected cut to have downstream jobs, found ${downstream.size}`);

  const STATUS_FN = /\b(always|cancelled|success|failure)\s*\(\s*\)/;
  for (const job of downstream) {
    const cond = /^\s*if:\s*(.+)$/m.exec(jobs[job])?.[1] ?? "";
    assert.match(
      cond,
      STATUS_FN,
      `job \`${job}\` is downstream of the skippable \`cut\` but its \`if:\` calls no status ` +
        `function — GitHub skips it on the tag-push and recovery doors, and the run reports ` +
        `success having done nothing. Found if: ${cond || "(none)"}`,
    );
  }
});
