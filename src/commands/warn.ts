import { Command } from "../commands.js";

export default () => {

  new Command({
    name: "warn",
    description: "Warn a user for violating the rules",
    action: async ({ discordClient, collections, interaction }) => {

      // Make sure the member has permission to do this
      const { member, guildID } = interaction;
      const guild = discordClient.guilds.find(possibleGuild => possibleGuild.id === guildID);
      if (!member || !guild || !member.permissions.has("KICK_MEMBERS") && !member.permissions.has("BAN_MEMBERS")) {

        await interaction.createFollowup({
          content: "Denied."
        });
        return;

      }

      // Make sure the bad guy isn't us
      const interactionData = interaction.data;
      const badGuy = "options" in interactionData && guild.members.find(possibleMember => possibleMember.id === interactionData.options.getMember("member")?.id);
      if (!badGuy) {

        await interaction.createFollowup({
          content: "Who should we punish?"
        });
        return;

      }

      switch (badGuy.id) {

        case discordClient.user.id:
          await interaction.createFollowup({
            content: "Who are you to accuse me?"
          });
          return;

        case member.id:
          await interaction.createFollowup({
            content: "Is this...roleplay?"
          });
          return;

        default: {

          // Add a warning to the bad guy

          const reason = interactionData.options.getString("reason");

          try {

            collections.infractions.insertOne({
              userId: badGuy.id,
              moderatorId: member.id,
              type: 0,
              reason: reason
            });

          } catch (err: unknown) {

            await interaction.createFollowup({
              content: "I think I am bugged.",
              embeds: [{
                description: err instanceof Error ? err.stack : "Unknown error."
              }]
            });
            return;

          }

          // DM them, if possible
          const badGuyFullName = badGuy.username + "#" + badGuy.discriminator + " (" + badGuy.id + ")";
          try {

            const dmChannel = await discordClient.rest.channels.createDM(badGuy.id);
            await dmChannel.createMessage({
              content: "THE DRACONIC GUARD OF DA DRAGON DEN HAS **WARNED** YOU FOR THE FOLLOWING REASON: \n\n> " + reason + "\n\nPLEASE REVIEW THE RULES. THIS IS ONLY A WARNING. FURTHER VIOLATIONS MIGHT RESULT IN MORE SEVERE PUNISHMENTS."
            });

          } catch (err) {

            console.log("[Infraction] Couldn't DM " + badGuyFullName + ": " + err);

          }

          await interaction.createFollowup({
            content: "They have been warned."
          });

        }

      }

    },
    cooldown: 0,
    slashOptions: [
      {
        name: "member",
        description: "The member you want to warn",
        type: 6,
        required: true
      }, {
        name: "reason",
        description: "Why?",
        type: 3,
        required: true
      }
    ]
  });

};
