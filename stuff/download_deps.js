const JSONStream = require('JSONStream');
const fs = require('fs');
const child_process = require('child_process');
const path = require('path')

// Hosts package metadata for latest versions of all public packages on NPM
const NPM_REGISTRY_URL = "https://skimdb.npmjs.com/registry/_design/scratch/_view/byField";
let outDir = "";

module.exports = {

    help: function() {
        console.log("")
        console.log("downloadDeps OUTPUT")
        console.log("    Downloads dependencies and devDependencies of latest versions of")
        console.log("    all public NPM packages in OUTPUT/dependencies.json")
    },

    /**
     * Downloads dependency information for all packages hosted on NPM and dumps them
     * as a json file.
     * File Format:
     *      {
     *          "pkgName":
     *              {
     *                  "version": 1.0.1,
     *                  "dependencies": [...],
     *                  "devDependencies": [...]
     *             }
     *      }
     */
    download : function() {
        if (process.argv.length !== 4) {
            module.exports.help();
            console.log("Invalid number of arguments for downloadDeps action");
            process.exit(-1);
        }
        console.log("Getting dependencies for all npm packages")
        let packages = {};
        let count = 0;
        outDir = process.argv[3]

        child_process.spawn('curl', [NPM_REGISTRY_URL]).stdout
            .pipe(JSONStream.parse("rows.*"))
            .on("data", (row) => {
                process.stdout.write("Packages Processed: " + count++ + "\r")
                packages[row.value.name] = {
                    version: row.value.version,
                    dependencies: row.value.dependencies || [],
                    devDependencies: row.value.devDependencies || []
                }
            })
            .on("end", () => {
                fs.writeFileSync(path.join(outDir, "dependencies.json"),
                                 JSON.stringify(packages, null, 2))
            })
    }
}