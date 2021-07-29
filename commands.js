const DefaultPrefix = ":";

var commands = {};
var bot;

var cooledUsers = {};

class Command {

  execute(args, msg) {

    // Check if the user is under cooldown
    const AuthorId = msg.author.id;
    const ExecuteTime = new Date().getTime();
    const RemainingCooldown = cooledUsers[AuthorId] ? (cooledUsers[AuthorId][this.name] + this.cooldown) - ExecuteTime : 0
    if (cooledUsers[AuthorId] && RemainingCooldown > 0) {
      msg.channel.createMessage("<@" + AuthorId + "> You're moving too fast...even for me! Give me " + RemainingCooldown / 1000 + " more seconds.");
      return;
    };

    // Put the user under cooldown
    this.applyCooldown(AuthorId);

    // Execute the command
    this.action(bot, args, msg);

  };

  applyCooldown(userId, milliseconds) {

    const ExecuteTime = new Date().getTime();

    if (!cooledUsers[userId]) {
      cooledUsers[userId] = {};
    };

    cooledUsers[userId][this.name] = milliseconds ? ExecuteTime + milliseconds : ExecuteTime;
  };

  setAction(action) {
    this.action = action;
  };
  
  constructor(name, aliases, category, action, cooldown) {
    
    // Check if the command already exists
    if (commands[name]) {
      throw "Command " + name + " already exists";
    };
    
    // Create the command
    this.category = category;
    this.aliases = aliases || [];
    this.action = action;
    this.cooldown = cooldown === false ? 0 : cooldown || 0;

    commands[name] = this;
    
    return commands[name];

  };
};

// Functions for other scripts to use
function listCommands() {
  return commands;
};

function getCommand(commandName) {
  if (!commandName) {
    throw "No command name provided";
  };
  
  var command = commands[commandName];
  
  // Find the command by alias
  if (!command) {
    
    for (var possibleCommand in commands) {
      if (commands.hasOwnProperty(possibleCommand)) {
        function findAlias(alias) {
          if (alias === commandName) {
            return alias;
          };
        };
        
        if (commands[possibleCommand].aliases.find(findAlias)) {
          var command = commands[possibleCommand];
          break;
        };
      };
    };
    
  };
  
  return command;
};

function registerBot(client) {
  bot = client;
};

function getPrefix(guildId) {
  return DefaultPrefix;
};

// Send the exports!
exports.registerBot = (client) => { registerBot(client); };
exports.get = (command) => { return getCommand(command); };
exports.list = listCommands();
exports.new = Command;
exports.getPrefix = getPrefix;