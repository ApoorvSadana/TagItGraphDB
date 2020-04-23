const neo4j = require('neo4j-driver');

// Connect to neo4j database
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'tag$100$'))

module.exports = driver;