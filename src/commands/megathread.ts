import { Command } from "../commands.js";

export default () => {

  new Command({
    name: "megathread",
    description: "Deletes a message in this channel",
    action: async ({ interaction, discordClient, collections }) => {

      // Make sure the user is a member of the guild.
      const guild = discordClient.guilds.find(possibleGuild => possibleGuild.id === interaction.guildID);
      if (!guild) {

        return;

      }

      // Get the member.
      const { member, channel, data } = interaction;
      const isModerator = member?.permissions.has("MANAGE_MESSAGES");
      if (!member || !channel || channel.type !== 11 || (!isModerator && (channel.ownerID !== member.id))) {

        await interaction.createFollowup({
          content: "Denied."
        });
        return;

      }

      // Make sure the parent channel is a forum channel.
      let parentChannel;
      try {

        parentChannel = await discordClient.rest.channels.get(channel.parentID);
        if (parentChannel.type !== 15) {

          await interaction.createFollowup({
            content: "You can only run that command in a forum channel."
          });
          return;

        }

      } catch (err) {

        await interaction.createFollowup({
          content: "Couldn't find the parent channel."
        });
        return;

      }

      // Get the subcommand.
      const options = "options" in data ? data.options : undefined;
      const subCommand = options?.getSubCommand()?.[0];
      if (!options || !subCommand) {

        return;

      }

      // Make sure the message exists.
      const messageId = options.getString("message_id");
      const isRetracting = subCommand === "retract";
      const channelInfo = await collections.megathreads.findOne({channelId: parentChannel.id});
      const threadId: string = channelInfo ? channelInfo.megathreadId : undefined;
      let message;
      
      try {
        
        message = messageId && await discordClient.rest.channels.getMessage(isRetracting ? threadId : channel.id, messageId);

      } catch (err) {



      }

      if (!message) {

        await interaction.createFollowup({
          content: "I couldn't find that message."
        });
        return;

      }

      let announcement;
      if (isRetracting) {
        
        try {

          // Make sure the message comes from their thread.
          // Get the linked message.
          const footerText = message.embeds[0].footer?.text;
          const linkedMessageId = footerText?.slice(12);
          const linkedMessage = linkedMessageId && await discordClient.rest.channels.getMessage(channel.id, linkedMessageId);
          if (!linkedMessage && !isModerator) {

            await interaction.createFollowup({
              content: "That message isn't from this channel, so I'm can't verify that you have permission to delete it."
            })
            return;

          }
          await message.delete();

        } catch (err) {

        }

      } else {

        // Check if there's a thread we can post to.
        let thread;
        try {

          thread = channelInfo ? await discordClient.rest.channels.get(threadId) : undefined;

        } catch (err) {

          console.log(`[Megathreads] Couldn't find thread ${threadId}; creating a new thread`);

        }

        // Now check if there's a 
        const timeOffset = -5;
        let threadHourPosted = channelInfo ? channelInfo._id.getTimestamp().getUTCHours() - timeOffset : undefined;
        if (threadHourPosted && threadHourPosted < 0) {

          threadHourPosted = 24 - threadHourPosted;

        }
        const date = new Date();
        const threadDatePosted = channelInfo ? channelInfo._id.getTimestamp().getUTCHours() : undefined;
        if (!channelInfo || thread?.type !== 11 || !threadHourPosted || date.getUTCHours() - timeOffset < threadHourPosted || !threadDatePosted || date.getUTCDate() !== threadDatePosted) {

          // Post the thread.
          thread = await parentChannel.startThread({
            name: `Megathread notification post (${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()})`,
            message: {
              content: "In this thread, I amplify certain messages that appear in the megathreads in this channel. Members will only get notified about this once per day at most. \n\nIf a specific megathread *tickles your fancy*, please follow it instead of this post."
            }
          });

          // Save the info to the database.
          await collections.megathreads.updateOne(
            {channelId: parentChannel.id},
            {
              $set: {
                megathreadId: thread.id
              }
            },
            {upsert: true}
          );

        }

        const attachments = message.attachments.filter((attachment) => {
          
          // Make sure it's an image.
          const fileName = attachment.filename;
          const extensionIndex = fileName.lastIndexOf(".") + 1;
          const extension = fileName.slice(extensionIndex);

          return extension === "png" || extension === "gif" || extension === "jpg" || extension === "jpeg";

        });
        announcement = await thread.createMessage({
          content: attachments[1] ? "There are more attachments available. Check this message out by clicking the title." : undefined,
          embeds: [
            {
              title: channel.name,
              author: {
                name: `${message.author.username}#${message.author.discriminator}`,
                iconURL: message.author.avatarURL()
              },
              image: attachments[0] ? {
                url: attachments[0].url
              } : undefined,
              url: `https://discord.com/channels/${guild.id}/${channel.id}/${messageId}`,
              description: message.content,
              footer: {
                text: `Message ID: ${messageId}`
              }
            }
          ]
        });

      }

      await interaction.createFollowup({
        content: `Done.${announcement ? ` It can be seen here: https://discord.com/channels/${guild.id}/${announcement.channel.id}/${announcement.id}` : ""}`
      });

    },
    slashOptions: [
      {
        name: "announce",
        description: "Announce a message in the megathread notification thread.",
        type: 1,
        options: [
          {
            name: "message_id",
            description: "Which message do you want to announce? Get the ID from your thread.",
            type: 3,
            required: true
          }
        ]
      }, 
      {
        name: "retract",
        description: "Retract an announcement from the megathread notification thread.",
        type: 1,
        options: [
          {
            name: "message_id",
            description: "Which message do you want to retract? Get the message ID from the notification thread.",
            type: 3,
            required: true
          }
        ]
      }
    ]
  });
  
}