# Product Kit certification fingerprint v1

Status: frozen handoff contract for pack generators and browser consumers.

## Authority and scope

web/src/product-kit/certification-fingerprint.ts is the byte-level authority.
The certification serializer is deliberately different from the whole-pack
serializer:

- certification JSON uses the fixed field order below;
- it is compact, with no spaces, BOM, or trailing line feed;
- whole-pack JSON uses its separately governed canonical form.

Never hash a whole-pack serialization or an arbitrary input object's property
enumeration.

## Payload projection and field order

The top-level object is:

    schema, version, packId, connectorFormulaVersion, kit, component

schema is exactly product-kit-certification@1; version is exactly 1.

    kit:
      id, mode, compatibilityProfile, base, mountFrame

    component:
      id, slotId, compatibilityProfile, componentFrame, fragments

    compatibilityProfile:
      familyId, perspectiveId, geometryId, styleId

    raster:
      assetId, masterSha256, frame

    raster.frame:
      originalWidth, originalHeight, trimX, trimY, trimWidth, trimHeight

    fragment:
      layer, raster

Mount-frame variants:

    socket:
      id, slotId, mountType, point, normal, referenceScale, constraints

    grip:
      id, slotId, mountType, contacts, normals, constraints

    grid:
      id, slotId, mountType, origin, cellSize, columns, rows, plane,
      acceptedEdgeTypes

    constraints:
      minScale, maxScale, minRotationDegrees, maxRotationDegrees,
      maxNormalErrorDegrees, mirrorAllowed

    point / normal:
      x, y

    cellSize:
      width, height

Component-frame variants:

    socket:
      mountType, point, normal, referenceScale

    grip:
      mountType, contacts, normals

    grid:
      mountType, plane, footprint, edgeTypes

    footprint:
      columns, rows

    edgeTypes:
      north, east, south, west

All four grid edge fields are emitted. An absent edge is JSON null. Grip
contacts and normals preserve tuple order. Fragment order and accepted-edge
order are validated before serialization and are not rearranged while
fingerprinting.

## Canonical bytes

1. Rebuild only the projection above.
2. Preserve the listed key order; do not alphabetically sort fingerprint keys.
3. Emit compact JSON with comma and colon separators, no whitespace, no BOM,
   and no final line feed.
4. Reject unpaired UTF-16 surrogates.
5. Encode strict UTF-8.
6. SHA-256 the exact bytes.
7. Emit exactly 64 lowercase hexadecimal characters.

Primitive rendering must match ECMAScript JSON.stringify, including binary64
number spelling. Python's default json.dumps is not byte-compatible: for
example, JavaScript emits 1 for 1.0 and 1e-7 rather than 1.0 and 1e-07.
RFC 8785 primitive rendering can be used as a building block, but its key
sorting must not be adopted for this payload.

## Bound identity

A certification record names:

    (kitId, mountFrameId, componentId)

The selected frame must occur exactly once in the kit and be canonically equal
to the supplied frame. Kit mode, mount type, component-frame type, slot, and
all four compatibility-profile fields must agree.

The digest binds:

- Product Kit packId;
- connector formula version;
- kit ID, mode, compatibility profile, base raster identity/hash/frame, and
  complete selected mount frame;
- component ID, slot, compatibility profile, component frame, and every
  fragment's layer and raster identity/hash/frame.

It intentionally does not bind certification ID, catalogue pack ID/hash,
pricing version, titles, price IDs, or artwork bounds.

Fingerprinting is not a replacement for full catalogue validation. Before
writing a pack, validate exact offline asset binding, reviewed/brand-free
status, canonical PNG paths, dimensions, sorted and unique IDs, global frame
uniqueness, unique certification triples, geometry feasibility, grid
plane/footprint/edge compatibility, and all schema constraints.

## Failure semantics

- Invalid or hostile evidence returns no canonical payload and no fingerprint.
- An invalid, uppercase, wrong-length, newline-suffixed, non-hexadecimal, or
  stale claimed fingerprint never matches.
- Missing or stale certifications make the pair unavailable; no partial plan
  is produced.
- The pack writer validates before writing, refuses an existing versioned
  destination, writes through a sibling temporary file, atomically renames,
  and leaves no destination or temporary residue after failure.

## Cross-language golden vectors

Compare exact canonical UTF-8 bytes before comparing the digest:

| Variant | SHA-256 |
|---|---|
| socket | 141f2fa929ec7f4336f5b6addb845993c44a686c882baf7543a1221750e55771 |
| grip | 769ac88a116a1d19e83928b19d6087f4aa868009493decfcbac9f690e994060a |
| grid | ce6ab5b80432b613a3d41321761857bd650b09e16e60f57004c61f384762414b |

Every generator implementation must additionally cover:

- 1.0, 1e-7, shortest-round-trip decimals, and rejected negative zero;
- Unicode, escaped control characters, and malformed-surrogate rejection;
- different input insertion orders producing identical bytes;
- every included field invalidating the fingerprint when changed;
- excluded title, artwork-bound, and price changes preserving it;
- duplicate/missing/mismatched frames, profile/slot/mode mismatches, sparse
  arrays, unsorted fragments/edges, non-finite values, and malformed hashes;
- generator to browser parser to runtime resolution, with one-byte stale
  mutations denied.

The source golden tests live in
web/src/product-kit/certification-fingerprint.test.ts.

## Rendered socket contact gate

Fingerprint validity proves that the browser and pack agree on connector
metadata. It does not prove that the transformed PNGs appear to touch. Run the
independent alpha-contact gate against the exact catalogue masters:

    python scripts/verify_product_kit_sockets.py --catalog catalog/generated/offline-core-v1/catalog.json --kit catalog/generated/offline-core-v1/product-kit-v1.json

The verifier renders every front or rear fragment with the browser's normalized
socket transform on the base asset's original canvas. It measures each
attachment region within the socket band, permits no more than two transparent
output pixels between component and base, and rejects seating overlap deeper
than the 40-pixel attachment band. Connector-point arithmetic alone is not
accepted as contact evidence.

The certified pack SHA-256 is
`aec4825b70e074979955f445ac5506a6d0947f8561545359f05abc1eb0881794`.

| Certification | Gap pixels | Overlap pixels | Detached regions |
|---|---:|---:|---:|
| `pk1-cert-tumbler-flat-lid` | 0 | 2541 | 0 |
| `pk1-cert-tv-angled-feet` | 0 | 1310 | 0 |
| `pk1-cert-tv-centre-pedestal` | 0 | 1938 | 0 |
| `pk1-cert-utility-case-arched-handle` | 0 | 236 | 0 |
| `pk1-cert-utility-case-compact-handle` | 0 | 371 | 0 |

The compact handle component point is `y = 0.37`. Its certification fingerprint
is `e5bdcd7f9284daeb7767017f8711840e1249bad4b125aa7d3c2bcf27704a7fab`.
No source PNG, asset ID, catalogue hash or price changed.
