const pacote = require('pacote'),
      http  = require('http'),
      zlib  = require('zlib'),
      fs    = require('fs'),
JSONStream  = require('JSONStream'),
      URL   = require('url').URL;

// cache sizes for all packages processed
let sizeMap = new Map();
let tarballSizeMap = new Map();

/**
 * Get package size for all latest packages on npm
 * `registry` - npm registry path (obtained using `npm run download_npm_registry` command )
 * `outpath` - output CSV file path where package sizes are to be stored
 */
function getNpmPackageSizes(registryPath, outPath) {
    let jsonStream = fs.createReadStream(registryPath)
                       .pipe(JSONStream.parse("rows.*"));
    let outStream = fs.createWriteStream(outPath);
    let reqCount = 0;
    let count = 0;
    let MAX_REQ = 2; // Maximum concurrent requests

    jsonStream
        .on('data', async (row) => {
            reqCount++;
            if (reqCount === MAX_REQ) {
                jsonStream.pause();
            }
            let size = await getPackageSize({
                                name: row.value.name,
                                version: row.value.version,
                                dependencies: row.value.dependencies || {},
                                _resolved: row.value.dist.tarball
                            }, new Set());
            reqCount--;
            if (reqCount < MAX_REQ) jsonStream.resume();
            outStream.write(row.value.name + "," + row.value.version +  "," + size + "\n", ()=>{});
            process.stdout.write("Packages Processed: " + count++ + "\r");
        });
}

/**
 * Get package size for an npm package
 * `package` Package object with metadata
 * `visited` Tracks visited packages in the dependency graph to
 *           avoid cycles
 * returns size for the package
 */
async function getPackageSize(package, visited) {
    let packageName = package.name + "@" + package.version;
    if (sizeMap.has(packageName)) {
        return sizeMap.get(packageName);
    }
    let size = 0;
    try {
        size = await getTarballSize(package._resolved);
    } catch(e) {}
    for (let dep in package.dependencies) {
        let depName = dep + "@" + package.dependencies[dep];
        try {
            manifest = await pacote.manifest(depName);
            if (! visited.has(depName)) {
                visited.add(depName);
                size += await getPackageSize(manifest, visited);
            }
        }
        catch(e) {
            console.log("WARNING: Couldn't find manifest for " + depName + ' ' + e);
            size += 0
        }
    }
    // console.log("Done processing " + packageName + " ==>  size : " + size);
    sizeMap.set(packageName, size);
    return size;
}

/**
 * Calculates tarball size for a given package by unzipping it
 * `url` is tarball url
 * `attempt` is number of time this operation is being attempted
 * `maxAttempts` is number of times this operation should be attempted
 *               before giving up.
 */
async function getTarballSize(url, attempt = 0, maxAttempts = 3) {
    if (tarballSizeMap.has(url)) {
        return tarballSizeMap.get(url);
    }
    url = new URL(url);
    const options = {host: url.hostname,
                     path: url.pathname,
                     family: 4}
    return new Promise((resolve, reject) => {
        http.get(options, (res) => {
            var gunzip = zlib.createGunzip();
            res.pipe(gunzip);
            let size = 0;
            gunzip.on('data', (data) => {
                size += data.length;
            });

            gunzip.on('end', () => {
                tarballSizeMap.set(url.href, size);
                resolve(size);
            });

            gunzip.on('error', (e) => {
                reject(new Error("Gunzip Error"));
            });
        })
        .on("error", async (e) => {
            if (e.code === 'ETIMEDOUT' || e.code == 'ECONNRESET') {
                if (attempt < maxAttempts) {
                    console.log("\n Retrying... " + url + " Attempt : " + attempt);
                    await sleep(2000);
                    let size = await getTarballSize(url, attempt = attempt + 1);
                    resolve(size);
                } else {
                    reject(new Error("Failed request after multiple attempts"));
                }
            }
            else {
                reject(new Error("Failed request"));
            }
        });
    });
}

function sleep (timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

getNpmPackageSizes("../npm-registry.json", "package_sizes.csv");

module.exports = getNpmPackageSizes