import { Collection } from "mongodb";
import { Client, CommandInteraction, ComponentInteraction, ApplicationCommandOptions, AnyApplicationCommand, ApplicationCommand } from "oceanic.js";

export type CommandList = { [name: string]: Command };

const commands: CommandList = {};
let configuredCommands: AnyApplicationCommand[] = [];
let _discordClient: Client;
let _collections: { [name: string]: Collection } = {};

export interface CommandActionProperties {
  discordClient: Client;
  interaction: CommandInteraction | ComponentInteraction;
  collections: { [name: string]: Collection };
}

export interface CommandProperties {
  name: string;
  description: string;
  action: (props: CommandActionProperties) => Promise<void>;
  slashOptions: ApplicationCommandOptions[];
  cooldown?: number;
  ephemeral?: boolean;
  customIds?: string[];
  dmPermission?: boolean;
}

export type CommandAction = (props: CommandActionProperties) => Promise<void>;

const commandNames: { [custom_id: string]: string } = {};

class Command {

  name: string;
  description: string;
  cooldown: number;
  action: CommandAction;
  slashOptions: ApplicationCommandOptions[];
  ephemeral: boolean;
  cooledUsers: { [userId: string]: number } = {};
  deleteInteractionOnFirstUsage?: boolean;
  customIds: string[];
  dmPermission: boolean;

  constructor({ name, description, action, cooldown = 0, slashOptions, ephemeral = false, customIds = [], dmPermission = false }: CommandProperties) {

    console.log("\x1b[36m%s\x1b[0m", "[Commands] Adding " + name + " command...");

    // Check if the command already exists
    if (commands[name]) {

      throw new Error("Command " + name + " already exists");

    }

    // Iterate through the custom IDs.
    for (let i = 0; customIds.length > i; i++) {

      // Record the custom ID.
      const customId = customIds[i];
      commandNames[customId] = name;

    }

    // Keep track of the command properties.
    this.name = name;
    this.action = action;
    this.description = description;
    this.cooldown = cooldown;
    this.slashOptions = slashOptions;
    this.ephemeral = ephemeral;
    this.customIds = customIds;
    this.dmPermission = dmPermission;
    commands[name] = this;

    console.log("\x1b[32m%s\x1b[0m", "[Commands] Finished adding " + name + " command");

  }

  async execute(interaction: CommandInteraction | ComponentInteraction) {

    // Acknowledge the interaction
    if (interaction.type === 2) {

      await interaction.defer(this.ephemeral ? 64 : undefined);

    } else if (interaction.type === 3) {

      await interaction.deferUpdate();

    }

    // Make sure we have an ID.
    const AuthorId = (interaction.member ?? interaction.user)?.id;
    if (!AuthorId) return;

    // Now check if the creator is under a cooldown.
    const ExecuteTime = new Date().getTime();
    const RemainingCooldown = this.cooledUsers[AuthorId] ? (this.cooledUsers[this.name] + this.cooldown) - ExecuteTime : 0;
    if (this.cooledUsers[AuthorId] && RemainingCooldown > 0 && interaction.channel) {

      await interaction.channel.createMessage({
        content: "<@" + AuthorId + "> You're moving too fast...even for me! Give me " + RemainingCooldown / 1000 + " more seconds."
      });
      return;

    }

    // Put the user under cooldown
    this.applyCooldown(AuthorId, this.cooldown);

    // Execute the command
    try {

      await this.action({ discordClient: _discordClient, interaction, collections: _collections });

    } catch (err: unknown) {

      await interaction.createFollowup({
        content: err instanceof Error ? err.message : "Something bad happened. How about running that by me one more time?"
      });

    }

  }

  applyCooldown(userId: string, milliseconds: number) {

    const ExecuteTime = new Date().getTime();
    this.cooledUsers[userId] = milliseconds ? ExecuteTime + milliseconds : ExecuteTime;

  }

  setAction(action: CommandAction) {

    this.action = action;

  }

  async verifyInteraction() {

    const interactionCmdInfo = configuredCommands.find(c => c.name === this.name);
    if (this.slashOptions && !interactionCmdInfo) {

      try {

        console.log("\x1b[36m%s\x1b[0m", "[Commands] " + (this.slashOptions ? "Creating" : "Deleting") + " interaction for command \"" + this.name + "\"...");

        await _discordClient.application.createGlobalCommand({
          name: this.name,
          description: this.description,
          options: this.slashOptions,
          dmPermission: this.dmPermission,
          type: 1
        });

        console.log("\x1b[32m%s\x1b[0m", "[Commands] Successfully created interaction for command \"" + this.name + "\"!");

      } catch (err) {

        console.log("\x1b[33m%s\x1b[0m", err);
        console.log("\x1b[33m%s\x1b[0m", "[Commands] Couldn't add interaction for command \"" + this.name + "\"...");

      }

    } else if (!this.slashOptions && interactionCmdInfo) {

      console.log("\x1b[36m%s\x1b[0m", "[Commands] Removing interaction for command \"" + this.name + "\"...");
      this.deleteInteractionOnFirstUsage = true;
      console.log("\x1b[32m%s\x1b[0m", "[Commands] Removed interaction for command \"" + this.name + "\"...");

    } else if (this.slashOptions && interactionCmdInfo && interactionCmdInfo.type === 1) {

      const updateCommand = async () => {

        console.log("\x1b[36m%s\x1b[0m", `[Commands] Updating ${this.name} command...`);

        await _discordClient.application.editGlobalCommand(interactionCmdInfo.id, {
          name: this.name,
          description: this.description,
          options: this.slashOptions
        });

      };

      // Now, we can run the loop.
      const deepEqual: (object1: Record<string, string> | ApplicationCommandOptions | ApplicationCommandOptions[], object2?: Record<string, string> | ApplicationCommandOptions | ApplicationCommand["options"]) => boolean = (object1: Record<string, string> | ApplicationCommandOptions | ApplicationCommandOptions[], object2?: Record<string, string> | ApplicationCommandOptions | ApplicationCommand["options"]) => {

        const object1Keys = Object.keys(object1);
        for (let i = 0; object1Keys.length > i; i++) {

          const key = object1Keys[i];
          const object1IsArray = Array.isArray(object1);
          const object2IsArray = Array.isArray(object2);
          const value1 = object1IsArray ? object1[parseInt(key, 10)] : object1[key as keyof ApplicationCommandOptions];
          const value2 = object2IsArray ? object2[parseInt(key, 10)] : object2?.[key as keyof ApplicationCommandOptions];
          if (value1 !== value2) {

            // Check if it's an object or an array.
            const value1IsArray = Array.isArray(value1);
            const value2IsArray = Array.isArray(value2);
            if ((value1IsArray && value2IsArray) || (!value1IsArray && !value2IsArray && (value1 instanceof Object && value2 instanceof Object))) {

              if (!deepEqual(value1, value2)) {

                return false;

              }

            } else {

              return false;

            }

          }

        }

        return true;

      };

      if (!deepEqual(this.slashOptions, interactionCmdInfo.options)) {

        await updateCommand();

      }

    }

  }

}

// Functions for other scripts to use
function listCommands(): CommandList {

  return commands;

}

async function storeClientAndCollections(discordClient: Client, collections: { [name: string]: Collection }) {

  // Get the already configured commands
  try {

    configuredCommands = await discordClient.application.getGlobalCommands();

  } catch (err) {

    console.log("[Commands] Couldn't get existing slash commands from Discord: " + err);

  }

  // Listen to interactions
  discordClient.on("interactionCreate", async (interaction) => {

    // Make sure it's a command
    if (interaction.type === 2) {

      // Check if the command exists
      const interactionName = interaction.data.name;
      const command = commands[interactionName];

      if (command) {

        await command.execute(interaction);

      } else {

        await discordClient.application.deleteGlobalCommand(interaction.data.id);

      }

    } else if (interaction.type === 3) {

      // Look for the custom ID.
      const { customID } = interaction.data;
      const commandName = commandNames[customID];
      const command = commands[commandName];

      if (command) {

        await command.execute(interaction);

      }

    }

  });

  _discordClient = discordClient;
  _collections = collections;

}

export { storeClientAndCollections, listCommands, Command };