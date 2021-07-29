const Commands = require("../commands");
const db = require("../database");

const HandleRegex = /(?<source>twitter|instagram|ig|youtube|yt)( (https?:\/\/)?((www\.)?(twitter|instagram|youtube)\.com\/)?@?(?<handle>[A-Za-z0-9_.]+))?/gmi;
const Aliases = {
  ig: "instagram",
  yt: "youtube"
};

module.exports = function() {
  new Commands.new("connect", [], "connections", async (bot, args, msg) => {
    
    // Make sure we got the handle and source
    var matches = args ? [...args.matchAll(HandleRegex)][0] : undefined;
    var groups = matches ? matches.groups : undefined;
    var source = groups && groups.source ? groups.source.toLowerCase() : undefined;
    var handle = groups ? groups.handle : undefined;
    if (!source || !handle) {
      await msg.channel.createMessage({
        content: "I couldn't connect your account because you didn't tell me " + (
          source ? "your handle." : "the source (twitter, instagram, youtube) you wanted to connect to."
        ),
        messageReferenceID: msg.id
      });
      return;
    };
    
    // Save it to the database
    function getValue(column) {
      return column === source ? "@handle" : "(select " + column + " from SocialMediaInfo where discordId = @id" + (column === "rowid" ? " union select max(rowid) + 1 from SocialMediaInfo" : "") + " limit 1)";
    };
    var dId = msg.author.id;
    var alias = Aliases[source];
    try {
      db.prepare("replace into SocialMediaInfo (rowid, discordId, twitter, youtube, instagram) values (" + getValue("rowid") + ", @id, " + getValue("twitter") + ", " + getValue("youtube") + ", " + getValue("instagram") + ")").run({
        id: dId, 
        handle: handle
      });
    } catch (err) {
      throw err;
    };
    
    await msg.channel.createMessage({
      content: "Connected!",
      messageReferenceID: msg.id
    });
    
  });
};