const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');
const fs = require('fs');
const isDirectory = source => lstatSync(source).isDirectory();
const utils = require("./utils.js");

module.exports = {
	help: function() {},
	siftProjects: function() {
		let path = process.argv[3];
		let num = Number.parseInt(process.argv[4]);
		let projects = utils.listProjects(path, num);
		var all_stats = [];
		var categorized;
		var combined_stats;
		for (let p of projects) {
			utils.analyzeProjectTools(p);
			utils.analyzeProjectDependencies(p);
			utils.addMetaData(p);
			labelProject(p);
			all_stats.push([p.url, proj_stats(p)]);
		};
		categorized = getResults(projects);

		combined_stats = combine_stats(all_stats);
		combined_stats = sort_tally(combined_stats);
		combined_sats = add_dep_tallies(combined_stats, categorized);
		print_results(combined_stats);
		}
}

const labels = {
	CLI : ["babel-core",
		"browserify",
		"coffee-script",
		"inquirer",
		"js-yaml",
		"update-notifier"],
	CLS : ["angular",
		"backbone",
		"body-parser",
		"connect",
		"express",
		"handlebars",
		"jade",
		"superagent"],
	DOM : ["angular",
		"bootstrap",
		"d3",
		"ejs",
		"express",
		"font-awesome",
		"jquery",
		"less",
		"method-override",
		"postcss",
		"react",
		"react-dom",
		"react-router",
		"url-loader"],
	LIB : ["async",
		"babel-core",
		"babel-loader",
		"babel-polyfill",
		"babel-preset-es2015",
		"babel-preset-react",
		"babel-runtime",
		"bluebird",
		"body-parser",
		"chalk",
		"classnames",
		"commander",
		"d3",
		"debug",
		"es6-promise",
		"express",
		"file-loader",
		"fs-extra",
		"gulp-util",
		"history",
		"immutable",
		"inherits",
		"invariant",
		"isomorphic-fetch",
		"js-yaml",
		"lodash",
		"marked",
		"mime",
		"minimatch",
		"mkdirp",
		"moment",
		"node-uuid",
		"prop-types",
		"q",
		"qs",
		"react",
		"react-redux",
		"redux",
		"request",
		"source-map",
		"underscore",
		"underscore.string",
		"uuid",
		"validator",
		"winston",
		"xtend"],
	NJS : ["chalk",
		"cheerio",
		"chokidar",
		"colors",
		"connect",
		"cookie-parser",
		"commander",
		"inquirer",
		"express",
		"express-session",
		"file-loader",
		"formidable",
		"fs-extra",
		"glob",
		"grunt",
		"gulp",
		"gulp-util",
		"method-override",
		"minimatch",
		"minimist",
		"mkdirp",
		"mongodb",
		"mongoose",
		"morgan",
		"nodemailer",
		"passport-local",
		"compression",
		"object-assign",
		"optimist",
		"passport",
		"redis",
		"redux-thunk",
		"request",
		"resolve",
		"rimraf",
		"semver",
		"serve-favicon",
		"socket.io",
		"socket.io-client",
		"source-map-support",
		"through2",
		"uglify-js",
		"webpack",
		"winston",
		"ws",
		"yargs",
		"yeoman-generator"]		
};

function add_dep_tallies(combined_stats, categorized) {
	for (var ds = 0; ds < combined_stats.length; ds++) {
		for (var p = 0; p < combined_stats[ds][2].length; p++) {
			combined_stats[ds][2][p] = [combined_stats[ds][2][p], 0];
			
			for (let labeled_proj of categorized) {
				if (combined_stats[ds][2][p][0] === labeled_proj[0]) {
					combined_stats[ds][2][p][1] = labeled_proj[5];
				}
				else {
					// skip
				}
			}
			
		}
	}


	return combined_stats;
};

function print_results(stats) {
	for (var cs = 0; cs < stats.length; cs++) {
		console.log("Dependency: ".concat(stats[cs][0]));
		console.log("Popularity (times used): ".concat(stats[cs][1]));
		for (var ps = 0; ps < stats[cs][2].length; ps++) {
			console.log("    Project,         NJS score");
			console.log("    ".concat(stats[cs][2][ps]));
		}
	}
}

function combine_stats(tups) {
	var total_stats = {};
	for (let t of tups) {
		if (Object.keys(t[1]).length !== 0) {
			for (let dep of Object.keys(t[1])) {
				if (total_stats[dep]) {
					var new_total = total_stats[dep][0] + 1;
					total_stats[dep][1].push(t[0]);
					total_stats[dep][0] = new_total;
				}
				else {
					total_stats[dep] = [1, [t[0]]];
				}
			}
		}
	}
	return total_stats;
};

function get_js_files(dir, proj) {
	var lastchar = dir.substring(dir.length - 1, dir.length);
	if (lastchar === "/") {
		dir = dir.substring(0, dir.length - 1);
	}
	var files_in_path = fs.readdirSync(dir);
	var js_files = [];
	for (let f of files_in_path) {
		var _f = dir.concat("/").concat(f);
		if (fs.lstatSync(_f).isDirectory()) {
			js_files.push.apply(js_files, get_js_files(_f, proj));
		}
		else if (fs.lstatSync(_f).isFile()) {
			var ext = _f.substring(_f.length - 3, _f.length);
			if (ext === ".js") {
				js_files.push([_f, proj]);
			}
		}
		else {
			// pass
		}
	}
	return js_files;
};

function getResults(ps) {

	var categorized = [];
	var uncategorized = [];
	
	for (let p of ps) {
		var dom_score = p.labels.DOM;
		var lib_score = p.labels.LIB;
		var njs_score = p.labels.NJS;
		var cli_score = p.labels.CLI;
		var cls_score = p.labels.CLS;

		if (dom_score === 0 && njs_score === 0 && cli_score === 0 && cls_score === 0 && lib_score === 0) {
			uncategorized.push(p);
		}
		else {
			categorized.push([p.url, cli_score, cls_score, dom_score, lib_score, njs_score]);
			/**
			console.log(p.url);
			console.log("  DOM deps: ".concat(dom_score));
			console.log("  LIB deps: ".concat(lib_score));
			console.log("  NJS deps: ".concat(njs_score));
			console.log("  CLI deps: ".concat(cli_score));
			console.log("  CLS deps: ".concat(cls_score));
			*/
		}
	}
	
	console.log("\n");
	console.log("Total projects: ".concat(ps.length));
	console.log("Uncategorized projects (no labeled dependencies): ".concat(uncategorized.length));
	console.log("\n\n");

	return categorized;
};

function labelProject(p) {
	p.labels = {};

	for (let l in labels) {
		p.labels[l] = 0;
		for (let dep of labels[l]) {
			if (p.dependencies[dep]) {
				p.labels[l] = p.labels[l] + 1;
			}
			else if (p.devDependencies !== undefined){
				if (p.devDependencies[dep]) {
					p.labels[l] = p.labels[l] + 1;
				}
				// do nothing	
			}
		}

	}
};

function proj_stats(proj) {
	var js_files = get_js_files(proj.path, proj.path);
	var require_stats = tally_require_stmts(js_files);
	//return sort_tally(require_stats);
	return require_stats;
};

function sort_tally(dict) {
	var arr = [];
	for (var key in dict) {
		//arr.push([dict[key], key]);
		arr.push([key, dict[key][0], dict[key][1]]);
	}
	arr.sort(function(a, b) {return b[1] - a[1]});
	return arr;
};

function tally_require_stmts(js_files) {
	var pkgs = {};
	for (let tup of js_files) {
		var f = tup[0];
		var pkg = tup[1];
		var file_text = fs.readFileSync(f, "utf8");
		var patt = /^require\(['"]([\w-]+)['"]\)/gm;
		var path;
		while ((path = patt.exec(file_text)) !== null) {
			var pname = path[1];
			if (pkgs[pname] !== undefined) {
				pkgs[pname][0] = pkgs[pname][0] + 1;
				pkgs[pname][1].push(pkg);
			}
			else {
				pkgs[pname] = [1, [pkg]];			
			}
		}
	}

	return pkgs;
};


