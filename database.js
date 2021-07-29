/*
const sqlite3 = require("better-sqlite3");
const db = sqlite3("data.db");

db.prepare(`create table if not exists Events (
  eventMessageId text not null, 
  emote text not null, 
  role text, 
  allowLate bit default 1, 
  earlyRoles bit default 1, 
  hosts text, 
  startDate int, 
  endDate int)`).run();
  
db.prepare(`create table if not exists RoleMessages (
  roleMessageId text not null,
  emote text not null,
  roleId text not null
  )`).run();
  
db.prepare(`create table if not exists VoiceAndTextChannels (
  voiceChannelId text not null,
  textChannelId text not null
  )`).run()

module.exports = db;
*/
module.exports = (async () => {
  // Create client
  const MongoDB = require("mongodb");
  const MDBC = new MongoDB.MongoClient(
    "mongodb+srv://3dadmin:Gs3-.CycY7Xbhi_@guarvolkcluster.q9rql.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", 
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  await MDBC.connect();

  // Create cache
  const NCache = require("node-cache");
  const cache = new NCache();
  return {
    mongoClient: MDBC,
    cache: cache
  };
})();