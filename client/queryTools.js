const sqlite3 = require('sqlite3');
//const db = new sqlite3.Database('database.db');
const db = new sqlite3.Database(':memory:');
const fs = require('fs');
const http = require('http');
const md5 = require('md5');
const sizeof = require('object-sizeof');
const stringDecoder = require('string_decoder').StringDecoder;

const queryArgumentsRegex = new RegExp(/^\s*(\w+)\s*(?:\((\w+:\s*(?:\S+\s*)+)\))?\s*\{\s*$/, 'm');
const queryAttributesRegex = new RegExp(/^\s*([a-zA-Z0-9_]+)\s*\}?$/, 'm');
const queryOpenRegex = new RegExp(/\{\s*/, 'm');
const queryCloseRegex = new RegExp(/\}\s*/, 'm');

var hosts = new Object();
var logs = new Object();

function compare(a, b) {
  var operator = "";
  if(b.indexOf(' ') != -1) {
    var argClause = b.split(' ');
    operator = argClause[0].replace (/(^")|("$)/g, '');
    b = argClause[1].replace (/(^")|("$)/g, '');
  }
  if(!operator) { return `${a} = ${b}`; }
  else if(operator.toUpperCase().localeCompare("LIKE") == 0) { return `${a} LIKE '${b}'`; } 
  else if(operator.toUpperCase().localeCompare("IN") == 0) { return `${a} IN '${b}'`; } 
  return `${a} ${operator} ${b}`;
}

function distributedQuery(query, sysname) {
  logChecker();
  var queriesExecuted = 0;
  var totalSize = 0;
  var queriesSize = 0;
  var queryTokens = query.split(' ');
  var currHosts = queryGetHosts(queryTokens, sysname);
  var encodedQuery = encodeURIComponent(query);
  for(var h in currHosts) {
    host = currHosts[h];
    queriesExecuted++;
    console.log(`Querying ${host.host}:${host.port}.`);
    var url = {
      encoding: "utf8",
      method: "GET",
      hostname: host.host,
      port: host.port,
      path: `/query?PUTDATA=${encodedQuery}`,
      headers: {
        "Content-Type": "text/plain"
      }
    };
    var sql = "";
    var req = http.get(url, function(resp) {
      var decoder = new stringDecoder("utf8");
      var response = resp.on('data', function(chunk) {
        queriesSize = sizeof(chunk);
        totalSize = totalSize + queriesSize;
        sql = sql.concat(sanitizeBody(decoder.write(chunk)));
      });
      resp.on("end", function() {
        var queries = sql.split("\n");
        for(q in queries) {
          if(queries[q] === "") { continue; }
          oneshot(queries[q]);
        }
        console.log(`Total size of returned data: ${totalSize} bytes.`);
      });
    });
    req.on("error", function(err) { console.log("Request error:".concat(err.message)); }); 
  }
  const querySize = sizeof(query);
  console.log(`Sent query ${query} with size of: ${querySize} bytes.`);
  return queriesExecuted;
}

function generalCallback(error, result) {
  if(error) { return error; }
  return result;
}

function graphqlToQuery(graphQL) {
  var queryArray = new Array();
  var queryDepth = -1;
  var types = new Array();
  var type = new Object();
  var lineCount = 0;
  const lines = graphQL.split("\n");
  for(var l in lines) {
    const line = lines[l];
    const args = queryArgumentsRegex.exec(line);
    const attrs = queryAttributesRegex.exec(line);
    const isOpen = queryOpenRegex.exec(line);
    const isClosed = queryCloseRegex.exec(line);
    if(args) {
      if(queryDepth > 0) {
        types.push(type);
        type = new Object();
      }
      const typeName = args[1];
      const argsString = args[2];
      type.type = singularize(typeName);
      type.args = argsString;
      type.depth = queryDepth;
      type.attrs = new Array();
    }
    else if(attrs) {
      const attrName = attrs[1];
      type.attrs.push(attrName);
    }
    lineCount++;
    if(isOpen) { queryDepth++; }
    if(isClosed) { queryDepth--; }
  }
  //Push remaining GraphQL type
  if(type.depth > -1) { types.push(type); }
  for(var t in types) {
    type = types[t];
    if(!type.args) { type.args = ""; }
    const typeString = `${type.depth}:${type.type}(${type.args})[${type.attrs.toString()}]`;
    queryArray.push(typeString);
  }
  for(var q in queryArray) { console.log(`${queryArray[q]}`); }
  return queryArray;
}

function logChecker() {
  var files = fs.readdirSync("./log-deposits");
  var decoder = new stringDecoder("utf8");
  var deposits = new Array();
  files.map(function(val) { if(val.match(/log-deposit\.\d+\.out/)) { deposits.push(val); } });
  for(var f in deposits) {
    var contents = decoder.write(fs.readFileSync(`./log-deposits/${deposits[f]}`));
    contents = contents.split("\n");
    var command, sysname, host, port, path, hash, types;
    //To query log '/tmp/logquery/condor-povray.rubiks1920.001.log' with types 'povray_jobs' from system 'condor_povray' running command './ltrace-wrapper-condor 001 /afs/crc.nd.edu/group/ccl/software/x86_64/redhat7/povray/3.7/bin/povray +Irubiks1920.pov +Orubiks1920.001.png +K0.1 +H1080 +w1920 +GArubiks1920.001.log' use ID '1ab2aa40d3ee7738c4dd23eea7c94d00' and query 'disc24.crc.nd.edu:' to find out more.
    var regex = /^To query log '(\S+)' with types '(\S+)' from system '(\S+)' running command '(.+)' use ID '(\S+)' and query '(\S+):(\d*)' to find out more.$/m;
    for(var line in contents) {
        if(contents[line] === "") { continue; }
        var args = regex.exec(contents[line]); 
        path = args[1];
        types = args[2];
        sysname = args[3];
        command = args[4];
        hash = args[5];
        host = args[6];
        port = args[7];
        if(!port) { port = "11855"; }
        var lid = md5(`${host}:${port}:${hash}`);
        var hid = md5(`${host}:${port}`);
        if(!logs[lid]) {
            logs[lid] = new Object();
            logs[lid]["host"] = `${host}:${port}`;
            logs[lid]["system"] = sysname;
            logs[lid]["command"] = command;
            logs[lid]["hash"] = hash;
            logs[lid]["types"] = types;
            logs[lid]["path"] = path;
          }
        else {
            var currTypes = logs[lid]["types"];
            if(currTypes) {
                var newTypes = types.split(',');
                var insertTypes = "";
                for(var t in newTypes) { if(currTypes.indexOf(newTypes[t]) == -1) {  insertTypes = insertTypes.concat(`,${newTypes[t]}`); } }
                insertTypes = currTypes.concat(insertTypes);
                logs[lid]["types"] = insertTypes;
              }
          }
  
          if(!hosts[hid]) {
              hosts[hid] = new Object();
              hosts[hid]["host"] = host;
              hosts[hid]["port"] = port;
              hosts[hid]["hostname"] = `${host}:${port}`;
              hosts[hid]["types"] = types;
              hosts[hid]["systems"] = sysname;
            }
          else {
            var currTypes = hosts[hid]["types"];
            if(currTypes) {
                var newTypes = types.split(',');
                var insertTypes = "";
                for(var t in newTypes) { if(currTypes.indexOf(newTypes[t]) == -1) {  insertTypes = insertTypes.concat(`,${newTypes[t]}`); } }
                insertTypes = currTypes.concat(insertTypes);
                hosts[hid]["types"] = insertTypes;
              }
            var currSystems = hosts[hid]["systems"];
            if(currSystems) {
                var newSystem = sysname;
                if(currSystems.indexOf(newSystem) == -1) {  currSystems = currSystems.concat(`,${newSystem}`); }
                hosts[hid]["systems"] = currSystems;
              } 
          }
      }
  }
  return 0;
}

function oneshot(sql) {
  const result = db.serialize(function() {
    const dbResult = db.run(sql, generalCallback);
    return dbResult;
  });
  return result;
}

function parentLineage(types, currentObject, currentIndex) {
  var returnObject = currentObject;
  var baseType = types[currentIndex];
  var depth = baseType.depth;
  var lineage = new Array();
  while(depth > 0 && currentIndex > 0) {
    if(types[currentIndex].depth == (depth - 1)) {
      depth--;
      lineage.push(singularize(types[currentIndex].type));
    }
    currentIndex--;
  }
  var lineageIndex = lineage.length - 1;
  while(lineageIndex > -1) {
    returnObject = returnObject[lineage[lineageIndex]];
    lineageIndex--;
  }
  returnObject[baseType.type] = new Object();
  return returnObject[baseType.type];
}

function query(sql, mode) {
  return new Promise((resolve, reject) => {
    var callback = (err, result) => {
      if(err) { return reject(err); }
      resolve(result);
    };
    if(mode) { db.get(sql, callback); }
    else { db.all(sql, callback); }
  });
}

function queryArgumentsBuilder(types) {
  var argsString = "";
  for(var t in types) {
    var type = types[t];
    if(!type.args) { continue; }
    var tabAlias = type.alias;
    var args = type.args.split(',');
    for(var a in args) {
      if(args[a] === "") { continue; }
      var parts = args[a].split(':');
      var arg = parts[0];
      var val = parts[1].trim();
      if(argsString) { argsString = argsString.concat(` AND ${compare(`${tabAlias}.${arg.trim()}`, val)}`); }
      else { argsString = `${compare(`${tabAlias}.${arg.trim()}`, val)}`; }
    }
  }
  return argsString;
}

function queryAttributesBuilder(types) {
  var attrsString = "";
  for(var t in types) {
    var type = types[t];
    var tabAlias = type.alias;
    var attrs = new Array();
    var aliases = new Array();
    for(var k in type) {
      if(k !== "type" && k !== "depth" && k !== "alias" && k !== "args") {
        attrs.push(k);
        aliases.push(type[k]);
      }
    }
    for(var a in attrs) {
      if(attrsString) { attrsString = attrsString.concat(`, ${tabAlias}.${attrs[a]} AS ${aliases[a]}`); }
      else { attrsString = `${tabAlias}.${attrs[a]} AS ${aliases[a]}`; }
    }
  }
  return attrsString;
}

function queryGetHosts(queryTokens, sysname) {
  var currHosts = new Array();
  for(var t in queryTokens) {
    var token = queryTokens[t];
    token = token.replace(/;+$/, '');
    if(token === "*") { continue; }
    for(var h in hosts) {
      var host = hosts[h];
      var regexToken = new RegExp(token, 'g');
      var regexSystem = new RegExp(sysname, 'g');
      if(host["types"].match(regexToken) && host["systems"].match(regexSystem)) { currHosts.push(host); }
    }
  }
  currHosts = currHosts.filter(function(h, i) { return currHosts.indexOf(h) == i; });
  return currHosts;
}

function queryTablesBuilder(types) {
  var tablesString = "";
  for(var t in types) {
    var type = types[t];
    var tabAlias = type.alias;
    var i = t - 1;
    while(i > -1) {
      var previousType = types[i];
      if(previousType.depth == (type.depth - 1)) {
        type.parentType = previousType.type;
        type.parentAlias = previousType.alias;
        break;
      }
      i--;
    }
    if(tablesString) {
      if(type.parentType) {
        const parentObject = types[i];
        const tabParts = [type.type, type.parentType].sort();
        const assocTable = `${tabParts[0]}_${tabParts[1]}`;
        const assocTableAlias = `${assocTable}${i}_${t}`
        tablesString = `${tablesString} JOIN ${assocTable} AS ${assocTableAlias} ON ${parentObject.alias}.hash = ${assocTableAlias}.${parentObject.type}_hash JOIN ${type.type} AS ${type.alias} ON ${type.alias}.hash = ${assocTableAlias}.${type.type}_hash`;
      }
    }
    else { tablesString = `${type.type} AS ${type.alias}` }
  }
  return tablesString;
}

function sanitizeBody(body) {
  var raw = new String(body);
  var sanitized = "";
  var intag = 0;
  var lines = raw.split("\n");
  for(var line in lines) {
    var l = lines[line];
    if(l.match(/^</m)) { intag = 1; }
    if(l.match(/>$/m)) { intag = 0; continue; }
    if(intag == 0) { sanitized = sanitized.concat(l).concat("\n"); }
  }
  sanitized = sanitized.slice(0, -1);
  return sanitized;
}

function singularize(plural) {
  var singular = plural;
  switch(plural) {
    case "files":
      singular = "file";
      break;
    case "processes":
      singular = "process";
      break;
    case "envVars":
      singular = "envVar";
      break;
    case "components":
      singular = "component";
      break;
    default:
      break;
  }
  return singular;
}

module.exports = {
  compare,
  db,
  distributedQuery,
  graphqlToQuery,
  oneshot,
  parentLineage,
  query,
  queryArgumentsBuilder,
  queryArgumentsRegex,
  queryAttributesBuilder,
  queryAttributesRegex,
  queryCloseRegex,
  queryGetHosts,
  queryOpenRegex,
  queryTablesBuilder,
  sanitizeBody,
  singularize,
  sizeof
}

// vim: tabstop=4 shiftwidth=2 softtabstop=2 expandtab shiftround autoindent
