const ws = require("ws");
const cache = require("../cache");
const db = require("../database");
const Commands = require("../commands");

const VoiceRegex = /voice( -delay (?<delay>\d+))?( -(?<status>stop|start))?/mi;
var streamingVoice = false;
var wsClient;

module.exports = function() {
	new Commands.new("stream", [], "stream", async (bot, args, msg) => {
    
    switch (true) {
      
      case VoiceRegex.test(args): 
      
        const Input = args.match(VoiceRegex).groups;
        
        switch (Input.status) {
          
          case "stop": 
            break;
            
          case "start":
          
            // Check if we're already streaming voices
            if (wsClient && wsClient.readyState !== 3) {
              msg.channel.createMessage({
                content: "I'm already streaming voices!",
                messageReferenceID: msg.id,
                allowedMentions: {
                  repliedUser: true
                }
              });
              return;
            };
            
            // Check if they're in a voice channel
            const VoiceChannelId = msg.member.voiceState.channelID;
            if (!VoiceChannelId) {
              msg.channel.createMessage({
                content: "You need to be in a voice channel for me to stream your voice!",
                messageReferenceID: msg.id,
                allowedMentions: {
                  repliedUser: true
                }
              });
              return;
            };
            
            // Can we join it?
            const VoiceChannel = bot.getChannel(VoiceChannelId);
            
            if (!VoiceChannel.permissionsOf(bot.user.id).has("voiceConnect")) {
              msg.channel.createMessage({
                content: "I don't have permission to join the voice channel you're in!",
                messageReferenceID: msg.id,
                allowedMentions: {
                  repliedUser: true
                }
              });
              return;
            };
            
            const VoiceConnection = await VoiceChannel.join();
            VoiceConnection.updateVoiceState(true, false);
            
            // Connect to the server
            wsClient = new ws("wss://VoiceReplicatorWebSocket.draguwro.repl.co");
            
            wsClient.on("open", () => {
              
              const VoiceDataStream = VoiceConnection.receive("opus");
              VoiceDataStream.on("data", (voiceData) => {
                wsClient.send(voiceData);
              });
              
              msg.channel.createMessage({
                content: "Now streaming **" + VoiceChannel.name + "**!",
                messageReferenceID: msg.id,
                allowedMentions: {
                  repliedUser: true
                }
              });
              
            });
            
            wsClient.on("unexpected-response", () => {
              msg.channel.createMessage("Fail!");
            });
            
            break;
            
          default:
            break;
          
        };
        
        break;
        
      default:
        break;
      
    };
    
  });
};