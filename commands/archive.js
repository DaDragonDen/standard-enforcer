const Commands = require("../commands");

module.exports = async (_, collections) => {

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
      name: "set",
      description: "Explicitly set an archive thread for a channel.",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Which channel are you talking about?",
          type: 7,
          required: true
        },
        {
          name: "thread",
          description: "Which thread do you want me to send pins to?",
          type: 7,
          required: true
        }
      ]
    }, {
      name: "auto",
      description: "Allow me to automatically create threads for pins.",
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
  ]);

}