// Get environment variables
require("dotenv").config();

// Require packagaes
const Eris = require("eris");
const fs = require("fs");
const path = require("path");

const bot = Eris(process.env.token);

// Experimental mode
const ExperimentalMode = false;

let raidDetection = true;
let raidProtection = false;
const joinTimes = [0, 0, 0, 0, 0];
joinTimes.push = () => {

  if (this.length >= 5) {

    this.shift();

  }

  return Array.prototype.push.apply(this);

};
bot.on("guildMemberAdd", async (guild, member) => {

  let suspicious = false;
  if (raidDetection) {

    joinTimes.push(new Date().getTime());
    const currentAvg = joinTimes.reduce((a, b) => a + b, 0) / 5;
    for (let i = 0; i < 5; i++) {

      if (Number.isNaN(joinTimes[i])) break;
      suspicious = Math.abs(joinTimes[i] - currentAvg) < 30000;
      if (!suspicious) break;

    }

  }
  
  raidProtection = suspicious || raidProtection;
  
  if (raidProtection) {

    try {

      await member.addRole("850049997449986128");

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", "[Raid Protection] Couldn't suppress " + member.username + "#" + member.discriminator + " (" + member.id + "): " + err);

    }

  }

});

bot.on("error", (err) => {
  
  console.log("\x1b[33m%s\x1b[0m", "[Eris] " + err);

});

let database, dbClient, db, collections;
async function loadDB() {

  console.log("\x1b[36m%s\x1b[0m", "[Client] Updating database variables...");

  database = await require("./database");
  dbClient = database.mongoClient;
  db = dbClient.db("guilds");
  collections = {
    infractions: db.collection("Infractions"),
    inviteWhitelist: db.collection("GuildInviteWhitelist")
  };

  console.log("\x1b[32m%s\x1b[0m", "[Client] Database variables updated");
  
}

const checking = {};
async function updateInviteVerification(verifyCodes, msg, emoji, reactor, deleted) {

  // Debounce
  reactor = reactor || (deleted && {id: -1});
  checking[msg.id] = checking[msg.id] || {};
  if (checking[msg.id] === reactor.id) return;
  checking[msg.id][reactor.id] = 1;
  
  // Check if we're approving the invite now
  msg = (msg.content && msg) || (!deleted && await bot.getMessage(msg.channel.id, msg.id));
  const approvingNow = !deleted && verifyCodes;
  let otherStaffApproved = !approvingNow && await msg.getReaction("✅");
  otherStaffApproved = otherStaffApproved && otherStaffApproved.find(user => msg.channel.guild.members.find(member => member.id === user.id && member.roles.find(r => {

    return {
      "862071715441803285": r, 
      "862071540521369661": r,
      "549312685255294976": r,
      "753661816999116911": r
    }[r];

  })));

  // Check if the message is from the promo channel, has an invite link, was approved by a moderator, and was not approved before
  reactor = (verifyCodes && reactor) || (!deleted && msg.channel.guild.members.find(member => member.id === reactor));
  const inviteMatches = msg.content && [...msg.content.matchAll(/discord.gg\/(\S+)/gmi)];
  if (msg.channel.id === "868879799601496084" && (deleted || (emoji.name === "✅" && inviteMatches[0] && reactor.roles.find((r) => {

    return {
      "862071715441803285": r, 
      "862071540521369661": r,
      "549312685255294976": r,
      "753661816999116911": r
    }[r];

  })))) {

    const updatedInvites = [];
    for (let i = 0; inviteMatches.length > i; i++) {
      
      // Check if the invite hasn't been approved before
      const code = inviteMatches[i][1];
      const verificationStatus = await collections.inviteWhitelist.findOne((deleted && {messageId: msg.id}) || {inviteCode: code});
      if ((verifyCodes && (!verificationStatus || verificationStatus.whitelisted !== 1)) || (!verifyCodes && (verificationStatus && verificationStatus.whitelisted === 1) && !otherStaffApproved)) {
        
        // Update the database3
        await collections.inviteWhitelist.updateOne(
          {inviteCode: code}, 
          {$set: {whitelisted: (verifyCodes && 1) || 0, messageId: msg.id}},
          {upsert: true}
        );

        // Success!
        updatedInvites.push(code);
        console.log("Approved invite " + code);
      
      }

    }

    // Tell the team
    const plural = updatedInvites[1] ? "s" : "";
    await bot.createMessage("543611772263989269", ((deleted && "A promo message with " + (plural ? "" : "an ") + "invite code" + (plural ? "s were" : " was") + " deleted, so I") || "<@" + reactor.id + ">") + " " + (!verifyCodes ? "un" : "") + "approved the following invite code" + plural + ": " + updatedInvites.join(", ") + ((deleted && ".") || ".\n\nMore info about the server here: https://discord.com/channels/" + msg.channel.guild.id + "/" + msg.channel.id + "/" + msg.id));

  }

  checking[msg.id][reactor.id] = undefined;

}

let startedLoading;
bot.on("ready", async () => {
  
  if (startedLoading) return;
  startedLoading = true;

  // Load database
  await loadDB();

  // Process commands
  const commands = require("./commands");
  await commands.initialize(bot);
    
  const files = fs.readdirSync(path.join(__dirname, "commands"));
  for (let x = 0; files.length > x; x++) {

    try {

      const file = require("./commands/" + files[x]);
      if (typeof(file) === "function") await file(bot, collections);

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", "[Commands] Couldn't add " + files[x] + ": " + err);

    }

  }
  
  // Upsert/delete slash commands where necessary
  const commandList = Object.keys(commands.list);
  for (let i = 0; commandList.length > i; i++) {

    await commands.list[commandList[i]].verifyInteraction();

  }

  bot.on("guildMemberUpdate", async (_, member) => {

    await require("./modules/name-enforcement")(member);

  });

  bot.on("userUpdate", async (user) => {

    const guilds = bot.guilds.filter(() => true);
    for (let i = 0; guilds.length > i; i++) {

      const guild = guilds.find(possibleGuild => possibleGuild.id === guilds[i].id);
      const member = guild.members.find(possibleMember => possibleMember.id === user.id);
      if (member) {

        await require("./modules/name-enforcement")(member);

      }

    }

  });

  const latestMessages = {};
  bot.on("messageCreate", async (msg) => {
    
    if (msg.author.bot) return;
    
    const ServerPrefix = commands.getPrefix(msg.channel.id);
    
    // Check for command
    if (msg.author.id !== bot.user.id && msg.content.substring(0, ServerPrefix.length) === ServerPrefix) {

      let commandName, args;
      if (msg.content.indexOf(" ") !== -1) {

        commandName = msg.content.substring(1, msg.content.indexOf(" "));
        args = msg.content.substring(msg.content.indexOf(" ") + 1);

      } else {

        commandName = msg.content.substring(1);

      }

      try {

        const command = commands.get(commandName.toLowerCase());
        if (command) command.execute(args, msg);

      } catch (err) {

        console.log("[Commands] Couldn't execute command: " + err);
        
      }

    }
    
    // Check if it's an invite
    await require("./modules/invite-protection")(bot, msg);
    await require("./modules/spam-prevention")(bot, msg, latestMessages[msg.author.id]);
    
    // Log the message for later
    latestMessages[msg.author.id] = msg;
    
  });

  bot.on("messageReactionAdd", async (msg, emoji, reactor) => await updateInviteVerification(true, msg, emoji, reactor));

  bot.on("messageReactionRemove", async (msg, emoji, reactor) => await updateInviteVerification(false, msg, emoji, reactor));

  bot.on("messageDelete", async msg => msg.channel.id === "868879799601496084" && await updateInviteVerification(false, msg, undefined, undefined, true));
  
  if (ExperimentalMode) {

    bot.editStatus("idle", {name: "UNDER MAINTENANCE."});

  }
  
  console.log("Ready!");
  
});

bot.connect();
