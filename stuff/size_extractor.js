const https = require('https'),
      http  = require('http'),
      zlib  = require('zlib');
      fs    = require('fs');
JSONStream  = require('JSONStream');
      URL   = require('url').URL;

// http.globalAgent.maxSockets = 2;
let MAX_REQ = 5; // Maximum concurrent requests
let jsonStream = fs.createReadStream("../npm-registry.json")
                   .pipe(JSONStream.parse("rows.*"));
let outStream = fs.createWriteStream("results-1.csv", {flags: 'a'});
let reqCount = 0;
let count = 0;

jsonStream
    .on("data", (row) => {
        reqCount++;
        if (reqCount === MAX_REQ) {
            jsonStream.pause();
        }
        getTarballSize(row.value.dist.tarball, (err, size) => {
            if (err !== null) {
                if (err.code !== 'Z_DATA_ERROR')
                    console.log("Error: " + row.value.dist.tarball, err.message);
            }
            reqCount--;
            // console.log("Package : " + row.key + " size : " + size + ", " + reqCount);
            outStream.write(row.key + "," + row.value.version +  "," + size + "\n", ()=>{})
            if (reqCount < MAX_REQ) jsonStream.resume();
            process.stdout.write("Packages Processed: " + count++ + "\r");
        })
    });

function getTarballSize(url, callback, attempt = 0, maxAttempts = 3) {
    url = new URL(url);
    const options = {host: url.hostname,
                     path: url.pathname,
                     family: 4}
    // console.log(options);
    http.get(options, (res) => {
        var gunzip = zlib.createGunzip();
        res.pipe(gunzip);
        size = 0
        gunzip.on('data', (data) => {
            size += data.length
        });

        gunzip.on('end', () => {
            callback(null, size)
        });

        gunzip.on('error', (e) => {
            callback(e, -1);
        });
    })
    .on("error", (e) => {
        if (e.code === 'ETIMEDOUT' || e.code == 'ECONNRESET') {
            if (attempt < maxAttempts) {
                console.log("\n Retrying... " + url + " Attempt : " + attempt);
                setTimeout(() => {getTarballSize(url, callback, attempt = attempt + 1)}, 2000);
            } else {
                callback(e, -1);
            }
        }
        else {
            callback(e, -1);
        }
    });
}