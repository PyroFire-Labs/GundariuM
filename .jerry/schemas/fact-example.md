# Example fact entry

Use this shape when capturing structured facts. In prose documents, the same information is often written as a labeled paragraph instead of JSON.

## Example

    - **id:** contracts.gundanium-game.exists
    - **label:** CONFIRMED
    - **claim:** GundaniumGame.sol exists in the contracts source tree.
    - **source:** contracts/src/GundaniumGame.sol exists on disk.
    - **notes:** Still need to confirm whether the deployed instance matches this source.

## Fields

- id: stable short identifier
- label: CONFIRMED / INFERRED / UNKNOWN
- claim: plain English claim
- source: how it was verified
- notes: optional caveats or next verification step

Do not invent ids that collide with other sections. If in doubt, make the id descriptive and specific.
