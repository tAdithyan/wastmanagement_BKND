# Kerala district boundaries

`kerala-district-boundaries.geojson` is the Kerala subset of the Survey of India / Geological Survey of India district boundary GeoJSON published by the National Water Data Portal (NWIC), Ministry of Jal Shakti. The NWIC resource was last updated 1 May 2025; its dataset metadata identifies GSI as producer and reports 733 district boundaries for India.

The source GeoJSON uses EPSG:7755 (WGS 84 / India NSF LCC). `scripts/extract-kerala-district-boundaries.cjs` converts its 14 Kerala district features to longitude/latitude WGS 84 for MongoDB GeoJSON queries. The source boundaries and district names are not hand-drawn or approximated.

Source dataset: https://nwdp.nwic.gov.in/dataset/district-boundary
Resource: https://nwdp.nwic.gov.in/dataset/6c1af675-1dec-4927-882c-c1ba9d73f76b/resource/8d9aa2e9-9806-4f26-a4ac-48ba21e9b96d
Data producer: Geological Survey of India / Survey of India, published by NWIC.

Seed or refresh districts without deleting existing district records:

```sh
node scripts/seed-kerala-district-serviceability.js
```

The seed script preserves existing `isServiceable` values and defaults newly inserted districts to disabled. An administrator must explicitly enable service districts.
