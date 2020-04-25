const neo4j = require("neo4j-driver");

// Connect to neo4j database
const driver = neo4j.driver(
  "bolt://3.92.183.49:7687",
  neo4j.auth.basic("neo4j", "tag$100$")
);

module.exports = driver;
