import { Command } from "../commands.js";
export default () => {
    new Command({
        name: "purge",
        description: "Purge a bunch of messages so you don't have to click like a gazillion different times",
        action: async ({ interaction, discordClient }) => {
            // Make sure the member has permission to do this
            const guild = discordClient.guilds.find(possibleGuild => possibleGuild.id === interaction.guildID);
            if (!guild) {
                return;
            }
            const member = guild.members.find(possibleMember => possibleMember.id === interaction.member?.id);
            if (!member || !member.permissions.has("MANAGE_MESSAGES")) {
                await interaction.createFollowup({
                    content: "Denied."
                });
                return;
            }
            // Delete the messages
            let amount;
            if ("options" in interaction.data) {
                amount = interaction.data.options.getNumber("amount");
            }
            if (!amount) {
                return;
            }
            const { id: interactionResponseId } = await interaction.getOriginal();
            if (!interaction.channel || !("guild" in interaction.channel)) {
                return;
            }
            await interaction.channel.purge({
                limit: amount + 1,
                filter: (filteredMessage) => interactionResponseId !== filteredMessage.id,
                reason: `FOLLOWING ${member.username}#${member.discriminator}'S ORDERS.`
            });
            // Success!
            await interaction.createFollowup({
                content: "SURE."
            });
        },
        cooldown: 0,
        slashOptions: [{
                name: "amount",
                description: "The amount of messages you want to remove",
                type: 4,
                required: true
            }]
    });
};
//# sourceMappingURL=purge-messages.js.map