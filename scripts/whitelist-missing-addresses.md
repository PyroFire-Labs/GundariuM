# Whitelist — Recovered addresses from re-run

Pulled from `scripts/resolve-whitelist.ts` source list vs. `scripts/whitelist-map.json` resolved addresses.

- **Source list:** 163 unique Farcaster handles
- **Originally resolved via Neynar:** 109 handles
- **Originally "missing":** 54 handles
- **Recovered on re-run (2026-04-17):** 54 / 54 (100%) — all had verified ETH addresses the first run missed

Root cause: the original `resolve-whitelist.ts` hit Neynar demo-key rate limits partway through the list. Its retry-on-429 logic gave up after 3 attempts and silently dropped the handle as "no address." Pacing the re-run at 10s per request got clean 200s on every handle.

All 54 are **Tier 2 (WL / $1.50)** — none overlap with the 5 VIP handles.

## Recovered handles + verified ETH addresses (54)

| Handle | FID | Verified ETH address |
| --- | --- | --- |
| bfg | 11244 | `0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29` |
| jalleo | 11782 | `0xe47ed204b63adfb80c90082c088fc2a430f9a558` |
| alitiknazoglu | 12239 | `0x70d9b2084d24823789073d3732a327b2c18a7e6f` |
| sashelka | 15268 | `0x154fa6972f3c9eea2adb2e10b512440761e808e7` |
| claireujma | 15776 | `0xc793ee64e6ac6239c527fd041a78a8fcaa245e4f` |
| edurubio | 15792 | `0xe55036b78702961e72a27d21c3eb78c71bb6a645` |
| super-al | 206783 | `0x1564032600c864e5f254508cc907c40c87db2c05` |
| vortac | 209586 | `0xcceb3cda4d338bae545fed6b745c6dadf4df9781` |
| bixbysnyder.eth | 215114 | `0xdebee557279efedf7b9044292fbb83988060c337` |
| todemashi | 248344 | `0x8f156296f3f0b3c70a80b7bcf7ce3a75cccc0288` |
| thepapercrane | 249958 | `0x495b2fd72a3562b22e8f93d1e7e673273cd7c5f2` |
| tonyminh | 263574 | `0x5b3cec6a5e219674d4485be572cd3faae338bfc6` |
| odysseyheart | 308220 | `0x9095de52c39f22b324f0c565d5c6ef1236fc6bc6` |
| t0ma | 309715 | `0x3f643c8262056f1c68c58d9c6780297c1f7e546f` |
| ismaile007.eth | 315654 | `0x8469e23d6ed617675e7c33aa264cc3d2371400d5` |
| victoresteves.eth | 332316 | `0x9f327969a2aead18c7d0424c537a05c597080261` |
| kraken8.eth | 333517 | `0xe14ca0632c5430abddd40ba077da5fba8821a950` |
| h2osodowa | 336873 | `0xe3135e6a429c6b92f90faef2fc81bc8d148817c7` |
| speakingtomato | 351598 | `0x63e0e1312a693a3e113574060c424d1411ab4d55` |
| bizarrebeast | 357897 | `0x93db1b0ad7365ebab85f3ed98b055af579a589c2` |
| ryanhube.eth | 368013 | `0x1da6a4cf0a189fff6c3bfc383941a898baa2c503` |
| zosphotos | 401491 | `0x5f957ea55911ca2241330bf68c17c60c15b79b27` |
| nico-n | 402010 | `0x29c9001104561089b199b55f677854ca10ce27b2` |
| push- | 403020 | `0xe697b1bcf17a0edc2df872de1c7258c7cc434745` |
| karsaorlongdong | 416672 | `0x8b2447fe02053d6bb768cf6ca4a29a738baade16` |
| jeroenv78 | 419852 | `0x5326888ade036224e878745e7e062057b80a9d12` |
| negar-sepehr | 421198 | `0xca4a7dcfa46b07cf4eba08860e3cd732736a229b` |
| rosekeyes | 439610 | `0x75e6b9c57b8d1a136ef6970305dcd20a53581aba` |
| drmat | 445796 | `0x6d538c0db342c493f864a42d6e5696a3e5bc8047` |
| phos3 | 446581 | `0xcda9b278e9e4163ff3a49135888fde386c0b17cc` |
| hankmoody | 475488 | `0xfdb9fd7194921c435e2999187a8627301c45da36` |
| catfacts.eth | 477126 | `0x982859adf9c20aa4098aff412870eabd0bf8f75c` |
| niloofarmd | 482872 | `0xddf9aedc737d396f6463c6af8460cfc87c246a8b` |
| madaxc | 511843 | `0xeaa2a690fb3e110544017efa02bac6afaa7e5253` |
| nothing11 | 516359 | `0x5826d4ca43045fee71522c91ee4d2215e746c434` |
| nn0613.eth | 525136 | `0xce6ab060214232e65ec67442e8a9673a279885ae` |
| smhsince91 | 778146 | `0xd01f9393b58c99bc4a8ec04feeac5d7084e3d6bd` |
| metasalary | 780023 | `0x215ea50527c4a0c16cd817653cae52a24aa49e2d` |
| emirate | 789371 | `0xe369879d6e2e689bdd330bc2eb6a890aec9fe2b8` |
| mj41fantastican.eth | 887819 | `0x8e9330e9d0064f05a4039c1aea4d0d284d4e653a` |
| atenajafari | 889475 | `0x38a75d96ef49edbc21dba45f57c05566c9b192d9` |
| hdvrod.base.eth | 917347 | `0xf969e702e7c5bc58f915ecae2a35d470bf1a31d0` |
| merin | 1084951 | `0xc49c0a50fbae5fb6a6805052ed3b7f81db702184` |
| kayonfire | 1088459 | `0xae4a01f8567f82a6ec341ec3db4c8e99fea09131` |
| s-p | 1089662 | `0xd6c64e094c9f7e88356b45fc5ee5ce631c933be9` |
| pharoahcrypto | 1136823 | `0x812acfac539c8b309ddf1ead8502fa6328d1519b` |
| 0xmadmax007 | 1139633 | `0x4fa2e05cda688e2e2f5276b0df0274cfa5c2a325` |
| nikkiwordsmith | 1143161 | `0x42c48611a2de9f98469946e3368dc4566781bd50` |
| 0xwabo | 1378456 | `0xbccb842f4f4af6dc29dd49605268c7f39eb4cad0` |
| bitcoinbroke | 1400301 | `0x41d059bea892010a79195c811cfea0e8447f044d` |
| dareek | 1432815 | `0x61ada5dfa67ad93c25e4725b032d6313345001a2` |
| ghostcode0x | 1897097 | `0xb0515d463ef484ae76b108819df68baa112b92aa` |
| pearlsandlace | 2045795 | `0x3a92d4735d61125e64fe83fa5365562627df85a7` |
| capchr | 2182791 | `0x165cd9856efb28bd7011c4bc94cc5ea825cc1ba0` |
