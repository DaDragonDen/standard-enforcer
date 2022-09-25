import "dotenv/config";
import { fileURLToPath } from "url";
import { Client } from "oceanic.js";
import fs from "fs";
import path, { dirname } from "path";
import { MongoClient } from "mongodb";
import { storeClientAndCollections, listCommands } from "./commands.js";
import verifyName from "./modules/name-enforcement.js";
import logActivity from "./modules/logs.js";
import checkPin from "./modules/archive-pins.js";

(async () => {

  const { token, mongoDomain } = process.env;
  if (!token || !mongoDomain) {

    throw new Error();

  }

  const bot = new Client({
    auth: `Bot ${token}`,
    gateway: {
      intents: ["GUILDS", "GUILD_MEMBERS", "GUILD_MESSAGES", "GUILD_PRESENCES"]
    }
  });

  // Set up the database.
  console.log("\x1b[36m%s\x1b[0m", "[Client] Connecting to MongoDB...");

  const dbClient = new MongoClient(mongoDomain);
  await dbClient.connect();

  console.log("\x1b[32m%s\x1b[0m", "[Client] Connected!");
  console.log("\x1b[36m%s\x1b[0m", "[Client] Updating database variables...");

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
  bot.on("guildMemberAdd", async (member) => {

    // Tell the admins
    await bot.rest.channels.createMessage("497607965080027138", {
      content: "<@" + member.id + "> joined the server!"
    });

  });

  bot.on("guildMemberRemove", async (member, guild) => {

    // Tell the admins
    if (guild.id === "497607965080027136") {

      const contentPartial = "username" in member ? `${member.username}#${member.discriminator}` : "An unknown user";

      await bot.rest.channels.createMessage("497607965080027138", {
        content: `${contentPartial} (<@${member.id}> / ${member.id}) left the server.`
      });

    }

  });

  bot.on("error", (err) => console.log("\x1b[33m%s\x1b[0m", "[Eris] " + err));

  bot.on("threadCreate", async (thread) => {

    // Check if this is a forum thread.
    if (thread.type === 11) {

      // Check if the thread creator needs feedback.
      const tags = thread.appliedTags;
      const feedbackRequestedId = "1019654897936912474";
      const feedbackGivenId = "1019676029381525504";
      if (tags.find((tagId) => tagId === feedbackRequestedId) && !tags.find((tagId) => tagId === feedbackGivenId)) {

        try {

          // Lock the channel.
          const currentOverwrite = thread.parent?.permissionOverwrites.find((overwrite) => overwrite.id === "634819722101260313");
          let currentAllow = currentOverwrite?.allow ?? 0n;
          if (currentAllow & 1n << 11n) {

            currentAllow -= 1n << 11n;

          }
          await thread.parent?.editPermission("634819722101260313", {
            allow: `${currentAllow}`,
            deny: `${(currentOverwrite?.deny ?? 0n) | 1n << 11n}`,
            reason: "Enforcing Rule #8",
            type: 0
          });

        } catch (err: unknown) {

        }

      }

    }

    await thread.join();

  });

  bot.on("threadUpdate", async (thread, oldThread) => {

    if (thread?.type === 11 && oldThread?.type === 11) {

      const feedbackRequestedId = "1019654897936912474";
      const feedbackGivenId = "1019676029381525504";
      const currentTags = thread.appliedTags;
      const opWantsFeedbackNow = currentTags.find((tagId) => tagId === feedbackRequestedId);
      if ((currentTags.find((tagId) => tagId === feedbackGivenId) && opWantsFeedbackNow) || (!opWantsFeedbackNow && oldThread.appliedTags.find((tagId) => tagId === feedbackRequestedId))) {

        try {

          // Unlock the channel.
          const currentOverwrite = thread.parent?.permissionOverwrites.find((overwrite) => overwrite.id === "634819722101260313");
          let currentDeny = currentOverwrite?.deny ?? 0n;
          console.log(currentDeny);
          if (currentDeny & 1n << 11n) {
            
            currentDeny -= 1n << 11n;

          }
          console.log(currentDeny);
          await thread.parent?.editPermission("634819722101260313", {
            allow: `${(currentOverwrite?.allow ?? 0n) | 1n << 11n}`,
            deny: `${currentDeny}`,
            reason: "Enforcing Rule #8",
            type: 0
          });

        } catch (err: unknown) {

          console.log(err);

        }

      }
      
    }

  });

  bot.on("guildMemberUpdate", async (member) => {

    await verifyName(member);

  });

  bot.on("userUpdate", async (user) => {

    const guilds = bot.guilds.filter(() => true);
    for (let i = 0; guilds.length > i; i++) {

      const guild = guilds.find(possibleGuild => possibleGuild.id === guilds[i].id);
      const member = guild?.members.find(possibleMember => possibleMember.id === user.id);
      if (member) {

        await verifyName(member);

      }

    }

  });

  bot.on("messageUpdate", async (newMessage, oldMessage) => {

    try {

      if (!newMessage.channel) {

        newMessage = await bot.rest.channels.getMessage(newMessage.channelID, newMessage.id);

      }

      if (newMessage.inCachedGuildChannel()) {

        await checkPin(collections.archiveConfig, bot, newMessage);

        const guildConfig = newMessage.channel && newMessage.channel.type === 0 && await collections.logConfig.findOne({ guild_id: newMessage.channel.guild.id });
        if (guildConfig) await logActivity(bot, newMessage, guildConfig, false, oldMessage);

      }

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", "[messageUpdate] Couldn't get message: " + err);
      return;

    }

  });

  bot.on("messageDelete", async (msg) => {

    try {

      if (!("inCachedGuildChannel" in msg) || !msg.channel) {

        msg = await bot.rest.channels.getMessage(msg.channelID, msg.id);

      }

      if (msg.inCachedGuildChannel()) {

        const guildConfig = await collections.logConfig.findOne({ guild_id: msg.guild.id });
        await logActivity(bot, msg, guildConfig, true);

      }

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", `[messageUpdate] Couldn't get message: ${err}`);

    }

  });

  bot.once("ready", async () => {

    console.log("\x1b[32m%s\x1b[0m", "[Client] Connected to Discord!");

    // Attach the bot to the command loader.
    console.log("\x1b[36m%s\x1b[0m", "[Commands] Setting up command actions...");
    await storeClientAndCollections(bot, collections);

    // Set up commands.
    const files = fs.readdirSync(path.join(dirname(fileURLToPath(import.meta.url)), "commands"));

    for (let i = 0; files.length > i; i++) {

      const { default: module } = await import("./commands/" + files[i]);

      if (typeof module === "function") {

        await module({ bot, collections });

      }

    }

    // Upsert/delete slash commands where necessary.
    const commandList = listCommands();
    const commandListNames = Object.keys(commandList);
    for (let i = 0; commandListNames.length > i; i++) {

      await commandList[commandListNames[i]].verifyInteraction();

    }

  });

  // Connect to Discord.
  console.log("\x1b[36m%s\x1b[0m", "[Client] Connecting to Discord...");
  bot.connect();

})();
