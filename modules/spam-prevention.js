const Commands = require("../commands");
const Slurs = /nigga|nigger|fag|faggot/gmi;

module.exports = async function(bot, msg, previousMsg) {
  // Check exemptions
  if (msg.member.roles.find((r) => {
    return {
      "862071715441803285": r, 
      "862071540521369661": r,
      "549312685255294976": r,
      "753661816999116911": r
    }[r];
  })) {
    return true;
  };
  
  // Remove mention spam
  var removalMsg = "<@" + msg.author.id + "> ";
  if (msg.mentions.length > 6) {
    await msg.delete();
    await msg.channel.createMessage(removalMsg + "Please don't ping that many members in one message.");
    return false;
    
  // Remove slurs
  } else if (Slurs.test(msg.content)) {
    await msg.delete();
    await msg.channel.createMessage(removalMsg + "Don't say that again.");
    return false;
  
  // Remove repeated messages
  /*
  } else if (previousMsg && previousMsg.content.toLowerCase() === msg.content.toLowerCase() && msg.createdAt - previousMsg.createdAt < 60000 && msg.channel.id !== "509403818031710208") {
    await msg.delete();
    await msg.channel.createMessage(removalMsg + "PLEASE for the love of @everyone say something else");
    return false;
  */
  };
  
  return true;
}