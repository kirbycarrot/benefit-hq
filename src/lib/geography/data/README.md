# Geography lookup data

`zip-to-county.json` is generated from the U.S. Census Bureau's national
2020 ZCTA-to-county relationship file:

https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt

Because a ZIP Code Tabulation Area can overlap multiple counties, the build
script selects the county containing the largest land-area portion of each
ZCTA. The result is used only for aggregate workforce maps. It must not be
treated as address-level geocoding.

To refresh the generated lookup after downloading a newer source file:

```sh
node scripts/build-geography-data.mjs /path/to/zcta-to-county.txt
```
