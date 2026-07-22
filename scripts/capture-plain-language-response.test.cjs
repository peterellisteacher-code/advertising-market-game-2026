"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  decodeResponse,
  encodeResponse
} = require("./capture-plain-language-response.cjs");

test("response capture encoding round-trips unchanged and rewritten mapping lines", () => {
  const entries = [
    { id: "COPY__L0001__N01", original: "Choose one product." },
    { id: "COPY__L0002__N01", original: "Open the market." }
  ];
  const response = [
    "(a) CRITIQUE",
    "The copy gives students a direct action.",
    "",
    "(b) REGISTER REWRITE",
    "[COPY__L0001__N01] Choose one product.",
    "[COPY__L0002__N01] Enter the market.",
    "[FLAG COPY__L0002__N01] The control still opens the same market.",
  ].join("\n");

  const encoded = encodeResponse(response, entries);

  assert.equal(decodeResponse(encoded), response);
  assert.equal(encoded.entries.length, entries.length);
});
