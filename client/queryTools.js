const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(':memory:');
const fs = require('fs');
const http = require('http');
const sizeof = require('object-sizeof');
const stringDecoder = require('string_decoder').StringDecoder;

const queryArgumentsRegex = new RegExp(/^\s*(\w+)\s*(?:\((\w+:\s*(?:\S+\s*)+)\))?\s*\{\s*$/, 'm');
const queryAttributesRegex = new RegExp(/^\s*([a-zA-Z0-9_]+)\s*\}?$/, 'm');
const queryOpenRegex = new RegExp(/\{\s*/, 'm');
const queryCloseRegex = new RegExp(/\}\s*/, 'm');

var components = new Object();
var tree = new Object();

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

function distributedQuery(query) {
  tree = treeBuilder();
  var queriesExecuted = 0;
  var totalSize = 0;
  var queriesSize = 0;
  //Get each URI in query (child components, multiple top-level components)
  const components = queryGetComponents(query);
  for(var c in components) {
    const uri = queryGetURI(components[c]);
    const encodedQuery = encodeURIComponent(components[c]);
    queriesExecuted++;
    console.log(uri);
    console.log(encodedQuery);
    return queriesExecuted;

    console.log(`Querying ${uri.full}.`);
    var url = {
      encoding: "utf8",
      method: "GET",
      hostname: uri.host,
      port: uri.port,
      path: `/${uri.short}?PUTDATA=${encodedQuery}`,
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
    const querySize = sizeof(query);
    console.log(`Sent query ${query} with size of: ${querySize} bytes.`);
  }
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
  var decoder = new stringDecoder("utf8");
  var deposits = new Array();
  var contents = decoder.write(fs.readFileSync(`./deposit-log`));
  contents = contents.split("\n");
  //Component def-456 created log(s) [ls.log test.log] with command ls queryable at http://localhost:11855/components/def-450 and has parent abc-123.
  var regex = /^Component (\S+) created log\(s\) \[(.+)\] with command (.+) queryable at (\S+) and has parent (\S+).$/m;
  for(var c in contents) {
    if(contents[c] === "") { continue; }
    var args = regex.exec(contents[c]); 
    if(!args) { continue; }
    var uuid = args[1];
    var logs = args[2];
    var cmd = args[3];
    var uri = args[4];
    var puuid = args[5];
    if(components[uuid]) { continue; }
    components[uuid] = new Object();
    components[uuid]["uuid"] = uuid;
    components[uuid]["puuid"] = puuid;
    components[uuid]["uri"] = uri;
    components[uuid]["cmd"] = cmd;
    components[uuid]["logs"] = logs;
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

//TODO Add query language-specific splitting
function queryComponentSplit(query) {
  var pieces = new Array();
  return pieces;
}

//TODO push full component context
function queryGetComponents(query) {
  var components = new Array();
  const pieces = queryComponentSplit(query);
  for(p in pieces) {
    var component = new Object();
    components.push(component);
  }
  return components;
}

function queryGetURI(component) {
  var uuid;
  const lines = component.split("\n");
  var regex = /^\s*components\(.*ID:\s*"(\S+)"/m;
  for(var l in lines) {
    const args = regex.exec(lines[l]);
    if(args) {
      uuid = args[1];
      break;
    }
  }
  if(!uuid || !components[uuid]) { return 1; }
  return components[uuid]["uri"];
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

function treeBuilder() {
  var newTree = tree;
  logChecker();
  for(var c in components) {
    const curr = components[c];
    if(!newTree[curr["uuid"]]) {
      newTree[curr["uuid"]] = new Object();
      newTree[curr["uuid"]]["parent"] = curr["puuid"];
      newTree[curr["uuid"]]["children"] = new Array();
      if(!newTree[curr["puuid"]]) {
        newTree[curr["puuid"]] = new Object();
        newTree[curr["puuid"]]["children"] = new Array();
      }
      newTree[curr["puuid"]]["children"].push(curr["uuid"]);
    }
  }
  return newTree;
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
  queryOpenRegex,
  queryTablesBuilder,
  sanitizeBody,
  singularize,
  sizeof
}

// vim: tabstop=4 shiftwidth=2 softtabstop=2 expandtab shiftround autoindent
