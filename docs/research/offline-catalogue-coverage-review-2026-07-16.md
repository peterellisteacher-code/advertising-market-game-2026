# Offline catalogue coverage review — 16 July 2026

## Decision

The 2,050-asset pack is a credible classroom launch floor, but it is not a claim of Canva-scale breadth. Keep it as the dependable offline core, correct the remaining obvious family gaps, and use Image Lab only for unusual ideas or variations that the catalogue cannot reasonably anticipate.

The game does not depend on Image Lab. A pair must be able to finish a strong product and advertisement when the provider is unavailable, disabled or not approved for student use.

## Verified production state

- 2,050 reviewed raster assets and 2,050 raster masters
- 8,200 derived asset files: master, preview, thumbnail and body mask for every asset
- 47 raw catalogue categories
- 1,125 priced bases, 875 priced parts and 50 priced advertising-layout frames
- 2,000 product assets plus 50 media/layout assets
- `catalog.json` and `pricing.json` present
- catalogue QA: zero recorded errors
- pricing QA: exact coverage of all 2,050 assets

The figures above come from:

- `catalog/generated/offline-core-v1/catalog.json`
- `catalog/generated/offline-core-v1/pricing.json`
- `catalog/reports/raster-core-v1/qa.json`
- `catalog/reports/raster-core-v1/pricing-qa.json`
- `catalog/reports/raster-core-v1/source-selection.json`

## Practical breadth

The editor allows each base and part to be positioned, resized, recoloured and layered with text, logos and drawing. The raw asset count therefore understates creative choice:

- 984,375 theoretical one-base/one-part pairings before colour, text, drawing or multi-part stacks
- 20,625 pairings when base and part must share the exact raw category
- 28,125 pairings after merging eight equivalent legacy category names
- 29,375 pairings after also allowing holiday-experience parts on holiday-accommodation bases

These figures are possibility counts, not a promise that every pairing is visually sensible. Their value is that the catalogue supplies a large combinatorial starting space rather than 2,050 finished advertisements.

## Coverage weaknesses

The only true part-only product family is `agriculture-farm`: 25 components and no accepted base. The earlier base sheet was rejected because its subjects were shifted and mislabelled.

Several useful families have bases but no same-family component sheet: chairs/recliners, garden/outdoor, home fixtures, outdoor travel, sports/fitness and storage furniture. Equivalent-category merging already supplies parts for appliances, hospitality, pet care and toys/tabletop. Holiday-experience parts are intentionally compatible with holiday-accommodation bases.

The current pack also needs stronger offline representation for ideas students are likely to choose:

1. corrected agriculture and farm-equipment bases;
2. jewellery and accessories, with both bases and structural components;
3. fast-food and meal products, not only hospitality venues;
4. general retail and pet-shop venue shells plus merchandising fixtures;
5. professional and community service offers;
6. components for the useful base-only furniture, outdoor and fitness families.

Bag, apparel and general merchandise art is already comparatively dense. Additional sheets from Peter's Downloads folder should be imported only when they add a missing silhouette or component family, not merely another near-duplicate bag.

## Discoverability

Search now uses explicit whole-token and phrase equivalence groups for common classroom language, including fridge/refrigerator, couch/sofa, esky/cooler, car/vehicle, shoes/footwear, fast food/takeaway, pet shop/store/retail, digital product/service/app/subscription, and alcohol/beer/wine/spirits.

The implementation deliberately retains whole-query AND semantics, deterministic ranking, the category filter and the 100-result cap. It does not use broad substring matching, so searches such as `car` do not match `carpet`.

## Expansion rule

Add new contact sheets in reviewed 5×5 raster batches. A batch earns a place in the core when it does at least one of the following:

- closes a base/part family gap;
- represents a plausible product or service idea not already reachable offline;
- adds structurally different components rather than decorative duplicates;
- materially improves a weak silhouette students would struggle to customise.

Do not count AI generation as catalogue coverage. It is a supplementary escape hatch whose availability, provider eligibility and cost can change.
