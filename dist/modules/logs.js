export default async (bot, msg, guildConfig, deleted, oldMessage) => {
    try {
        // Make sure we have a channel
        const logChannels = guildConfig ? guildConfig.log_channel_ids : [];
        if (!logChannels || logChannels.length === 0) {
            console.log("Guild " + msg.channel.guild.id + " doesn't have a log channel.");
            return;
        }
        // Check if the message was deleted or edited
        if (!deleted && (!oldMessage || oldMessage.content === msg.content))
            return;
        // Send the message to the log channel
        for (let i = 0; logChannels.length > i; i++) {
            const logChannel = bot.getChannel(logChannels[i]);
            // Check if we have access to the channel
            if (!logChannel || logChannel.type !== 1) {
                continue;
            }
            // Sort out the fields
            const author = msg.author ? {
                name: msg.author.username + "#" + msg.author.discriminator,
                icon_url: msg.author.avatarURL
            } : undefined;
            const fields = [{
                    name: "Channel",
                    value: "<#" + msg.channel.id + ">"
                }];
            if (msg.content) {
                fields.push({
                    name: (deleted ? "C" : "New c") + "ontent",
                    value: msg.content
                });
                if (oldMessage) {
                    fields.push({
                        name: "Old content",
                        value: oldMessage.content
                    });
                }
            }
            else {
                fields.push({
                    name: "No content available",
                    value: "This message was likely just an attachment"
                });
            }
            // Send the log
            await logChannel.createMessage({
                content: deleted ? `A message sent by ${msg.author ? `<@${msg.author.id}>` : "an unknown sender"} was deleted.` : `<@${msg.author.id}> edited their message.`,
                embeds: [
                    {
                        author: author,
                        color: deleted ? 16715278 : 14994184,
                        fields: fields,
                        footer: {
                            text: msg.id
                        }
                    }
                ],
                allowedMentions: {
                    users: false
                }
            });
        }
    }
    catch (err) {
        console.log("\x1b[33m%s\x1b[0m", "[Logging] Couldn't log message: " + err);
    }
};
//# sourceMappingURL=logs.js.map