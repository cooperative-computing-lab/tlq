const bearerToken = require('express-bearer-token');
const bodyParser = require('body-parser');
const {buildSchema} = require('graphql');
const cors = require('cors');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const stringDecoder = require('string_decoder').StringDecoder;
const expressServer = express().use(cors()).use(bodyParser.json()).use(bearerToken());
const rawSchema = require('./schema');
const queryTools = require('./queryTools');
const schema = buildSchema(rawSchema);

function queryBuilder(graphQLQuery, systemName, firstType) {
  const q = queryTools.graphqlToQuery(graphQLQuery);
  var queryDepth = -1;
  var types = new Array();
  var type = new Object();
  var first = 1;
  var lineCount = 0;
  const graphQLSize = queryTools.sizeof(graphQLQuery);
  console.log(`Got GraphQL query of size: ${graphQLSize} bytes.`);
  const lines = graphQLQuery.split("\n");
  for(var l in lines) {
    const line = lines[l];
    const args = queryTools.queryArgumentsRegex.exec(line);
    const attrs = queryTools.queryAttributesRegex.exec(line);
    const isOpen = queryTools.queryOpenRegex.exec(line);
    const isClosed = queryTools.queryCloseRegex.exec(line);
    if(args) {
      //Skip setting depth zero as record type (GraphQL format)
      if(queryDepth > 0) {
        types.push(type);
        type = new Object();
      }
      const typeName = args[1];
      const argsString = args[2];
      if(first) { first = 0; }
      type.type = queryTools.singularize(typeName);
      type.alias = `${type.type}${queryDepth}`;
      type.args = argsString;
      type.depth = queryDepth;
    }
    else if(attrs && !first) {
      const attrName = attrs[1];
      type[attrName] = `${type.type}${type.depth}${attrName}`;
    }
    lineCount++;
    if(isOpen) { queryDepth++; }
    if(isClosed) { queryDepth--; }
    //if(queryDepth < 1 && !first) { break; }
  }
  //Push remaining GraphQL type
  if(type.depth > -1) { types.push(type); }

  const argumentsString = queryTools.queryArgumentsBuilder(types);
  const attributesString = queryTools.queryAttributesBuilder(types);
  const tablesString = queryTools.queryTablesBuilder(types);
  const sql = `SELECT ${attributesString} FROM ${tablesString} WHERE ${argumentsString}`;
  console.log(sql);
  const distQueries = queryTools.distributedQuery(sql);
  const resultSql = `SELECT * FROM result`;
  const queryResult = queryTools.query(resultSql, 0).then((rows) => rows.map(result => {
    var resultObject = new Object();
    for(var k in types[0]) {
      resultObject[k] = result[types[0][k]];
    }
    for(var t in types) {
      if(t == 0) { continue; }
      var currObject = queryTools.parentLineage(types, resultObject, t);
      for(var k in types[t]) {
        currObject[k] = result[types[t][k]];
      }
    }
    return resultObject;
  }));
  if(distQueries != 0) {
    queryTools.oneshot(`DROP TABLE result`);
    queryTools.oneshot(`VACUUM`);
  }
  return queryResult;
}

const root = {
  components: (args, context) => {
    return queryBuilder(context.body.query, args.system, `components`).then(function(result) {
      const resultSize = queryTools.sizeof(result);
      console.log(`Got GraphQL result object size of: ${resultSize} bytes.`);
      return result;
    });
  },
  envVars: (args, context) => {
    return queryBuilder(context.body.query, args.system, `envVars`).then(function(result) {
      const resultSize = queryTools.sizeof(result);
      console.log(`Got GraphQL result object size of: ${resultSize} bytes.`);
      return result;
    });
  },
  files: (args, context) => {
    return queryBuilder(context.body.query, args.system, `files`).then(function(result) {
      const resultSize = queryTools.sizeof(result);
      console.log(`Got GraphQL result object size of: ${resultSize} bytes.`);
      return result;
    });
  },
  processes: (args, context) => {
    return queryBuilder(context.body.query, args.system, `processes`).then(function(result) {
      const resultSize = queryTools.sizeof(result);
      console.log(`Got GraphQL result object size of: ${resultSize} bytes.`);
      return result;
    });
  }
};

expressServer.use('/graphql', graphqlHTTP({schema, rootValue: root, graphiql: true}));
expressServer.listen(4201, (err) => {
  if (err) { return console.log(err); }
  return console.log('GraphiQL interface available at `localhost:4201/graphql` for querying.');
});

// vim: tabstop=4 shiftwidth=2 softtabstop=2 expandtab shiftround autoindent
