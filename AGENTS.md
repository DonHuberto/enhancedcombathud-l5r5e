# Repository instructions

## Release contract

After every publishable change, run all tests and validators, bump `module.json`, update `CHANGELOG.md`, build and inspect the package, create one intentional commit, push, and create a draft GitHub Release.

Attach `module.json` and exactly the ZIP basename used by `download`. Keep `manifest` on `releases/latest/download/module.json`, keep `download` versioned to the release tag, and provide a public `changelog`. Publish only after validating tests, links, archive contents and versions, then verify both public asset URLs.
