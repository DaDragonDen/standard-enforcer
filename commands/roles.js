const db = require("../database");
const Commands = require("../commands");

const Regex = /(?<action>new|add|remove|delete|del|list|all|get)(( -(?<scope>roleid|rid|id|i|rolename|name|n)( (?<role>\S+)?))?)?/mi;

async function handleCmd(cmd, bot, args, msg) {
  
  switch (true) {
		
    case Regex.test(args):
      
      const SQLTable = cmd === "getrole" ? "SelfRoles" : (cmd === "defaultrole" ? "DefaultRoles" : "PersistentRoles");
      const Input = args.match(Regex).groups;
      const GuildRoles = msg.channel.guild.roles;
      const Scope = {
        "roleid": "id",
        "rid": "id",
        "id": "id",
        "i": "id",
        "rolename": "name",
        "name": "name",
        "n": "name"
      }[Input.scope];
      
      function getGuildRole(role) {
        return GuildRoles.find((iRole) => {
          return iRole[Scope || "id"].toLowerCase() === role.toLowerCase();
        });
      };
      
      // This might take a bit
      await msg.channel.sendTyping();
      
      // Make sure that they have permission
      if (cmd !== "getrole" && !msg.member.permissions.has("administrator") && (!msg.member.permissions.has("manageRoles") || !msg.member.permissions.has("manageServer"))) {
        return;
      };
      
      // Make sure we have everything we need
      if (Input.action !== "all" && Input.action !== "list" && !Input.scope | !Input.role) {
        await msg.channel.createMessage({
          content: "What's the " + (Input.scope ? "role" : "scope") + "?",
          messageReferenceID: msg.id,
          allowedMentions: {
            repliedUser: true
          }
        });
        return;
      };
      
      switch (Input.action) {
        
        case "new":
        case "add":
        
          if (cmd === "getrole") return;
          
          // Make sure we have everything we need
          if (!Input.scope | !Input.role) {
            await msg.channel.createMessage({
              content: "What's the " + (Input.scope ? "role" : "scope") + "?",
              messageReferenceID: msg.id,
              allowedMentions: {
                repliedUser: true
              }
            });
            return;
          };
          
          // Make sure the role exists
          let role = GuildRoles.find((iRole) => {
            return iRole[Scope] === Input.role;
          });
          
          if (!role) {
            await msg.channel.createMessage({
              content: "I couldn't find that role.",
              messageReferenceID: msg.id,
              allowedMentions: {
                repliedUser: true
              }
            });
            return;
          };
          
          // Everything looks right! Let's save it.
          db.prepare("replace into " + SQLTable + "(roleId) values (?)")
            .run(role.id);
            
          // Tell em everything's good
          await msg.channel.createMessage({
            content: cmd === "getrole" ? "Members can now get the **" + role.name + "** role!" : (
                     cmd === "defaultrole" ? "I will give new members the **" + role.name + "** role!" :
                     "I will now give returning members the **" + role.name + "** role if they had it before they left."),
            messageReferenceID: msg.id,
            allowedMentions: {
              repliedUser: true
            }
          });
          
          break;
          
        case "delete":
        case "del":
        case "remove":
        case "rem":
        case "get":
          
          if (cmd === "getrole") {
            
            function getRoleFromMember() {
              
              // Make sure role exists
              var guildRole = getGuildRole(Input.role);
              
              // Make sure they have it
              return guildRole && msg.member.roles.find((iRole) => {
                return iRole === guildRole.id;
              }) ? guildRole : undefined;
              
            };
            
            const Getting = Input.action === "get";
            var requestedRole = Getting ? getGuildRole(Input.role, Scope) : getRoleFromMember();
            
            if (!requestedRole) {
              await msg.channel.createMessage({
                content: Getting ? "That role doesn't exist in this server!" : "You don't have that role!",
                messageReferenceID: msg.id,
                allowedMentions: {
                  repliedUser: true
                }
              });
              return;
            };
            
            // Make sure it's an available role
            if (!db.prepare("select * from SelfRoles where roleId = (?)").get(requestedRole.id)) {
              await msg.channel.createMessage({
                content: Getting ? "Sorry, but you can't get that role from me!" : "Sorry, but that role isn't on the self-role list. I can't remove it from you.",
                messageReferenceID: msg.id,
                allowedMentions: {
                  repliedUser: true
                }
              });
              return;
            };
            
            // Give em the role
            Getting ? await msg.member.addRole(requestedRole.id, "Asked for it") : await msg.member.removeRole(requestedRole.id, "Asked for it");
            
            // And we're done
            await msg.channel.createMessage({
              content: "Done!",
              messageReferenceID: msg.id,
              allowedMentions: {
                repliedUser: true
              }
            });
            
            return;
            
          };
          
          // Find the role
          const RoleId = Scope === "id" ? Input.role : (() => {
            return GuildRoles.find((iRole) => {
              return iRole.name === Input.role;
            }).id;
          })();
          
          // Delete the role
          db.prepare("delete from " + SQLTable + " where roleId = (?)").run(RoleId);
          
          // Done!
          await msg.channel.createMessage({
            content: cmd === "getrole" ? "Members can no longer get that role!" :
                     "I will no longer give " + cmd === "defaultrole" ? "new" : "returning" + " members that role!",
            messageReferenceID: msg.id,
            allowedMentions: {
              repliedUser: true
            }
          });
          
          break;
          
        case "all":
        case "list":
          
          // Get the roles and turn them into a string
          const Roles = db.prepare("select * from " + SQLTable).all();
          var descRoles = "";
          var rolesToDelete = [];
          
          for (var i = 0; Roles.length > i; i++) {
            
            // Check if role exists
            var guildRole = getGuildRole(Roles[i].roleId);
            
            if (!guildRole) {
              rolesToDelete.push(Roles[i].roleId);
              continue;
            };
            
            descRoles = descRoles + 
                        (i !== 0 ? "\n" : "") + "**" + // line break
                        "🔖 " + guildRole.name + // role name
                        "** (" + guildRole.id + ")"; // role ID
            
          };
          
          // Remove the deleted roles
          for (var i = 0; rolesToDelete.length > i; i++) {
            db.prepare("delete from " + SQLTable + " where roleId = (?)").run(rolesToDelete[i]);
          };
          
          await msg.channel.createMessage({
            content: cmd === "getrole" ? "All members can get these roles at the moment:" : (
                     cmd === "defaultrole" ? "Here are the roles I'm giving the new members now:" :
                     "If returning members had these roles before they left, I'll give them back:"),
            embed: {
              description: descRoles
            },
            messageReferenceID: msg.id,
            allowedMentions: {
              repliedUser: true
            }
          });

          break;
        
        default:
          break;
        
      };
    
    default:
      break;
  
  };
};

module.exports = function() {
  const Cmds = [["getrole", ["gr", "role", "r", "selfrole", "sr"]], ["defaultrole", ["drole"]], ["persistentrole", ["prole", "pr", "rejoinrole", "rerole"]]];
  
  for (var i = 0; Cmds.length > i; i++) {
    const Cmd = Cmds[i];
    new Commands.new(Cmd[0], Cmd[1], "utils", async (bot, args, msg) => {
      handleCmd(Cmd[0], bot, args, msg);
    });
  };
};