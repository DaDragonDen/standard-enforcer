import { Command } from "../commands.js";

export default () => {

  new Command({
    name: "purge",
    description: "Purges a bunch of messages so you don't have to click like a gazillion different times",
    action: async ({ interaction, discordClient }) => {

      // Make sure the user is a member of the guild.
      const guild = discordClient.guilds.find(possibleGuild => possibleGuild.id === interaction.guildID);
      if (!guild) {

        return;

      }

      // Get the member.
      const memberId = interaction.member?.id;
      const member = memberId ? await guild.getMember(memberId) : undefined;
      const { channel, data } = interaction;
      if (!member || !channel || (!member.permissions.has("MANAGE_MESSAGES") && (channel.type !== 11 || channel.ownerID !== member.id))) {

        await interaction.createFollowup({
          content: "Denied."
        });
        return;

      }

      console.log(channel.type === 11 && channel.ownerID === member.id);

      // Delete the messages
      let amount;
      if ("options" in data) {

        amount = data.options.getInteger("amount");

      }

      if (!amount) {

        await interaction.createFollowup({
          content: "How many messages?"
        });
        return;

      }

      const { id: interactionResponseId } = await interaction.getOriginal();
      if (!("guild" in channel)) {

        await interaction.createFollowup({
          content: "This command only works in guilds."
        });
        return;

      }

      await channel.purge({
        limit: amount + 1,
        filter: (filteredMessage) => interactionResponseId !== filteredMessage.id,
        reason: `Following ${member.username}#${member.discriminator}'s orders.`
      });

      // Success!
      await interaction.createFollowup({
        content: "Sure."
      });

    },
    cooldown: 0,
    slashOptions: [{
      name: "amount",
      description: "The amount of messages you want to remove",
      type: 4,
      required: true
    }],
    ephemeral: true
  });

};
