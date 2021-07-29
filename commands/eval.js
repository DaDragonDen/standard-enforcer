const Command = require("../commands");

// eslint-disable-next-line no-unused-vars
module.exports = (_, collections) => {
  
  new Command.new("eval", ["evaluate"], "dev", "A command for debugging the bot", undefined, async (bot, args, msg, interaction) => {

    // Make sure they're allowed to eval
    if (interaction ? interaction.member.id : msg.author.id !== "419881371004174338") {

      return {content: "DENIED."};

    }
    
    // Run the command
    try {

      eval(interaction ? interaction.data.options.find(option => option.name === "code").value : args);
      return {content: "SUCCESS."};

    } catch (err) {

      return interaction ? {content: err.message} : await msg.channel.createMessage("ERROR: \n```" + err + "\n```");

    }

  }, undefined, [{
    name: "code",
    description: "The code you want to run",
    type: 3,
    required: true
  }]);

};
