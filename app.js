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
    for (let i = 0; i < 4; i++) {

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
  
});

let database, dbClient, db, collections;
async function loadDB() {

  console.log("\x1b[36m%s\x1b[0m", "[Client] Updating database variables...");

  database = await require("./database");
  dbClient = database.mongoClient;
  db = dbClient.db("guilds");
  collections = {
    infractions: db.collection("Infractions")
  };

  console.log("\x1b[32m%s\x1b[0m", "[Client] Database variables updated");
  
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
        
      }

    }
    
    // Check if it's an invite
    await require("./modules/invite-protection")(bot, msg);
    await require("./modules/spam-prevention")(bot, msg, latestMessages[msg.author.id]);
    
    // Log the message for later
    latestMessages[msg.author.id] = msg;
    
  });
  
  if (ExperimentalMode) {

    bot.editStatus("idle", {name: "UNDER MAINTENANCE."});

  }
  
  console.log("Ready!");
  
});

bot.connect();
