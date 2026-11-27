# Third-party licenses

Flowboard bundles the icon sets below (through the `@iconify-json/*` npm
packages, which repackage each set unchanged in Iconify's JSON format). Every
set is free to use, including in diagrams you export. Only sets with
permissive licenses (ISC, MIT, Apache 2.0, CC0) are included.

| Set | Package | Author | License |
| --- | --- | --- | --- |
| Lucide | `@iconify-json/lucide` | Lucide Contributors | ISC |
| Tabler Icons | `@iconify-json/tabler` | Paweł Kuna | MIT |
| Material Symbols | `@iconify-json/material-symbols` | Google | Apache 2.0 |
| Phosphor | `@iconify-json/ph` | Phosphor Icons | MIT |
| Simple Icons | `@iconify-json/simple-icons` | Simple Icons Collaborators | CC0 1.0 |
| SVG Logos | `@iconify-json/logos` | Gil Barbara | CC0 1.0 |

**About brand logos.** Simple Icons and SVG Logos release their SVG files under
CC0, but the logos themselves (AWS, Azure, Google Cloud, GitHub, …) are
trademarks of their owners. Using them to refer to those products in your own
diagrams is normal; the CC0 license does not grant trademark rights.

**Cloud architecture icon packs.** The official AWS, Azure and Google Cloud
architecture icon packs are *not* bundled, because their terms don't clearly
allow redistribution inside another app. Download them from the vendors and
drag the SVG/PNG files onto the canvas (or use File › Import image or SVG).

---

## Lucide (ISC)

Source: https://github.com/lucide-icons/lucide

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

Portions derived from Feather are MIT licensed (Copyright (c) 2013-2023 Cole
Bemis); the MIT text is reproduced below.

## Tabler Icons (MIT)

Source: https://github.com/tabler/tabler-icons — Copyright (c) 2020-2024 Paweł Kuna

## Phosphor (MIT)

Source: https://github.com/phosphor-icons/core — Copyright (c) 2023 Phosphor Icons

### MIT License text (applies to Tabler Icons, Phosphor and Feather)

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Material Symbols (Apache License 2.0)

Source: https://github.com/google/material-design-icons — Copyright Google LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use these files except in compliance with the License. You may obtain a copy
of the License at https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. The icons are
included unmodified.

## Simple Icons (CC0 1.0)

Source: https://github.com/simple-icons/simple-icons — dedicated to the public
domain under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/

## SVG Logos (CC0 1.0)

Source: https://github.com/gilbarbara/logos — dedicated to the public domain
under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/

## Libraries

The app is built with React (MIT, Meta Platforms, Inc.) and Vite (MIT). Their
license files ship in `node_modules` and are kept in the production bundle's
legal comments.
