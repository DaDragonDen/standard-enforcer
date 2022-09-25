import { Command } from "../commands.js";

export default () => {

  new Command({
    name: "pins",
    description: "Manage pins in this channel",
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

      const options = "options" in data ? data.options : undefined;
      const subCommand = options?.getSubCommand()?.[0];
      if (!options || !subCommand) {

        return;

      }

      // Get the message ID.
      let messageId = options.getString("message_id");
      const isPinning = subCommand === "add";
      if (!messageId) {

        // Check if we're pinning or unpinning.
        let message;
        if (isPinning) {

          message = (await channel.getMessages({
            limit: 1
          }))?.[0];

        } else {

          message = (await channel.getPinnedMessages())?.[0];

        }

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
      await channel[isPinning ? "pinMessage" : "unpinMessage"](messageId, `Following ${member.username}#${member.discriminator}'s orders.`);

      // Success!
      await interaction.createFollowup({
        content: "Sure."
      });

    },
    cooldown: 0,
    slashOptions: [{
      name: "add",
      description: "Adds a pin to this channel",
      type: 1,
      options: [
        {
          name: "message_id",
          description: "The ID of the message to pin. Defaults to the last sent message",
          type: 3
        }
      ]
    }, {
      name: "remove",
      description: "Removes a pin from this channel",
      type: 1,
      options: [
        {
          name: "message_id",
          description: "The ID of the pinned message. Defaults to the last pinned message",
          type: 3
        }
      ]
    }],
    ephemeral: true
  });

};
