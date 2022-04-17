import { Command } from "../commands.js";

export default async ({bot, collections}) => {
  
  new Command({
    name: "archive",
    description: "Manage the archive settings",
    action: async (interaction) => {

      // Check if the member can manage messages
      const {
        member, 
        data: {
          options: [subcommand]
        }
      } = interaction;
      const channelId = subcommand.options.find(option => option.name === "channel")?.value;
      if (!member) return await interaction.createFollowup("You can only run this command in a guild.");
      if (!member.permissions.has("manageMessages")) return await interaction.createFollowup("No can do! You don't have permission to manage messages in this server.");
      
      // Check what they want to do
      switch (subcommand.name) {

        case "set": {

          const threadId = subcommand.options.find(option => option.name === "thread").value;

          // Set the channel in the database
          await collections.archiveConfig.updateOne(
            {guildId: interaction.guildID},
            {$set: {
              ["thread_ids." + channelId]: threadId
            }}, 
            {upsert: true}
          );

          await interaction.createFollowup("Thread set!");

          break;

        }

        case "auto": {

          const create = subcommand.options.find(option => option.name === "create").value;

          // Set the channel in the database
          await collections.archiveConfig.updateOne(
            {guild_id: interaction.guildID},
            {$set: {
              auto_create_thread: create,
              channel_id: channelId
            }}, 
            {upsert: true}
          );

          await interaction.createFollowup(`I will ${(!create ? "**not** " : "")}create threads for you! ${create ? "♥" : ">:]"}`);

          break;

        }

        case "now": {

          // Get the messages from the channel.
          const channel = channelId ? bot.getChannel(channelId) : interaction.channel;
          const {id: interactionResponseId} = await interaction.getOriginalMessage();
          const messageGroups = [];
          let currentGroup = -1;
          let rawMessages;

          rawMessages = await channel.getMessages({limit: 100, before: interactionResponseId});
          while (rawMessages[0]) {

            for (let i = 0; rawMessages.length > i; i++) {

              // Check if the current group is half of a megabyte.
              if (!messageGroups[currentGroup] || Buffer.byteLength(JSON.stringify([...messageGroups[currentGroup], rawMessages[i]], null, 2)) > 250000) {

                // Increment the current group.
                currentGroup++;

                // Add the array.
                messageGroups[currentGroup] = [];

              }

              messageGroups[currentGroup].unshift(rawMessages[i]);
              
            }

            rawMessages = await channel.getMessages({
              limit: 100,
              before: rawMessages[rawMessages.length - 1].id
            });

          }

          // Stringify the messages so that we can turn it into a JSON file.
          const groupLength = messageGroups.length;
          let messageNumber = 0;
          for (let i = groupLength - 1; i >= 0; i--) {

            // Combine the message groups into an array of 16 0.5 MB message objects.
            const messages = [];
            for (let x = 0; x < 32; x++) {

              const group = messageGroups[i];
              if (!group) {

                break;

              }

              messages.push(...group);
              i--;

            }

            const messagesString = JSON.stringify(messages, null, 2);
            const file = Buffer.from(messagesString);

            if (messageNumber === 0) {

              await interaction.createFollowup(`HERE ARE THE MESSAGES. 1/${Math.ceil(messageGroups.length / 32)}`, {
                file,
                name: `${channel.name}_${new Date().getTime()}_1.json`
              });

            } else {

              await interaction.channel.createMessage(`${messageNumber + 1}/${Math.ceil(messageGroups.length / 32)}`, {
                file,
                name: `${channel.name}_${new Date().getTime()}_${messageNumber + 1}.json`
              });

            }

            messageNumber++;

          }

          // Now, post it to the server.
          break;

        }

        default:
          break;

      }

    },
    cooldown: 0,
    slashOptions: [
      {
        name: "now",
        description: "Copy all messages from this channel to a JSON file.",
        type: 1,
        options: [
          {
            name: "channel",
            description: "The channel that you want to archive. Defaults to the current channel.",
            type: 7
          }
        ]
      },
      {
        name: "pins",
        description: "Copy all pins from this channel to another location",
        type: 1,
        options: [
          {
            name: "unpin",
            description: "Do you want me to unpin all messages in this channel?",
            type: 5
          },
          {
            name: "json",
            description: "Do you want a JSON copy of the messages?",
            type: 5
          },
          {
            name: "json_only",
            description: "Do you only want a JSON copy, and not copy the messages to another channel?",
            type: 5
          }
        ]
      },
      {
        name: "set",
        description: "Manage archive channel settings",
        type: 2,
        options: [
          {
            name: "channel",
            description: "Explicitly set an archive thread for a channel",
            type: 1,
            options: [
              {
                name: "origin",
                description: "Which channel are you talking about?",
                type: 7,
                required: true
              },
              {
                name: "target",
                description: "Which channel or thread do you want me to send pins to?",
                type: 7,
                required: true
              }
            ]
          }, 
          {
            name: "auto",
            description: "Allow me to automatically create threads for archives",
            type: 1,
            options: [
              {
                name: "create",
                description: "Do you want me to create a thread for channels you didn't explicitly set?",
                type: 5,
                required: true
              },
              {
                name: "channel",
                description: "Where do you want me to create threads? Only required if create is true.",
                type: 7
              }
            ]
          }
        ]
      }
    ]
  });

};
