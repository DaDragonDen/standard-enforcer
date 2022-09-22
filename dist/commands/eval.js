import { Command } from "../commands.js";
export default () => {
    new Command({
        name: "eval",
        description: "A command for debugging the bot",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        action: async ({ discordClient, collections, interaction }) => {
            // Make sure they're allowed to eval
            if ((interaction.member || interaction.user).id !== "419881371004174338") {
                await interaction.createFollowup({
                    content: "I don't think I want to do that."
                });
                return;
            }
            // Run the command
            try {
                const code = "options" in interaction.data && interaction.data.options.getString("code");
                if (!code) {
                    return;
                }
                eval(code);
                await interaction.createFollowup({
                    content: "Done!"
                });
            }
            catch (err) {
                await interaction.createFollowup({
                    content: err instanceof Error ? err.stack : "Unknown error"
                });
            }
        },
        cooldown: 0,
        slashOptions: [
            {
                name: "code",
                description: "The code you want to run",
                type: 3,
                required: true
            }
        ]
    });
};
//# sourceMappingURL=eval.js.map