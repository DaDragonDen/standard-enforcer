module.exports = async (collections, bot, newMessage, oldMessage) => {
  
  let archiveConfig;
  let pins;
  let archiveChannel;
  let archiveChannelId;
  let archiveMessage;
  let archiveThread;
  let archiveThreadId;
  let oldestPin;
  let targetChannel;
  let archivedThreads;
  let guild;
  let channels;
  let i;
  let x;

  // Check if the message was pinned
  if (!newMessage.pinned) return;

  // Check if we're at the pin limit
  pins = await newMessage.channel.getPins();
  if (pins.length < 50) return;

  // Check if we should archive stuff, and if there's a thread to send archived messages to
  guild = newMessage.channel.guild;
  targetChannel = newMessage.channel;
  archiveConfig = await collections.archiveConfig.findOne({guild_id: guild.id});
  archiveThreadId = archiveConfig && archiveConfig.thread_ids && archiveConfig.thread_ids[targetChannel.id];
  archiveThread = archiveThreadId && await bot.getChannel(archiveThreadId);

  if (!archiveThread && archiveThreadId) {

    // Search for the thread, then unarchive it if it exists
    channels = guild.channels.filter(channel => channel.type === 0);
    for (i = 0; channels.length > i; i++) {

      try {

        channels[i] = await bot.getChannel(channels[i].id);
        archivedThreads = await channels[i].getArchivedThreads("public");
        archiveThread = archivedThreads.threads.find(thread => thread.id === archiveThreadId);

        if (archiveThread) {

          await archiveThread.edit({archived: false});
          break;

        }

      } catch (err) {

        console.log(`Skipping channel ${channels[i].id}: ${err.message}`);

      }

    }

  }

  if (!archiveThread) {

    // Create a thread
    archiveChannelId = archiveConfig.channel_id;
    archiveChannel = await bot.getChannel(archiveChannelId);
    if (!archiveChannelId || !archiveConfig.auto_create_thread) return;
    archiveMessage = await archiveChannel.createMessage(`I'm going to automatically archive certain messages from <#${targetChannel.id}> and post them here.`);
    archiveThread = await archiveMessage.createThreadWithMessage({
      autoArchiveDuration: 60,
      name: targetChannel.name + " pins"
    });

    // Save the thread to the database
    await collections.archiveConfig.updateOne(
      {guild_id: guild.id},
      {$set: {
        ["thread_ids." + targetChannel.id]: archiveThread.id
      }}, 
      {upsert: true}
    );

  }

  // Get the oldest pin and archive it
  oldestPin = pins[pins.length - 1];
  await archiveThread.createMessage({
    embeds: [{
      author: {
        name: oldestPin.author.username + "#" + oldestPin.author.discriminator,
        icon_url: oldestPin.author.avatarURL
      },
      title: "Click here to go to the message",
      url: `https://discord.com/channels/${guild.id}/${targetChannel.id}/${oldestPin.id}`,
      description: oldestPin.content,
      image: oldestPin.attachments[0] && oldestPin.attachments[0].height ? {
        url: oldestPin.attachments[0].url
      } : undefined
    }]
  });

  await oldestPin.unpin();

}