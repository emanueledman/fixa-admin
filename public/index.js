const functions = require('firebase-functions');
const cors = require('cors')({ origin: true }); // Permite todas as origens (ajuste para produção)
const axios = require('axios');

// Configurações da API UltraMsg (armazenadas no Firebase Config para segurança)
const ULTRA_MSG_TOKEN = functions.config().ultramsg.token || 'dklefhlqae1key9l';
const ULTRA_MSG_INSTANCE_ID = functions.config().ultramsg.instance_id || 'instance126366';

exports.sendWhatsAppNotification = functions.https.onCall(async (data, context) => {
  const { phoneNumber, problemId, problemTitle, newStatus, language } = data;

  // Validação dos parâmetros
  if (!phoneNumber || !problemId || !problemTitle || !newStatus) {
    console.error('Parâmetros ausentes:', { phoneNumber, problemId, problemTitle, newStatus });
    throw new functions.https.HttpsError('invalid-argument', 'Parâmetros obrigatórios ausentes');
  }

  try {
    // Formatar o número de telefone (exemplo: +244935705347)
    const formattedPhone = phoneNumber.replace(/\s/g, '');
    const message = `Seu problema "${problemTitle}" (ID: ${problemId}) foi atualizado para: ${newStatus}`;

    console.log('Enviando notificação WhatsApp:', { formattedPhone, problemId, problemTitle, newStatus });

    // Enviar mensagem via UltraMsg
    const response = await axios.post(
      `https://api.ultramsg.com/${ULTRA_MSG_INSTANCE_ID}/messages/chat`,
      {
        token: ULTRA_MSG_TOKEN,
        to: formattedPhone,
        body: message
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.status !== 200) {
      console.error('Falha na API UltraMsg:', response.data);
      throw new Error(`Falha na API UltraMsg: ${response.data.error || 'Erro desconhecido'}`);
    }

    console.log('Notificação enviada com sucesso:', response.data);
    return { message: 'Notificação enviada com sucesso', data: response.data };
  } catch (error) {
    console.error('Erro ao enviar notificação WhatsApp:', error.message);
    throw new functions.https.HttpsError('internal', `Erro ao enviar notificação: ${error.message}`);
  }
});