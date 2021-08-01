const Command = require("../commands");

module.exports = (_, collections) => {
  
  new Command.new("warn", ["prune"], "dev", "Warn a user for violating the rules", undefined, async (bot, args, msg, interaction) => {

    // Make sure the member has permission to do this
    const guild = interaction ? bot.guilds.find(possibleGuild => possibleGuild.id === interaction.guild_id) : msg.channel.guild;
    const member = (interaction ? guild.members.find(possibleMember => possibleMember.id === interaction.member.user.id) : msg.member);
    if (!member.permission.has("kickMembers") && !member.permission.has("banMembers")) {

      return interaction ? {content: "DENIED."} : await msg.channel.createMessage("DENIED.");

    }

    // Make sure the bad guy isn't us
    const badGuy = interaction ? guild.members.find(possibleMember => possibleMember.id === interaction.data.options.find(option => option.name === "member").value) : args;
    const reason = interaction ? interaction.data.options.find(option => option.name === "reason").value : args;
    switch (badGuy.id) {

      case bot.user.id:
        return interaction ? {content: "WHO ARE YOU TO ACCUSE ME?"} : await msg.channel.createMessage("WHO ARE YOU TO ACCUSE ME?");

      case member.id:
        return interaction ? {content: "IS THIS...ROLEPLAY?"} : await msg.channel.createMessage("IS THIS...ROLEPLAY?");

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

        } catch (err) {

          const failMsg = "I AM BUGGED? TERRIBLE.";
          return interaction ? {content: failMsg, embeds: [{
            description: err.stack
          }]} : await msg.channel.createMessage(failMsg);

        }

        // DM them, if possible
        const badGuyFullName = badGuy.username + "#" + badGuy.discriminator + " (" + badGuy.id + ")";
        const DMChannel = await bot.getDMChannel(badGuy.id);
        try {

          await DMChannel.createMessage("THE DRACONIC GUARD OF DA DRAGON DEN HAS **WARNED** YOU FOR THE FOLLOWING REASON: \n\n> " + reason + "\n\nPLEASE REVIEW THE RULES. THIS IS ONLY A WARNING. FURTHER VIOLATIONS MIGHT RESULT IN MORE SEVERE PUNISHMENTS.");

        } catch (err) {

          console.log("[Infraction] Couldn't DM " + badGuyFullName + ": " + err);

        }

        return interaction ? {content: "THEY HAVE BEEN WARNED."} : await msg.channel.createMessage("THEY HAVE BEEN WARNED.");

      }

    }

  }, undefined, [{
    name: "member",
    description: "The member you want to warn",
    type: 6,
    required: true
  }, {
    name: "reason",
    description: "Why?",
    type: 3,
    required: true
  }]);

};
