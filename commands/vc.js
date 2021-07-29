const ws = require("ws");
const cache = require("../cache");
const db = require("../database");
const Commands = require("../commands");

const VCSetRegex = /set( -(v|vc|voice|voicechannel) (?<voiceChannelId>\d+))?( -(t|tc|text|textchannel) (?<textChannelId>\d+))?/mi;
var streamingVoice = false;
var wsClient;

module.exports = function() {
	new Commands.new("vc", [], "stream", async (bot, args, msg) => {
    
    switch (true) {
      
      case VCSetRegex.test(args): 
      
        const Input = args.match(VCSetRegex).groups;
        
        if (!Input.voiceChannelId || !Input.textChannelId) {
          return;
        };
        
        db.prepare("insert into VoiceAndTextChannels (voiceChannelId, textChannelId) values (?, ?)")
          .run(Input.voiceChannelId, Input.textChannelId);
        
        msg.channel.createMessage({
          content: "Set!",
          messageReferenceID: msg.id,
          allowedMentions: {
            repliedUser: true
          }
        });
        
        break;
        
      default:
        break;
      
    };
    
  });
};