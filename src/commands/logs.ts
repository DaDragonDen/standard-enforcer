import { Command } from "../commands.js";

export default async () => {

  const command = new Command({
    name: "logging",
    description: "Modify log settings",
    action: async ({ discordClient, interaction, collections }) => {

      const collection = collections.guildLogInfo;
      const { member, guildID: guildId } = interaction;

      // Check permissions
      if (!member || !member.permissions.has("MANAGE_GUILD")) {

        await interaction.createFollowup({
          content: "You don't have permissions to do that.",
          embeds: [
            {
              description: "You're missing the Manage Guild permission."
            }
          ]
        });
        return;

      }

      // Check for arguments
      const interactionData = interaction.data;
      if (!("options" in interactionData)) {

        return;

      }

      const {options} = interactionData;
      const subcommand = options.getSubCommand();
      if (!subcommand) {

        return;

      }
      
      const subcommandGroupName = subcommand[0];
      const { id: memberId } = member;
      const guildConfig = await collection.findOne({ guildId }) || { loggingEnabled: 0, loggedChannelIds: [], logStorageChannelId: "", logListIsWhiteList: false};
      switch (subcommandGroupName) {
        
        case "list": {

          // Get the real subcommand name.
          const subcommandName = subcommand[1];
          switch (subcommandName) {

            case "add":
            case "remove": {

              // Get the channel
              const channel = options.getChannel("channel");
              if (!channel) return;

              // Add or remove the channel.
              const isAddingChannel = subcommandName === "add";
              await collection.updateOne(
                { guildId },
                { 
                  [isAddingChannel ? "$push" : "$pull"]: { 
                    loggedChannelIds: channel.id
                  } 
                },
                { upsert: true }
              );

              // Tell the user that everything's OK.
              await interaction.createFollowup({
                content: `${isAddingChannel && !guildConfig.logListIsWhiteList ? "Now logging" : "I'm no longer logging"} <#${channel.id}>.`,
                embeds: !guildConfig.loggingEnabled && isAddingChannel ? [
                  {
                    description: "Logging is currently disabled. Run **/logging enable** to fix this."
                  }
                ] : undefined
              });

              break;

            }

            case "type":

              // Get the booleans.
              const isWhiteList = options.getBoolean("toggle") ?? true;
              const shouldResetList = options.getBoolean("reset") ?? false;

              // Update the settings.
              await collection.updateOne(
                { guildId },
                { 
                  $set: {
                    logListIsWhitelist: isWhiteList,
                    ...(shouldResetList && {
                      loggedChannelIds: []
                    })
                  }
                },
                { upsert: true }
              );

              // Tell the user that everything's OK.
              await interaction.createFollowup({
                content: `I changed the list type to be a **${isWhiteList ? "WHITELIST" : "BLACKLIST"}**.${shouldResetList ? " I also reset the list, so there are no channels on it at the moment." : ""}`
              });

              break;
            
            default:
              break;

          }
          break;

        }

        case "storage": {

          // Get the subcommand name.
          const subcommandName = subcommand[1];
          let storageChannel;
          if (subcommandName === "set") {

            // Make sure the storage channel exists.
            storageChannel = options.getChannel("channel");
            if (!storageChannel) {

              await interaction.createFollowup({
                content: "I couldn't find that channel. Do I have permission to view it?"
              });
              return;

            }

          }

          // Set the storage channel.
          await collection.updateOne(
            { guildId },
            { 
              $set: {
                logStorageChannelId: storageChannel?.id
              }
            },
            { upsert: true }
          );
          
          // Tell the user everything's OK.
          await interaction.createFollowup({
            content: storageChannel ? `I'm now sending logs to <#${storageChannel.id}>.` : `I'm no longer sending logs to that channel.`
          })

          break;

        }

        case "disable":
        case "enable": {

          // Check if logs are enabled
          const loggingEnabled = guildConfig.loggingEnabled;
          const turnOn = subcommandGroupName === "enable";
          if ((loggingEnabled && turnOn) || (!loggingEnabled && !turnOn)) {

            await interaction.createFollowup({
              content: `Logging is already **${loggingEnabled ? "ONLINE" : "OFFLINE"}**.`
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
            content: `Logging systems are now **${loggingEnabled ? "OFFLINE" : "ONLINE"}**.`
          });
          break;

        }

        case "status": {

          const storageChannelId = guildConfig.logStorageChannelId;
          const logChannelIds = guildConfig.loggedChannelIds ?? [];
          const validChannels = [];
          const invalidChannels = [];

          // Verify Toasty's access
          for (let i = 0; logChannelIds.length > i; i++) {

            if (await discordClient.rest.channels.get(logChannelIds[i])) {

              validChannels.push(`<#${logChannelIds[i]}>`);

            } else {

              invalidChannels.push(logChannelIds[i]);

            }

          }

          validChannels[validChannels.length - 1] = (validChannels.length > 1 ? "and " : "") + validChannels[validChannels.length - 1];

          await interaction.createFollowup({
            content: `Logging is ${guildConfig.loggingEnabled ? `**ENABLED**${storageChannelId ? `. Logs are being stored in <#${storageChannelId}>.${validChannels[0] ? ` The following channels are ${!guildConfig.logListIsWhiteList ? "**NOT**" : ""} logged: ${validChannels.join(", ")}.` : ""}` : "; however, the storage channel doesn't exist."}` : "**DISABLED**."}`
          });

        }

        default:
          break;

      }

    },
    cooldown: 0,
    slashOptions: [
      {
        name: "list",
        type: 2,
        description: "Manage tracked or ignored channels",
        options: [
          {
            name: "add",
            type: 1,
            description: "Add a channel that you want me to track messages from.",
            options: [
              {
                name: "channel",
                type: 7,
                description: "Which channel do you want me to track?",
                required: true
              }
            ]
          },
          {
            name: "remove",
            type: 1,
            description: "Remove a channel from the list.",
            options: [
              {
                name: "channel",
                type: 7,
                description: "Which channel do you want me to track?",
                required: true
              }
            ]
          },
          {
            name: "type",
            type: 1,
            description: "Set the channel list to be a whitelist or a blacklist.",
            options: [
              {
                name: "toggle",
                description: "Do you want me to track all channels by default?",
                type: 5,
                required: true
              },
              {
                name: "reset",
                description: "Would you like me to reset the list?",
                type: 5
              }
            ]
          }
        ]
      },
      {
        name: "storage",
        type: 2,
        description: "Manage log broadcast channels",
        options: [
          {
            name: "set",
            type: 1,
            description: "Set the channel where you want me to put logs.",
            options: [
              {
                name: "channel",
                description: "Which channel do you want me to store logs in?",
                type: 7,
                required: true
              }
            ]
          },
          {
            name: "unset",
            type: 1,
            description: "Unset the log channel if there is one."
          }
        ]
      },
      {
        name: "enable",
        type: 1,
        description: "Enable logging in this server."
      },
      {
        name: "disable",
        type: 1,
        description: "Disable logging in this server."
      },
      {
        name: "status",
        type: 1,
        description: "Find out if I logging activity in this server."
      }
    ]
  });

};
