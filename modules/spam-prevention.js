const Slurs = /nigga|nigger|fag|faggot/gmi;

module.exports = async (bot, msg, previousMsg) => {

  // Check if this is the server
  if (msg.channel.type !== 0) return;

  // Check exemptions
  // eslint-disable-next-line arrow-body-style
  if (msg.member.roles.find((r) => {

    return {
      "862071715441803285": r, 
      "862071540521369661": r,
      "549312685255294976": r,
      "753661816999116911": r
    }[r];

  })) {

    return true;
    
  }
  
  const removalMsg = "<@" + msg.author.id + "> ";
  let clear = true;
  if (msg.mentions.length > 6) {

    // Remove mention spam
    await msg.delete();
    await msg.channel.createMessage(removalMsg + "Please don't ping that many members in one message.");
    clear = false;
    
  } else if (Slurs.test(msg.content)) {

    // Remove slurs
    await msg.delete();
    await msg.channel.createMessage(removalMsg + "Don't say that again.");
    clear = false;
  
  } else if (previousMsg && previousMsg.content.toLowerCase() === msg.content.toLowerCase() && msg.createdAt - previousMsg.createdAt < 60000 && msg.channel.id !== "509403818031710208") {
    
    /*
    // Remove repeated messages
    await msg.delete();
    await msg.channel.createMessage(removalMsg + "PLEASE for the love of @everyone say something else");
    return false;
    */

  }
  
  return clear;

};
