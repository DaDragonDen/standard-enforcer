export default async (collection, bot, newMessage) => {
    // Check if the message was pinned
    if (!newMessage.pinned)
        return;
    // Check if we're at the pin limit
    const pins = await newMessage.channel.getPinnedMessages();
    if (pins.length < 50)
        return;
    // Check if we should archive stuff, and if there's a thread to send archived messages to
    const { channel: targetChannel, channel: { guild } } = newMessage;
    const archiveConfig = await collection.findOne({ guild_id: guild.id });
    const archiveThreadId = archiveConfig && archiveConfig.thread_ids && archiveConfig.thread_ids[targetChannel.id];
    let archiveThread = archiveThreadId && await bot.rest.channels.get(archiveThreadId);
    let archivedThreads;
    if (!archiveThread && archiveThreadId) {
        // Search for the thread, then unarchive it if it exists
        const channels = guild.channels.filter(channel => channel.type === 0);
        for (let i = 0; channels.length > i; i++) {
            try {
                const channel = await bot.rest.channels.get(channels[i].id);
                if (channel.type === 0) {
                    archivedThreads = await channel.getPublicArchivedThreads();
                    archiveThread = archivedThreads.threads.find(thread => thread.id === archiveThreadId);
                    if (archiveThread) {
                        await archiveThread.edit({ archived: false });
                        break;
                    }
                }
            }
            catch (err) {
                console.log(`Skipping channel ${channels[i].id}: ${err}`);
            }
        }
    }
    // Check if there isn't an available archive thread.
    if (!archiveThread && archiveConfig) {
        // Create a thread
        const archiveChannelId = archiveConfig.channel_id;
        const archiveChannel = await bot.rest.channels.get(archiveChannelId);
        if (!archiveChannelId || !archiveConfig.auto_create_thread || archiveChannel.type !== 0) {
            return;
        }
        const archiveMessage = await archiveChannel.createMessage({
            content: `I'm going to automatically archive certain messages from <#${targetChannel.id}> and post them here.`
        });
        archiveThread = await archiveMessage.startThread({
            autoArchiveDuration: 60,
            name: targetChannel.name + " pins"
        });
        // Save the thread to the database
        await collection.updateOne({ guild_id: guild.id }, {
            $set: {
                ["thread_ids." + targetChannel.id]: archiveThread.id
            }
        }, { upsert: true });
    }
    // Get the oldest pin and archive it
    const oldestPin = pins[pins.length - 1];
    const attachments = oldestPin.attachments.filter(() => true);
    await archiveThread.createMessage({
        embeds: [{
                author: {
                    name: oldestPin.author.username + "#" + oldestPin.author.discriminator,
                    icon_url: oldestPin.author.avatarURL
                },
                title: "Click here to go to the message",
                url: `https://discord.com/channels/${guild.id}/${targetChannel.id}/${oldestPin.id}`,
                description: oldestPin.content,
                image: attachments[0] && attachments[0].height ? {
                    url: attachments[0].url
                } : undefined
            }]
    });
    await oldestPin.unpin();
};
//# sourceMappingURL=archive-pins.js.map