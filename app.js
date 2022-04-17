import { fileURLToPath } from "url";
import { Client } from "eris";
import fs from "fs";
import path, { dirname } from "path";
import { config as loadEnv } from "dotenv";
import getMongoClient from "./database.js";
import {initialize as initializeCommands, listCommands} from "./commands.js";
import convertMediaLinks from "./modules/media-to-cdn.js";
import checkInviteLinks from "./modules/invite-protection.js";
import checkForSpam from "./modules/spam-prevention.js";
import verifyName from "./modules/name-enforcement.js";
import logActivity from "./modules/logs.js";
import checkPin from "./modules/archive-pins.js";

// Load environment variables.
loadEnv();

(async () => {

  const bot = new Client(process.env.token, {
    intents: ["allNonPrivileged", "guildMembers", "guildMessages", "guildPresences"]
  });
  
  const ExperimentalMode = false;
  const checking = {};

  // Set up the database.
  console.log("\x1b[36m%s\x1b[0m", "[Client] Updating database variables...");

  const dbClient = await getMongoClient();
  const db = dbClient.db("guilds");
  const collections = {
    infractions: db.collection("Infractions"),
    inviteWhitelist: db.collection("GuildInviteWhitelist"),
    logConfig: db.collection("LogConfig"),
    archiveConfig: db.collection("ArchiveConfig"),
    guildLogInfo: db.collection("GuildLogInfo")
  };

  console.log("\x1b[32m%s\x1b[0m", "[Client] Database variables updated");
  
  // Set up the Discord events.
  console.log("\x1b[36m%s\x1b[0m", "[Client] Setting up Discord events...");
  bot.on("guildMemberAdd", async (_, member) => {
  
    // Tell the admins
    await bot.createMessage("497607965080027138", "<@" + member.id + "> joined the server!");
  
  });
  
  bot.on("guildMemberRemove", async (guild, member) => {
  
    // Tell the admins
    if (guild.id === "497607965080027136") await bot.createMessage("497607965080027138", member.username + "#" + member.discriminator + " (<@" + member.id + "> / " + member.id + ") left the server.");
  
  });
  
  bot.on("error", (err) => console.log("\x1b[33m%s\x1b[0m", "[Eris] " + err));
  
  bot.on("threadCreate", async (thread) => {
  
    await thread.join();
  
  });

  bot.on("guildMemberUpdate", async (_, member) => {
  
    await verifyName(member);

  });

  bot.on("userUpdate", async (user) => {

    const guilds = bot.guilds.filter(() => true);
    for (let i = 0; guilds.length > i; i++) {

      const guild = guilds.find(possibleGuild => possibleGuild.id === guilds[i].id);
      const member = guild.members.find(possibleMember => possibleMember.id === user.id);
      if (member) {

        await verifyName(member);

      }

    }

  });

  const latestMessages = {};
  bot.on("messageCreate", async (msg) => {
    
    if (msg.author.bot) return;
    
    // Check if it's spam.
    await checkForSpam(bot, msg, latestMessages[msg.author.id]);
    
    // Check if it's an invite.
    await checkInviteLinks(bot, msg);

    // Check if it's a media.discordapp.net link.
    // TODO: Move this to another bot.
    await convertMediaLinks(bot, msg);
    
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

    await checkPin(collections, bot, newMessage, oldMessage);

    const guildConfig = newMessage.channel.guild && await collections.logConfig.findOne({guild_id: newMessage.channel.guild.id});
    if (guildConfig) await logActivity(bot, newMessage, guildConfig, false, oldMessage);

  });

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

  bot.on("messageReactionAdd", async (msg, emoji, reactor) => await updateInviteVerification(true, msg, emoji, reactor));

  bot.on("messageReactionRemove", async (msg, emoji, reactor) => await updateInviteVerification(false, msg, emoji, reactor));

  bot.on("messageDelete", async (msg) => {

    if (msg.channel.id === "868879799601496084") await updateInviteVerification(false, msg, undefined, undefined, true);

    const guildConfig = msg.channel.guild && await collections.logConfig.findOne({guild_id: msg.channel.guild.id});
    await logActivity(bot, msg, guildConfig, true);

  });

  bot.on("ready", async () => {

    console.log("\x1b[32m%s\x1b[0m", "[Client] Connected to Discord!");

    // Attach the bot to the command loader.
    console.log("\x1b[36m%s\x1b[0m", "[Commands] Setting up command actions...");
    await initializeCommands(bot);

    // Set up commands.
    const files = fs.readdirSync(path.join(dirname(fileURLToPath(import.meta.url)), "commands"));
    
    for (let i = 0; files.length > i; i++) {

      const { default: module } = await import("./commands/" + files[i]);

      if (typeof module === "function") {
        
        await module({bot, collections});

      }

    }

    // Upsert/delete slash commands where necessary.
    const commandList = listCommands();
    const commandListNames = Object.keys(commandList);
    for (let i = 0; commandListNames.length > i; i++) {

      await commandList[commandListNames[i]].verifyInteraction();

    }
    
    if (ExperimentalMode) bot.editStatus("idle", {name: "-- MAINTENANCE --"});
    
  });

  // Connect to Discord.
  console.log("\x1b[36m%s\x1b[0m", "[Client] Connecting to Discord...");
  bot.connect();

})();
