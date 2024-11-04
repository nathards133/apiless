import { WebhookClient, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL });

const auditLogger = {
  log: async (action, details, userId) => {
    const timestamp = new Date().toISOString();
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Ação de Auditoria: ${action}`)
      .setDescription(`Detalhes da ação realizada no sistema.`)
      .addFields(
        { name: 'Usuário ID', value: userId || 'N/A', inline: true },
        { name: 'Ação', value: action, inline: true },
        { name: 'Timestamp', value: timestamp, inline: true },
        { name: 'Detalhes', value: '```json\n' + JSON.stringify(details, null, 2) + '\n```' }
      )
      .setTimestamp();

    try {
      await webhookClient.send({
        embeds: [embed],
      });
      console.log('Mensagem de auditoria enviada para o Discord');
    } catch (error) {
      console.error('Erro ao enviar mensagem de auditoria para o Discord:', error);
    }
  },
};

export default auditLogger;
