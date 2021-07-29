// Get environment variables
require('dotenv').config();

// Require packagaes
const Eris = require("eris");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const bot = Eris(process.env.token);

// Get the database ready
const cache = require("./cache");

// Experimental mode
const ExperimentalMode = false;

// Process commands
const Commands = require("./commands");
  
fs.readdirSync(path.join(__dirname, "commands")).forEach(function(fileName) {
	const File = require("./commands/" + fileName);
	if (typeof(File) === "function") {
	  File(bot);
	}
});

Commands.registerBot(bot);

var latestMessages = {};
bot.on("messageCreate", async (msg) => {
  
  if (msg.author.bot) return;
  
  const ServerPrefix = Commands.getPrefix(msg.channel.id);
  
  // Check for command
  if (msg.author.id !== bot.user.id && msg.content.substring(0, ServerPrefix.length) === ServerPrefix) {
    if (msg.content.indexOf(" ") != -1) {
      var commandName = msg.content.substring(1, msg.content.indexOf(" "));
      var args = msg.content.substring(msg.content.indexOf(" ")+1);
    } else {
      var commandName = msg.content.substring(1);
    };

    try {
      const Command = Commands.get(commandName.toLowerCase());
      Command ? Command.execute(args, msg) : undefined;
    } catch (err) {
      
    };
  };
  
  // Check if it's an invite
  await require("./modules/invite-protection")(bot, msg);
  await require("./modules/spam-prevention")(bot, msg, latestMessages[msg.author.id]);
  
  // Log the message for later
  latestMessages[msg.author.id] = msg;
  
});

var raidDetection = true;
var raidProtection = false;
var joinTimes = [0, 0, 0, 0, 0];
joinTimes.push = function (){
  if (this.length >= 5) {
      this.shift();
  };
  return Array.prototype.push.apply(this,arguments);
};
bot.on("guildMemberAdd", async (guild, member) => {
  var suspicious = false;
  if (raidDetection) {
    joinTimes.push(new Date().getTime());
    var currentAvg = joinTimes.reduce((a, b) => a + b, 0) / 5;
    for (var i = 0; 4; i++) {
      if (isNaN(joinTimes[i])) break;
      suspicious = Math.abs(joinTimes[i] - currentAvg) < 30000 ? true : false;
      if (!suspicious) break;
    };
  };
  
  raidProtection = suspicious || raidProtection;
  
  if (raidProtection) {
    await member.addRole("850049997449986128");
  };
});

bot.on("error", (err) => {
  
});

bot.on("ready", async () => {
  const Database = await require("./database");
  const dbClient = Database.mongoClient;
  
  console.log("Not ready");
  
  var checking = {};
  async function updateInviteVerification(verifyCode, msg, emoji, reactor, deleted) {
    // Debounce
    reactor = reactor || deleted && {id: -1};
    checking[msg.id] = checking[msg.id] || {};
    if (checking[msg.id] === reactor.id) return;
    checking[msg.id][reactor.id] = 1;
    
    // Check if the message is from the promo channel, has an invite link, was approved by a moderator, and was not approved before
    msg = (msg.content && msg) || (!deleted && await bot.getMessage(msg.channel.id, msg.id));
    reactor = (verifyCode && reactor) || (!deleted && msg.channel.guild.members.find(member => member.id === reactor));
    var inviteMatches = msg.content && msg.content.match(/discord.gg\/(\S+)/mi);
    var code = inviteMatches && inviteMatches[1];
    if (msg.channel.id === "868879799601496084" && deleted || (emoji.name === "✅" && code && reactor.roles.find((r) => {
      return {
        "862071715441803285": r, 
        "862071540521369661": r,
        "549312685255294976": r,
        "753661816999116911": r
      }[r];
    }))) {
      // Check if the invite hasn't been approved before
      db = dbClient.db("guilds");
      collection = db.collection("GuildInviteWhitelist");
      var verificationStatus = await collection.findOne((deleted && {messageId: msg.id}) || {inviteCode: code});
      code = code || (verificationStatus && verificationStatus.inviteCode);
      console.log("Checking if invite " + code + " is approved...");
      let otherStaffApproved = !deleted && await msg.getReaction("✅");
      otherStaffApproved = otherStaffApproved && otherStaffApproved.find(user => msg.channel.guild.members.find(member => {
        if (member.id === user.id) {
          return member.roles.find(r => {
            return {
              "862071715441803285": r, 
              "862071540521369661": r,
              "549312685255294976": r,
              "753661816999116911": r
            }[r]
          })
        };
      }));
      if ((verifyCode && (!verificationStatus || verificationStatus.whitelisted !== 1)) || (!verifyCode && (verificationStatus && verificationStatus.whitelisted === 1) && !otherStaffApproved)) {
        await collection.updateOne(
          {inviteCode: code}, 
          {$set: {whitelisted: (verifyCode && 1) || 0, messageId: msg.id}},
          {upsert: true}
        );
        
        // Tell the team
        console.log("Approved invite " + code);
        await bot.createMessage("543611772263989269", ((deleted && "A promo message with an invite code was deleted, so I") || "<@" + reactor.id + ">") + " " + ((!verifyCode && "un") || "") +"approved the following invite code: " + code + ((deleted && ".") || ".\n\nMore info about the server here: https://discord.com/channels/" + msg.channel.guild.id + "/" + msg.channel.id + "/" + msg.id));
      };
    };
  
    checking[msg.id][reactor.id] = undefined;
  };
  
  bot.on("messageReactionAdd", async (msg, emoji, reactor) => {
    await updateInviteVerification(true, msg, emoji, reactor)
  });
  bot.on("messageReactionRemove", async (msg, emoji, reactor) => {
    await updateInviteVerification(false, msg, emoji, reactor);
  });
  bot.on("messageDelete", async (msg) => {
    if (msg.channel.id === "868879799601496084") {
      await updateInviteVerification(false, msg, undefined, undefined, true);
    };
  });
  
  if (ExperimentalMode) {
    bot.editStatus("idle", {name: "Under maintenance"});
  };
  
  console.log("Ready!");
  
});

bot.connect();