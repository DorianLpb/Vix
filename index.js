
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  joinVoiceChannel
} = require("@discordjs/voice");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("voice-join")
    .setDescription("Conecta el bot a un canal de voz")
    .addChannelOption(option =>
      option
        .setName("canal")
        .setDescription("Canal de voz")
        .addChannelTypes(
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice
        )
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName("stop")
        .setDescription("Sacar al bot del canal")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  new SlashCommandBuilder()
    .setName("bot-say")
    .setDescription("Envía un mensaje anónimo")
    .addStringOption(option =>
      option
        .setName("mensaje")
        .setDescription("Mensaje que enviará el bot")
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName("file")
        .setDescription("Archivo opcional")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
].map(command => command.toJSON());

const connections = new Map();

async function joinVoice(channel) {
  const oldConnection = connections.get(channel.guild.id);

  if (oldConnection) {
    oldConnection.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true
  });

  connections.set(channel.guild.id, connection);

  return connection;
}

function leaveVoice(guildId) {
  const connection = connections.get(guildId);

  if (connection) {
    connection.destroy();
    connections.delete(guildId);
  }
}

client.once("ready", async () => {
  console.log(`Conectado como ${client.user.tag}`);

  await client.application.commands.set(commands);

  console.log("Comandos registrados correctamente.");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "voice-join") {
      await interaction.deferReply({ ephemeral: true });

      const stop = interaction.options.getBoolean("stop");

      if (stop) {
        leaveVoice(interaction.guildId);
        return interaction.editReply(
          "He salido del canal de voz."
        );
      }

      let channel = interaction.options.getChannel("canal");

      if (!channel) {
        const member = await interaction.guild.members.fetch(
          interaction.user.id
        );
        channel = member.voice.channel;
      }

      if (
        !channel ||
        ![
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice
        ].includes(channel.type)
      ) {
        return interaction.editReply(
          "Debes seleccionar un canal de voz o unirte a uno."
        );
      }

      await joinVoice(channel);

      return interaction.editReply(
        `Conectado al canal **${channel.name}**.`
      );
    }

    if (interaction.commandName === "bot-say") {
      await interaction.deferReply({ ephemeral: true });

      const message = interaction.options.getString("mensaje");
      const attachment = interaction.options.getAttachment("file");

      const payload = {
        content: message,
        allowedMentions: { parse: [] }
      };

      if (attachment) {
        payload.files = [{
          attachment: attachment.url,
          name: attachment.name
        }];
      }

      await interaction.channel.send(payload);

      return interaction.editReply(
        "Mensaje enviado anónimamente."
      );
    }
  } catch (error) {
    console.error(error);

    const response = {
      content: "Ocurrió un error al ejecutar el comando."
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response).catch(() => {});
    } else {
      await interaction.reply({
        ...response,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
