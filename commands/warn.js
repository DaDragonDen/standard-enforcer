import { Command } from "../commands.js";

export default ({bot, collections}) => {
  
  new Command({
    name: "warn", 
    description: "Warn a user for violating the rules", 
    action: async (interaction) => {

      // Make sure the member has permission to do this
      const {member, guildID} = interaction;
      const guild = bot.guilds.find(possibleGuild => possibleGuild.id === guildID);
      if (!member.permission.has("kickMembers") && !member.permission.has("banMembers")) {

        return await interaction.createFollowup("DENIED.");

      }

      // Make sure the bad guy isn't us
      const badGuy = guild.members.find(possibleMember => possibleMember.id === interaction.data.options.find(option => option.name === "member").value);
      const reason = interaction.data.options.find(option => option.name === "reason").value;
      switch (badGuy.id) {

        case bot.user.id:
          return await interaction.createFollowup("WHO ARE YOU TO ACCUSE ME?");

        case member.id:
          return await interaction.createFollowup("IS THIS...ROLEPLAY?");

        default: {

          // Make sure they can warn the bad guy

          // Add a warning to the bad guy
          try {

            collections.infractions.insertOne({
              userId: badGuy.id,
              moderatorId: member.id,
              type: 0,
              reason: reason
            });

          } catch ({stack: description}) {

            const failMsg = "I AM BUGGED? TERRIBLE.";
            return await interaction.createFollowup({
              content: failMsg, 
              embeds: [{
                description
              }]
            });

          }

          // DM them, if possible
          const badGuyFullName = badGuy.username + "#" + badGuy.discriminator + " (" + badGuy.id + ")";
          const DMChannel = await bot.getDMChannel(badGuy.id);
          try {

            await DMChannel.createMessage("THE DRACONIC GUARD OF DA DRAGON DEN HAS **WARNED** YOU FOR THE FOLLOWING REASON: \n\n> " + reason + "\n\nPLEASE REVIEW THE RULES. THIS IS ONLY A WARNING. FURTHER VIOLATIONS MIGHT RESULT IN MORE SEVERE PUNISHMENTS.");

          } catch (err) {

            console.log("[Infraction] Couldn't DM " + badGuyFullName + ": " + err);

          }

          return await interaction.createFollowup("THEY HAVE BEEN WARNED.");

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
