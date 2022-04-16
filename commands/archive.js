const Commands = require("../commands");

module.exports = async (_, collections) => {

  async function convertChannelToArray(channel) {

    let messages = [];
    let rawMessages;
    let i;

    rawMessages = await channel.getMessages({limit: 100});
    while (rawMessages[0]) {

      for (i = 0; rawMessages.length > i; i++) {

        messages.push(rawMessages[i]);
        
      }

      rawMessages = await channel.getMessages({
        limit: 100,
        before: rawMessages[rawMessages.length - 1].id
      });
      
    }

    return messages;
    
  }

  async function moveMessages(messageArray, channel, bot) {

    let i;
    let webhooks;
    let webhook;
    let webhookCreator;
    let message;

    // Find if we have a webhook
    webhooks = await channel.getWebhooks();
    for (i = 0; webhooks.length > i; i++) {

      webhookCreator = webhooks[i].user;
      if (webhookCreator && webhookCreator.id === bot.user.id) {

        webhook = webhooks[i];
        break;
        
      }
      
    }

    // Create a webhook if we don't have one
    if (!webhook) {

      webhook = await channel.createWebhook({
        name: "Archive Assistant"
      }, "Required for archiving");
      
    }
    
    for (i = 0; messageArray.length > i; i++) {

      message = messageArray[i];
      await bot.executeWebhook(webhook.id, webhook.token, {
        avatarURL: message.author.avatarURL,
        username: message.author.username,
        data: {
          content: message.content,
          embed: {
            timestamp: message.createdAt,
            footer: {
              text: `Message ID: ${message.id} • Author ID: ${message.author.id}`
            }
          }
        }
      });
      
    }
    
  }
  
  new Commands.new("archive", "Manage the archive settings", async (bot, interaction) => {

    let subCommand, member;

    // Check if the member can manage messages
    member = interaction.member;
    if (!member) return await interaction.createFollowup("You can only run this command in a guild.");
    if (!member.permissions.has("manageMessages")) return await interaction.createFollowup("No can do! You don't have permission to manage messages in this server.");
    
    // Check what they want to do
    subCommand = interaction.data.options[0];
    switch (subCommand.name) {

      case "set": {

        const channelId = subCommand.options.find(option => option.name === "channel").value;
        const threadId = subCommand.options.find(option => option.name === "thread").value;

        // Set the channel in the database
        await collections.archiveConfig.updateOne(
          {guild_id: interaction.guildID},
          {$set: {
            ["thread_ids." + channelId]: threadId
          }}, 
          {upsert: true}
        );

        await interaction.createFollowup("Thread set!");

        break;

      }

      case "auto": {

        const create = subCommand.options[0].options.find(option => option.name === "create").value;
        const channelId = subCommand.options[0].options.find(option => option.name === "channel").value;

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

      default:
        break;

    }

  }, 0, [
    {
      name: "messages",
      description: "Copy all messages from this channel to another location",
      type: 1,
      options: [
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
  ]);

}