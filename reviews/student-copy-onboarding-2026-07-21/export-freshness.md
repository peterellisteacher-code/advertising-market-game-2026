# Web-export freshness evidence

The checked web export was rebuilt from the final source candidate through an isolated source-only Godot copy under `C:\tmp`. The source project itself was never opened by native Godot.

| Artifact | Last modified (Australia/Adelaide) | Bytes | SHA-256 |
|---|---:|---:|---|
| `godot/src/main/Main.gd` | 2026-07-22 08:00:54 | 49,438 | `6748B3D69E664007EFC1961BD672E6F641ED6D03ACF21FB141C5FE59AD25E7E5` |
| `godot/src/main/Main.tscn` | 2026-07-22 08:00:51 | 21,267 | `A0F1D238E3C08D99499D475042DF78B1A5D656EE4462B14FF8C4D707D5BFE5C8` |
| `build/web/index.pck` | 2026-07-22 08:06:38 | 356,580 | `26414C2E3AA86F0D3398D4267569204B6BB2A06E71C98DDC235F01D4927F5FF1` |
| `build/web/index.wasm` | 2026-07-22 08:06:38 | 39,513,091 | `35116F68540AC41ACF7D71EA457ADDED91B5E960A9CCA3E2ACC72918EAF01277` |
| `build/web/index.js` | 2026-07-22 08:06:38 | 279,815 | `68586D6DAAFC93C6E697B3FB258976874AA7459B8931165EBB1DC3C9614CC42C` |
| `build/web/studio/studio.js` | 2026-07-22 08:07:23 | 793,472 | `F7FE12E5BAF9D3EC99560151924886FD604E57F7E6F37A5DD281FF7EAE5A2652` |
| `build/web/studio/studio.css` | 2026-07-22 08:07:23 | 40,592 | `215E59BE785341B64B1571F415FE8118844536982FF4EECADD6DC1CA8323BF32` |

Verification:

- Staging root: `C:\tmp\admarket-final-web-export-20260722-b\godot`.
- The staged `Main.gd`, `Main.tscn`, and `test_game_shell.gd` hashes match the authoritative OneDrive source files.
- Godot 4.7.1 headless tests passed in the isolated copy. The expected invalid-base64 negative-test diagnostic and exit leak warnings occur after the explicit pass line.
- Godot Web export completed to an initially empty staging output. All nine copied generated files matched their staging hashes.
- `build-web.mjs` completed non-destructively and `verify-web-export.mjs build/web` returned `WEB_EXPORT_STATIC_VERIFICATION_OK`.
- Native Godot never scanned or wrote the OneDrive project. Production was not deployed.
