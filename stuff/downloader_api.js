const async = require("async");
const request = require("request")
const fs = require("fs");

// helpers which should eventually go to utils

/** Creates a directory asynchronously. 
 */
function mkdir(where, name, callback) {
    fs.mkdir(where + "/" + name, (err) => {
        if (err != "EEXIST")
            callback(err);
        else 
            callback(null);
    });
}



module.exports = {

    help : function() {

    },

    download : function(apiTokens) {
        projectOutputDir = "c:/delete/jsdownload/projects";
        snapshotOutputDir = "c:/delete/jsdownload/files";

        console.time("all");
        apiTokens_ = apiTokens;
        console.log("Initialized with " + apiTokens_.length + " Github API tokens...");
        Q = async.queue(Task, 50);
        // add the task of loading a project
        Q.push({ kind : "project", url : "nborracha/titanium_mobile" });


        // when the queue is done, exit
        Q.drain = () => {
            console.timeEnd("all");
            console.log("KTHXBYE");
            process.exit();
        }

        setInterval(() => {
            console.log("Q: " + Q.running() + "/" + Q.length() + " - files " + stats_files + ", snapshots: " + stats_snapshots);
        }, 1000)
/*

        // load the projects now
        APIFullRequest(
            "http://api.github.com/repos/nborracha/titanium_mobile/commits",
            //"http://www.seznam.cz",
            (response, result) => {
                console.log(result.length);
            },
            (error, response, result) => {
                console.log(error);
            }
        ); */
    }
};

let stats_projects = 0;
let stats_files = 0;
let stats_snapshots = 0;

let projectOutputDir = null;
let snapshotOutputDir = null;

let Q = null; 

/** Trampoline that performs the appropriate task from the main queue.
 */
function Task(task, callback) {
    switch (task.kind) {
        case "project":
            return TaskProject(task, callback);
        case "branch":
            return TaskBranch(task, callback);
        case "commit":
            return TaskCommit(task, callback);
        case "snapshot":
            return TaskSnapshot(task, callback);
    }
}

function Error(callback) {
    return (error, response, result) => {
        console.log("API Error");
        callback();
    }
}

/** Returns true if the given filename should be recorded, false otherwise.
 */
function IsValidFilename(filename) {
    if (filename.includes("node_modules"))
        return null; // denied file
    if (filename.endsWith(".js") || (filename.endsWith(".coffee") || (filename.endsWith(".litcoffee")) || (filename.endsWith(".ts"))))
        return true;
    if (filename === "package.json")
        return true;
    // TODO perhaps add gulpfiles, gruntfiles, travis, etc. ?
    return false;
}

function InitializeProjectPath(project, callback) {
    // if the project path exists, then we do not need to do anything, call the callback immediately
    if (project.path) {
        callback(null);
    } else {
        // otherwise we first make sure we have the directories, starting with the subdir
        let subdir = project.info.id % 2000;
        mkdir(projectOutputDir, subdir, (err) => {
            // TODO check error
            // then followed by the actual project directory
            mkdir(projectOutputDir + "/" + subdir, project.info.id, (err) => {
                // TODO check error
                // set the project path, and call itself again, this time actually storing the file
                project.path = projectOutputDir + "/" + subdir + "/" + project.info.id;
                callback(err);
            });
        });
    }
}

function SaveProjectInfo(project, callback) {
    fs.writeFile(project.path + "/project.json", JSON.stringify(project.info), (err) => {
        callback(err);
    });
}

function SaveCommit(project, commit, callback) {
    // first make sure the path for the commit exists
    let subdir = commit.hash.substr(0, 2);
    mkdir(project.path, subdir, (err) => {
        // TODO check error
        fs.writeFile(project.path + "/" + subdir + "/" + commit.hash + ".json", JSON.stringify(commit), (err) => {
            callback(err);
        });
    });
}

/**  */
function TaskProject(task, callback) {
    // create the project
    let project = {
        info : {},
        branches : {},
        commits : {}
    };
    if (task.id !== undefined) {
        // TODO load the project information from disk and specify task's URL 
    } else {
        // make sure that 
    }
    // now get the metadata for the project 
    project.url = "http://api.github.com/repos/" + task.url;
    APIRequest(project.url,
        (error, response, result) => {
            let i = project.info
            // fill in the task project
            i.id = result.id;
            i.name = result.name
            i.fullName = result.fullName;
            i.description = result.description;
            i.ownerId = result.owner.id;
            i.fork = result.fork;
            // TODO determine if the project has changed and do not do the commits in that case
            i.created_at = result.created_at;
            i.updated_at = result.updated_at;
            i.pushed_at = result.pushed_at;
            i.size = result.size;
            i.forks_count = result.forks_count;
            i.stargazers_count = result.stargazers_count;
            i.watchers_count = result.watchers_count;
            i.language = result.language;
            i.has_issues = result.has_issues;
            i.open_issues_count = result.open_issues_count;
            i.default_branch = result.default_branch;
            // if the project is fork and we have parent, store its id
            if (result.parent !== undefined)
                i.parent = result.parent.id;
            // now we must make sure that the project path exists before we can start processing the branches
            InitializeProjectPath(project, (err) => {
                // TODO make sure there is no error
                // mark the default branch for analysis
                Q.unshift({
                    kind : "branch",
                    branch : i.default_branch,
                    project : project
                });
                // save the project info, which also executes our callback
                SaveProjectInfo(project, callback);
            });
        }
    );
}

function TaskBranch(task, callback) {
    let project = task.project
    APIRequest(project.url + "/branches/" + task.branch,
        (error, response, result) => {
            // TODO what if the branch already exists?? 
            let branch = {
                name : result.name,
                commit : result.commit.sha
            }
            project.branches[branch.name] = branch;
            Q.unshift({
                kind : "commit",
                hash : branch.commit,
                project : project
            })
            // output the branch info
            callback();
        }
    );
}

function TaskCommit(task, callback) {
    let project = task.project;
    // no need to revisit the commit if we have already scanned it, or we are scanning it right now
    if (project.commits[task.hash] !== undefined) {
        callback()
        return;
    }
    // otherwise add the commit
    let commit = {
        hash : task.hash
    };
    project.commits[commit.hash] = commit;
    // get information about the commit

    APIRequest(project.url + "/commits/" + commit.hash, 
        (error, response, result) => {
            commit.date = result.commit.author.date;
            commit.message = result.commit.message;
            commit.comment_count = result.commit.comment_count;
            commit.author = {
                name : result.commit.author.name,
                email : result.commit.author.email,
            };
            // if the author is a github user, add the id
            if (result.author)
                commit.author.id = result.author.id;
            // Enqueue all parent commits
            commit.parents = [];
            for (parent of result.parents) {
                Q.unshift({
                    kind : "commit",
                    hash : parent.sha,
                    project : project
                });
                commit.parents.push(parent.sha);
            }
            // enqueue files changed by the commit if they are the ones we are interested in
            commit.files = [];
            for (f of result.files) {
                // only deal with files we are interested in
                if (! IsValidFilename(f.filename))
                    continue;
                // change in file permissions, not interested for us
                if (f.sha === "0000000000000000000000000000000000000000")
                    continue;
                // create the fileinfo for the commit
                let fileInfo = {
                    filename : f.filename,
                    status : f.status
                };
                // if the file is renamed, keep the previous filename as well
                if (f.status === "renamed") 
                    fileInfo.previous_filename = f.previous_filename;
                // add the hash of the file and schedule the snapshot if the file is not deleted or renamed
                if (f.status !== "removed" && f.status !== "renamed") {
                    if (f.raw_url === "https://github.com/nborracha/titanium_mobile/raw/9eeefe61b96c9dbff911fff2a0e6d88e4e9b104a/mobileweb/cli/commands/_run.js")
                        console.log("here");
                    // if no hash for the file snapshot, we are not interested
                    if (!f.sha)
                        continue;
                    fileInfo.hash = f.sha
                    Q.unshift({
                        kind : "snapshot",
                        hash : f.sha,
                        url : f.raw_url 
                    });
                }
                // add the fileinfo to the commit files
                commit.files.push(fileInfo);
            }
            // store the commit information
            SaveCommit(project, commit, callback);
        }
    );
}


/** Obtain the snapshot of the file. */
function TaskSnapshot(task, callback) {
    ++ stats_files;
    // first see if we already have the snapshot
    let subdir1 = task.hash.substr(0, 2);
    let subdir2 = task.hash.substr(2, 2);
    let snapshotPath = snapshotOutputDir + "/" + subdir1 + "/" + subdir2 + "/" + task.hash;
    fs.access(snapshotPath, fs.constants.R_OK, (err) => {
        if (err) {
            // if the snapshot does not exist, make first sure that the path exists
            mkdir(snapshotOutputDir, subdir1, (err) => {
                // TODO handle error
                mkdir(snapshotOutputDir + "/" + subdir1, subdir2, (err) => {
                    // TODO handle error
                    APIRequest(
                        task.url, 
                        (error, response, result) => {
                            // TODO handle error
                            fs.writeFile(snapshotPath, result, (err) => {
                                ++stats_snapshots;
                                callback(err);
                            });
                        },
                        false // no JSON
                    );
                });
            });
        } else {
            // there was no error, the snapshot already exists, no need to download it
            callback(null);
        }
    });
}




let apiTokens_ = null;
let apiTokenIndex_ = 0;

/** Since the github  */
function APIFullRequest(url, onDone, onError, per_page = 100) {
    var result = [];
    let cont = (response, body) => {
        // append the results to the result, in place
        Array.prototype.push.apply(result, body);
        // determine if there is more to call
        let link = response.headers.link;
        if (link !== undefined) {
            // we are only interested in the first link
            link = link.split(", ")[0].split("; ");
            if (link[1] === "rel=\"next\"") {
                newUrl = link[0].substr(1).split(">")[0];
                APIRequest(newUrl, cont, onError);
                return;
            }
        }
        onDone(response, result);
    };
    // set the per-page limit
    url = url + "?per_page=" + per_page;
    APIRequest(
        url,
        cont,
        onError
    );
}

function APIRequest(url, onDone, json = true, retries = 10) {
    // rotate the api tokens to circumvent the 5000 requests per hour github limit
    let token = apiTokens[apiTokenIndex_++];
    if (apiTokenIndex_ == apiTokens.length)
        apiTokenIndex_ = 0;
    // create the request
    let options = {
        url : url,
        json : json,
        headers : {
            "Authorization" : "token " + token,
            "User-Agent" : "js-health"
        } 
    };
    // call request, async
    request(options, (error, response, body) => {
        // first see if we should retry the request  && error.code == "ETIMEDOUT"
        if (error) {
            if (retries > 0) {
                console.log(url + " -- retry " + retries);
                APIRequest(url, onDone, json, retries - 1);
                return;
            } 
        }
        // if not proceed as normally
        if (error || response.statusCode != 200) {
            console.log(url + " -- error");
            onDone(error, response, body);
        } else {
            //console.log(url + " -- ok");
            onDone(null, response, body);
        }
    });
}




