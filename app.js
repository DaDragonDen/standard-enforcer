require("dotenv").config();
const Eris = require("eris");
const fs = require("fs");
const path = require("path");
const express = require("express");
const bot = Eris(process.env.token, {
  intents: ["allNonPrivileged", "guildMembers", "guildMessages", "guildPresences"]
});

const ExperimentalMode = false;
let database, dbClient, db, collections, startedLoading, commands, files, i;
const checking = {};
const loadDB = async () => {

  console.log("\x1b[36m%s\x1b[0m", "[Client] Updating database variables...");

  database = await require("./database");
  dbClient = database.mongoClient;
  db = dbClient.db("guilds");
  collections = {
    infractions: db.collection("Infractions"),
    inviteWhitelist: db.collection("GuildInviteWhitelist"),
    logConfig: db.collection("LogConfig"),
    archiveConfig: db.collection("ArchiveConfig")
  };

  console.log("\x1b[32m%s\x1b[0m", "[Client] Database variables updated");
  
};

bot.on("guildMemberAdd", async (guild, member) => {

  // Tell the admins
  await bot.createMessage("497607965080027138", "<@" + member.id + "> joined the server!");

});

bot.on("guildMemberRemove", async (guild, member) => {

  // Tell the admins
  if (guild.id === "497607965080027136") await bot.createMessage("497607965080027138", member.username + "#" + member.discriminator + " (<@" + member.id + "> / " + member.id + ") left the server.");

});

bot.on("error", (err) => console.log("\x1b[33m%s\x1b[0m", "[Eris] " + err));

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

bot.on("ready", async () => {
  
  if (startedLoading) return;

  startedLoading = true;
  commands = require("./commands");
  files = fs.readdirSync(path.join(__dirname, "commands"));

  // Load database
  await loadDB();

  // Process commands
  await commands.initialize(bot);
  
  for (i = 0; files.length > i; i++) {

    try {

      const file = require("./commands/" + files[i]);
      if (typeof(file) === "function") await file(bot, collections);

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", `[Commands] Couldn't add ${files[i]}: ${err}`);

    }

  }
  
  // Upsert/delete slash commands where necessary
  const commandList = Object.keys(commands.list);
  for (i = 0; commandList.length > i; i++) {

    await commands.list[commandList[i]].verifyInteraction();

  }

  bot.on("guildMemberUpdate", async (_, member) => {

    await require("./modules/name-enforcement")(member);

  });

  bot.on("userUpdate", async (user) => {

    const guilds = bot.guilds.filter(() => true);
    for (i = 0; guilds.length > i; i++) {

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
    
    // Check if it's an invite
    await require("./modules/invite-protection")(bot, msg);
    await require("./modules/spam-prevention")(bot, msg, latestMessages[msg.author.id]);
    
    // Log the message for later
    latestMessages[msg.author.id] = msg;
    
  });

  bot.on("messageUpdate", async (newMessage, oldMessage) => {

    try {
      
      newMessage = await bot.getMessage(newMessage.channel.id, newMessage.id);

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", "[messageUpdate] Couldn't get message: " + err);
      return;

    }

    await require("./modules/archive-pins")(collections, bot, newMessage, oldMessage);

    const guildConfig = newMessage.channel.guild && await collections.logConfig.findOne({guild_id: newMessage.channel.guild.id});
    if (guildConfig) await require("./modules/logs")(bot, newMessage, guildConfig, false, oldMessage);

  });

  bot.on("messageReactionAdd", async (msg, emoji, reactor) => await updateInviteVerification(true, msg, emoji, reactor));

  bot.on("messageReactionRemove", async (msg, emoji, reactor) => await updateInviteVerification(false, msg, emoji, reactor));

  bot.on("messageDelete", async (msg) => {
    if (msg.channel.id === "868879799601496084") await updateInviteVerification(false, msg, undefined, undefined, true);

    const guildConfig = msg.channel.guild && await collections.logConfig.findOne({guild_id: msg.channel.guild.id});
    await require("./modules/logs")(bot, msg, guildConfig, true);

  });
  
  if (ExperimentalMode) bot.editStatus("idle", {name: "Going under maintenance!"});

  // Set up the ping server
  const webServer = express();
  webServer.get("*", (req, res) => res.sendStatus(200));
  webServer.listen(3000, () => console.log("[Web Server] Online!"));
  
});

bot.connect();