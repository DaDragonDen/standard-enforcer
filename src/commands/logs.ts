import { Command } from "../commands.js";

export default async () => {

  const command = new Command({
    name: "logs",
    description: "Modify log settings",
    action: async ({ discordClient, interaction, collections }) => {


      const collection = collections.guildLogInfo;
      const { member, guildID: guildId } = interaction;

      // Check permissions
      if (!member || !member.permissions.has("MANAGE_GUILD")) {

        await interaction.createFollowup({
          content: "Denied."
        });
        return;

      }

      // Check for arguments
      const interactionData = interaction.data;
      if (!("options" in interactionData)) {

        return;

      }

      const subcommand = interactionData.options.getSubCommand()?.[0];
      if (!subcommand) {

        return;

      }

      const { id: memberId } = member;
      const guildConfig = await collection.findOne({ guildId }) || { loggingEnabled: 0, logChannelIds: "[]" };
      switch (subcommand) {

        case "toggle": {

          // Check if logs are enabled
          const LoggingEnabled = guildConfig.loggingEnabled;
          const turnOn = interactionData.options.getBoolean("enable");
          if ((LoggingEnabled && turnOn) || (!LoggingEnabled && !turnOn)) {

            await interaction.createFollowup({
              content: `LOGGING IS ALREADY ${LoggingEnabled ? "ONLINE" : "OFFLINE"}.`
            });
            return;

          }

          // Enable logs
          const loggingSetting = turnOn ? 1 : 0;
          await collection.updateOne(
            { guildId },
            { $set: { loggingEnabled: loggingSetting } },
            { upsert: true }
          );

          // Set cooldown
          command.applyCooldown(memberId, 5000);

          // Success.
          await interaction.createFollowup({
            content: `LOGGING SYSTEMS ${LoggingEnabled ? "OFFLINE" : "ONLINE"}.`
          });
          break;

        }

        case "set": {

          // // Verify that the channels exist
          // const LogChannels = [];
          // if (!LogChannelMatches[0]) {

          //   await interaction.createFollowup({
          //     content: "You didn't mention any channel or ID."
          //   });
          //   return;

          // }

          // for (let i = 0; LogChannelMatches.length > i; i++) {

          //   const LogChannelId = LogChannelMatches[i][1].includes("#") ? LogChannelMatches[i][2] : LogChannelMatches[i][1];
          //   const LogChannel = await discordClient.rest.channels.get(LogChannelId);

          //   if (!LogChannel) {

          //     await interaction.createFollowup({
          //       content: LogChannelId + " isn't a valid channel ID, or I can't access that channel."
          //     });
          //     return;

          //   }

          //   // Add it to the list
          //   LogChannels.push(LogChannelId);

          // }

          // const LogChannelsString = JSON.stringify(LogChannels);

          // // Update the log channels
          // await collection.updateOne(
          //   {guildId}, 
          //   {$set: {logChannelIds: LogChannelsString}},
          //   {upsert: true}
          // );

          // // Set cooldown
          // command.applyCooldown(memberId, 5000);

          // // Tell the user
          // for (let i = 0; LogChannels.length > i; i++) {

          //   LogChannels[i] = (LogChannels.length > 1 ? (i === 0 ? "" : ", " + (i + 1 === LogChannels.length ? "and " : "")) : "") + "<#" + LogChannels[i] + ">";

          // }

          // await interaction.createFollowup({
          //   content: `I'll file this server's logs in ${LogChannels.join("")}!`
          // });
          break;

        }

        case "status": {

          const LogChannelsString = guildConfig.logChannelIds;
          const LogChannels = JSON.parse(LogChannelsString);
          const ValidChannels = [];
          const InvalidChannels = [];

          // Verify Toasty's access
          for (let i = 0; LogChannels.length > i; i++) {

            if (await discordClient.rest.channels.get(LogChannels[i])) {

              ValidChannels.push("<#" + LogChannels[i] + ">");

            } else {

              InvalidChannels.push(LogChannels[i]);

            }

          }

          ValidChannels[ValidChannels.length - 1] = (ValidChannels.length > 1 ? "and " : "") + ValidChannels[ValidChannels.length - 1];

          await interaction.createFollowup({
            content: `LOGGING IS ${guildConfig.loggingEnabled ? `**ENABLED**, ${ValidChannels[0] ? `AND BEING BROADCASTED TO ${ValidChannels.join(", ")}.` : "HOWEVER, THE LOG BROADCAST CHANNEL DOESN'T EXIST."}` : "**DISABLED**."}`
          });
          return;

        }

        default:
          break;

      }

    },
    cooldown: 0,
    slashOptions: [
      {
        name: "toggle",
        type: 1,
        description: "Toggle logging in this server.",
        options: [
          {
            name: "enable",
            type: 5,
            description: "Do you want me to log activity in this server?",
            required: true
          }
        ]
      }, {
        name: "status",
        type: 1,
        description: "Am I logging activity in this server? Find out here."
      }
    ]
  });

};
