module.exports = async (collections, bot, newMessage, oldMessage) => {
  
  let archiveConfig, pins, archiveChannel, archiveChannelId, archiveMessage, archiveThread, archiveThreadId, oldestPin, guildId, targetChannel;

  // Check if the message was pinned
  if (!newMessage.pinned) return;

  // Check if we're at the pin limit
  pins = await newMessage.channel.getPins();
  if (pins.length < 50) return;

  // Check if we should archive stuff, and if there's a thread to send archived messages to
  guildId = newMessage.channel.guild.id
  targetChannel = newMessage.channel;
  archiveConfig = await collections.archiveConfig.findOne({guild_id: guildId});
  archiveThreadId = archiveConfig && archiveConfig.thread_ids && archiveConfig.thread_ids[targetChannel.id];
  archiveThread = archiveThreadId && await bot.getChannel(archiveThreadId);
  if (!archiveThread) {

    // Check if we can create a thread
    archiveChannelId = archiveConfig.channel_id;
    if (!archiveConfig.auto_create_thread || !archiveChannelId) {
      console.log("There is no archive channel");
      return;
    }

    archiveChannel = await bot.getChannel(archiveChannelId);
    archiveMessage = await archiveChannel.createMessage(`I'm going to automatically archive certain messages from <#${targetChannel.id}> and post them here.`);
    archiveThread = await archiveMessage.createThreadWithMessage({
      autoArchiveDuration: 60,
      name: targetChannel.name + " pins"
    });

    // Save the thread to the database
    await collections.archiveConfig.updateOne(
      {guild_id: guildId},
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
      url: `https://discord.com/channels/${guildId}/${targetChannel.id}/${oldestPin.id})`,
      description: oldestPin.content,
      image: oldestPin.attachments[0] && oldestPin.attachments[0].height ? {
        url: oldestPin.attachments[0].url
      } : undefined
    }]
  });

  await oldestPin.unpin();

}