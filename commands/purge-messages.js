const Command = require("../commands");

module.exports = () => {
  
  new Command.new("purge", "Purge a bunch of messages so you don't have to click like a gazillion different times", async (bot, interaction, initInteractionResponse) => {

    // Make sure the member has permission to do this
    const guild = interaction ? bot.guilds.find(possibleGuild => possibleGuild.id === interaction.guild_id) : msg.channel.guild;
    const member = (interaction ? guild.members.find(possibleMember => possibleMember.id === interaction.member.user.id) : msg.member);
    if (!member.permission.has("manageMessages")) {

      return interaction ? {content: "DENIED."} : await msg.channel.createMessage("DENIED.");

    }

    // Delete the messages
    const amount = interaction ? interaction.data.options.find(option => option.name === "amount").value : args;
    const channel = interaction ? bot.getChannel(interaction.channel_id) : msg.channel;
    await channel.purge({
      limit: amount + 1,
      filter: filteredMessage => initInteractionResponse.id !== filteredMessage.id,
      reason: "FOLLOWING " + member.username + "'S ORDERS."
    });

    // Success!
    return interaction ? {content: "IT IS DONE."} : await msg.channel.createMessage("IT IS DONE.");

  }, 0, [{
    name: "amount",
    description: "The amount of messages you want to remove",
    type: 4,
    required: true
  }]);

};
