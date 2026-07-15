import assert from"node:assert/strict";import test from"node:test";import{assertCurrentVersion,assertIndependentUsers}from"../src/modules/checking.js";
test("checker must differ from picker",()=>{assert.throws(()=>assertIndependentUsers("user-a","user-a"),/SAME_USER_DENIED/);assert.doesNotThrow(()=>assertIndependentUsers("user-a","user-b"));});
test("shipment rejects stale version",()=>{assert.throws(()=>assertCurrentVersion(3,2),/STALE_VERSION/);assert.doesNotThrow(()=>assertCurrentVersion(3,3));});
