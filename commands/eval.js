const Commands = require("../commands");

function userAllowedToEval(bot, userId) {
  
  if (userId === "419881371004174338") return true;
  
  return false;
  
};

module.exports = function() {
  new Commands.new("eval", ["evaluate", "run"], "help", async (bot, args, msg) => {
    
    // Make sure they're allowed to eval
    if (!userAllowedToEval(bot, msg.author.id)) {
      return;
    };
    
    // Run the command
    try {
      eval(args);
    } catch (err) {
      msg.channel.createMessage("Something happened!!1 \n```" + err + "\n```");
    };
    
  });
};