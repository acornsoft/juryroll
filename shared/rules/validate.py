#!/usr/bin/env python3
"""Validate rules/*.json against rules/schema.json plus JuryRoll policy checks.

Usage:  python3 rules/validate.py            (needs: pip install jsonschema)
Exit code 0 = all files pass.

Policy checks beyond the schema:
  1. File name matches the "state" field (XX.json or default.json).
  2. Gates are never looser than the gates derived from the facts (LOGIC-CHANGES.md A.3).
  3. default.json has the most restrictive gates.
  4. Negative self-tests: known-bad mutations must FAIL validation.
"""
import copy, glob, json, os, sys
from jsonschema import Draft202012Validator

HERE = os.path.dirname(os.path.abspath(__file__))
schema = json.load(open(os.path.join(HERE, "schema.json")))
Draft202012Validator.check_schema(schema)
V = Draft202012Validator(schema)

STRICT = {"allow_jury_list": False, "aggregate_only": True, "allow_named_export": False, "show_challenge_guidance": False}

def derived_gates(r):
    jl = r["jury_list"]["public"] is True
    pc = r["private_challenge"]["allowed"] is True
    return {
        "allow_jury_list": jl,
        "aggregate_only": not jl,
        "allow_named_export": jl,
        "show_challenge_guidance": jl and pc,
    }

def effective(r):
    """Stricter of declared gates (null -> strict) and derived gates."""
    d, g = derived_gates(r), r["gates"]
    out = {}
    for k in ("allow_jury_list", "allow_named_export", "show_challenge_guidance"):
        decl = g[k] if g[k] is not None else STRICT[k]
        out[k] = bool(decl and d[k])
    decl = g["aggregate_only"] if g["aggregate_only"] is not None else True
    out["aggregate_only"] = bool(decl or d["aggregate_only"])
    if out["aggregate_only"]:
        out["allow_named_export"] = False
    return out

def policy_errors(path, r):
    errs = []
    base = os.path.basename(path)
    want = "default.json" if r["state"] == "DEFAULT" else r["state"] + ".json"
    if base != want:
        errs.append(f"file name {base} does not match state {r['state']}")
    g, e = r["gates"], effective(r)
    for k in STRICT:
        if g[k] is not None and g[k] != e[k]:
            errs.append(f"gate {k}={g[k]} is looser than or differs from the effective value {e[k]}")
    if r["state"] == "DEFAULT" and g != {**STRICT, "basis": g["basis"]}:
        errs.append("default.json gates must be the strict default")
    return errs

failed = 0
files = sorted(f for f in glob.glob(os.path.join(HERE, "*.json")) if not f.endswith("schema.json"))
for path in files:
    r = json.load(open(path))
    errs = [f"{'/'.join(map(str, e.path)) or '(root)'}: {e.message}" for e in V.iter_errors(r)]
    if not errs:
        errs += policy_errors(path, r)
    status = "PASS" if not errs else "FAIL"
    print(f"{status} {os.path.basename(path)}  effective gates: {effective(r) if not errs else '-'}")
    for m in errs:
        print("   -", m)
    failed += bool(errs)

# Negative self-tests: each mutation must be rejected.
ny = json.load(open(os.path.join(HERE, "NY.json")))
def must_fail(name, mutate):
    global failed
    r = copy.deepcopy(ny); mutate(r)
    bad = list(V.iter_errors(r)) or policy_errors(os.path.join(HERE, "NY.json"), r)
    print(("ok  " if bad else "BAD ") + "negative test: " + name)
    failed += (not bad)
must_fail("known rule without source_url", lambda r: r["private_challenge"].update(source_url=None))
must_fail("known rule without verified_on", lambda r: r["jury_list"].update(verified_on=None))
must_fail("federal_90_day false", lambda r: r["blackout"].update(federal_90_day=False))
must_fail("gate looser than facts", lambda r: r["gates"].update(allow_jury_list=True))
must_fail("unknown field", lambda r: r.update(extra=1))
must_fail("bad date", lambda r: r.update(verified_on="10/07/2026"))

print("\nRESULT:", "ALL PASS" if not failed else f"{failed} FAILURE(S)")
sys.exit(1 if failed else 0)
