const ArgsRegex = /(approve|add|deny|unverify|verify) (\S+)/mi;

module.exports = async function() {
  
  const Database = await require("../database");
  const dbClient = Database.mongoClient;
  const db = dbClient.db("guilds");
  const collection = db.collection("GuildInviteWhitelist");
  const Commands = require("../commands");
  
	new Commands.new("invite", ["invites"], "aaa", async (bot, args, msg) => {
    
    switch (true) {
      
      case ArgsRegex.test(args):
        
        // Check if they're in the Draconic Guard
        if (!msg.member.roles.find((r) => {
          return r === "497608104230387713" || r === "851677671372750878";
        })) return;
        
        const Input = args.match(ArgsRegex);
        
        // Add the invite to the whitelist
        await msg.channel.sendTyping();
        
        var verify = /approve|add|verify/mi.test(Input[1]);
        var code = Input[2];
        await collection.updateOne(
          {inviteCode: code}, 
          {$set: {whitelisted: verify ? 1 : 0}},
          {upsert: true}
        );
        
        // Add to cache
        var currentAllowedInvites = Database.cache.get("allowedInvites") || [];
        currentAllowedInvites.push(code);
        Database.cache.set("allowedInvites", currentAllowedInvites);
        
        // Tell em we did it
        await msg.channel.createMessage({
          content: "Invite `" + code + "` will no" + (verify ? " longer" : "w") + " be filtered.",
          messageReference: {
            messageID: msg.id
          }
        });
        
        break;
      
      default: 

        break;
      
    };
  });
};