const mediaRegex = /(https?:\/\/)?media\.discordapp\.net(?<path>\/attachments\/\d+?\/\d+?\/.+?\.(mp4|mov|flv|mpeg|webm|avi))/g;

module.exports = async (bot, msg) => {

  const links = [...msg.content.matchAll(mediaRegex)];
  let replacement = "";
  let i;
  for (i = 0; links.length > i; i++) {
    replacement += `https://cdn.discordapp.com${links[i].groups.path} `
  }

  if (replacement) await msg.channel.createMessage({
    content: "Converting media links...\n" + replacement,
    messageReference: {
      messageID: msg.id
    },
    allowedMentions: {
      repliedUser: false
    }
  })

};