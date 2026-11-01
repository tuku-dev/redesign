# Native .fig test fixtures

Copied from the public MIT-licensed [sketch-hq/fig2sketch](https://github.com/sketch-hq/fig2sketch) test suite at revision `450e3b350a6f9cf05d659459cf240def6b7f0483` on 2026-11-01. Original notice: [LICENSE.fig2sketch](LICENSE.fig2sketch), Copyright (c) 2022 Sketch B.V. and contributors. These fixtures are unmodified; parsed inspection dumps are not committed.

| File | Source | SHA-256 | Observed writer version |
| --- | --- | --- | --- |
| corners.fig | tests/data/corners.fig | 2d1aa94b4fffa882bb229dfebd7c5e30ed6fc9ae3390071cb40c953ff2d942b6 | 106 |
| structure.fig | tests/data/structure.fig | 2625997d999ecec64de7f8f8c2e4c57a714f1006e362ba79a118ae9606113b50 | 48 |

Both are ZIP containers. Their schemas use raw DEFLATE; the version 106 message uses Zstandard and version 48 uses raw DEFLATE. Writer numbers do not identify a Figma release. See [research notes](../../../docs/research/native-fig.md) for measured conversion results and limitations.

`../fig-builder.ts` independently generates small synthetic Kiwi fixtures for regression cases. They exercise framing/conversion and are not evidence that Figma will accept reDesign exports. No native exporter is implemented.
