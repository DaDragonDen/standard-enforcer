import { Command } from "../commands.js";

export default ({bot}) => {
  
  new Command({
    name: "purge", 
    description: "Purge a bunch of messages so you don't have to click like a gazillion different times", 
    action: async (interaction) => {

      // Make sure the member has permission to do this
      const guild = bot.guilds.find(possibleGuild => possibleGuild.id === interaction.guildID);
      const member = guild.members.find(possibleMember => possibleMember.id === interaction.member.id);
      if (!member.permission.has("manageMessages")) {

        return await interaction.createFollowup("DENIED.");

      }

      // Delete the messages
      const amount = interaction.data.options.find(option => option.name === "amount").value;
      const {id: interactionResponseId} = await interaction.getOriginalMessage();
      await interaction.channel.purge({
        limit: amount + 1,
        filter: filteredMessage => interactionResponseId !== filteredMessage.id,
        reason: `FOLLOWING ${member.username}#${member.discriminator}'S ORDERS.`
      });

      // Success!
      return await interaction.createFollowup("SURE.");

    }, 
    cooldown: 0, 
    slashOptions: [{
      name: "amount",
      description: "The amount of messages you want to remove",
      type: 4,
      required: true
    }]
  });

};
