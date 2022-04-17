const badNamePattern = /discord.gg\/(\S+)/gmi;

export default async (member) => {

  // Check if the name violates the rules
  if (member.username.match(badNamePattern) || (member.nick && member.nick.match(badNamePattern))) {

    try {

      await member.edit({nick: "❌ INAPPROPRIATE NAME"});

    } catch (err) {

      console.log("\x1b[33m%s\x1b[0m", "[Nicknames] Couldn't change nickname: " + err);

    }

  }

};
