const commands = {};
let bot;
const cooledUsers = {};

require("dotenv").config();

let configuredCommands = [];
let followups = {};
class Command {
  
  async execute(interaction, componentResponse) {

    // Acknowledge the interaction
    await interaction.defer(this.ephemeral ? 64 : undefined);
    
    // Check if the user is under cooldown
    const AuthorId = (interaction.member || interaction.user).id;
    const ExecuteTime = new Date().getTime();
    const RemainingCooldown = cooledUsers[AuthorId] ? (cooledUsers[AuthorId][this.name] + this.cooldown) - ExecuteTime : 0;
    if (cooledUsers[AuthorId] && RemainingCooldown > 0) {

      return await interaction.createFollowup("<@" + AuthorId + "> You're moving too fast...even for me! Give me " + RemainingCooldown / 1000 + " more seconds.");

    }

    // Put the user under cooldown
    this.applyCooldown(AuthorId);

    // Execute the command
    let waitForComponent = (followupId) => {
      followups[followupId] = this.name;
    }
    try {

      return await this.action(bot, interaction, waitForComponent, componentResponse);

    } catch (err) {

      console.log(err);

      return await interaction.createFollowup(interaction.id, interaction.token, {content: "Uh oh. Something real bad happened. Let's try that again."});

    }

  }

  applyCooldown(userId, milliseconds) {

    const ExecuteTime = new Date().getTime();

    if (!cooledUsers[userId]) {

      cooledUsers[userId] = {};

    }

    cooledUsers[userId][this.name] = milliseconds ? ExecuteTime + milliseconds : ExecuteTime;

  }

  setAction(action) {

    this.action = action;

  }

  async verifyInteraction() { 

    function optionsSame() {
      return true;
    }

    const interactionCmdInfo = configuredCommands.find(c => c.name === this.name);
    if (this.slashOptions && !interactionCmdInfo) {

      try {

        console.log("\x1b[36m%s\x1b[0m", "[Commands] " + (this.slashOptions ? "Creating" : "Deleting") + " interaction for command \"" + this.name + "\"...");

        await bot.createCommand({
          name: this.name,
          description: this.description,
          options: this.slashOptions
        });

        console.log("\x1b[32m%s\x1b[0m", "[Commands] Successfully created interaction for command \"" + this.name + "\"!");

      } catch (err) {

        console.log(err);
        console.log("\x1b[33m%s\x1b[0m", "[Commands] Couldn't add interaction for command \"" + this.name + "\"...");

      }

    } else if (!this.slashOptions && interactionCmdInfo) {
      
      console.log("\x1b[36m%s\x1b[0m", "[Commands] Removing interaction for command \"" + this.name + "\"...");
      this.deleteInteraction = true;
      console.log("\x1b[32m%s\x1b[0m", "[Commands] Removed interaction for command \"" + this.name + "\"...");

    } else if (!optionsSame(this.slashOptions, interactionCmdInfo.options)) {
      
      console.log("\x1b[36m%s\x1b[0m", "[Commands] Updating interaction for command \"" + this.name + "\"...");
      await bot.editCommand(interactionCmdInfo.id, {
        name: this.name,
        description: this.description,
        options: this.slashOptions
      });
      console.log("\x1b[32m%s\x1b[0m", "[Commands] Successfully updated interaction for command \"" + this.name + "\"!");
      
    }

  }
  
  constructor(name, description, action, cooldown, slashOptions, ephemeral) {

    console.log("\x1b[36m%s\x1b[0m", "[Commands] Adding " + name + " command...");

    // Check if the command already exists
    if (commands[name]) {

      throw new Error("Command " + name + " already exists");

    }
    
    // Create the command
    this.name = name;
    this.action = action;
    this.description = description;
    this.cooldown = cooldown === false ? 0 : cooldown || 0;
    this.slashOptions = slashOptions;
    this.ephemeral = ephemeral || false;
    commands[name] = this;
    
    console.log("\x1b[32m%s\x1b[0m", "[Commands] Finished adding " + name + " command");

    return commands[name];

  }

}

// Functions for other scripts to use
function listCommands() {

  return commands;

}

function getCommand(commandName) {

  if (!commandName) {

    throw new Error("No command name provided");

  }
  
  let command = commands[commandName];
  
  // Find the command by alias
  if (!command) {
    
    for (const possibleCommand in commands) {

      if (commands.hasOwnProperty(possibleCommand)) {

        if (commands[possibleCommand].aliases.find(alias => alias === commandName)) {

          command = commands[possibleCommand];
          break;

        }

      }

    }
    
  }
  
  return command;

}

async function initialize(client) {

  // Get the already configured commands
  try {
    
    configuredCommands = await client.getCommands();

  } catch (err) {

    console.log("[Commands] Couldn't get existing slash commands from Discord: " + err);

  }

  // Listen to interactions
  client.on("interactionCreate", async (interaction) => {
    
    let interactionName, command;
    
    // Make sure it's a command
    if (interaction.type === 2) {

      // Check if the command exists
      interactionName = interaction.data.name;
      command = commands[interactionName];
      
      if (command) {
  
        await command.execute(interaction);
  
      } else {
  
        await bot.deleteCommand(interaction.data.id);
  
      }

    } else {

      command = commands[followups[interaction.message.id]];
      if (command) {

        followups[interaction.message.id] = undefined;
        await command.execute(interaction, true);
        
      }
      
    }


  });

  bot = client;

}

// Send the exports!
exports.initialize = initialize;
exports.get = getCommand;
exports.list = listCommands();
exports.new = Command;