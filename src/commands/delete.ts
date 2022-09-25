import { Command } from "../commands.js";

export default () => {

  new Command({
    name: "delete",
    description: "Deletes a message in this channel",
    action: async ({ interaction, discordClient }) => {

      // Make sure the user is a member of the guild.
      const guild = discordClient.guilds.find(possibleGuild => possibleGuild.id === interaction.guildID);
      if (!guild) {

        return;

      }

      // Get the member.
      const { member, channel, data } = interaction;
      if (!member || !channel || (!member.permissions.has("MANAGE_MESSAGES") && (channel.type !== 11 || channel.ownerID !== member.id))) {

        await interaction.createFollowup({
          content: "Denied."
        });
        return;

      }

      // Get the message ID.
      let messageId = "options" in data ? data.options.getString("message_id") : undefined;
      if (!messageId) {

        // Check if we're pinning or unpinning.
        const message = (await channel.getMessages({
          limit: 1
        }))?.[0];

        if (message) {

          messageId = message.id;

        } else {

          await interaction.createFollowup({
            content: "Couldn't find a message."
          });
          return;

        }

      }

      // Pin the message.
      await channel.deleteMessage(messageId, `Following ${member.username}#${member.discriminator}'s orders.`);

      // Success!
      await interaction.createFollowup({
        content: "Sure."
      });

    },
    cooldown: 0,
    slashOptions: [{
      name: "message_id",
      description: "The ID of the message to delete",
      type: 3
    }],
    ephemeral: true
  });

};
