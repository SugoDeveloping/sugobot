// ═══════════════════════════════════════════════════════════════
//  NicoDev Discord Bot – Transcript Generator
//  Genera trascrizioni HTML dei ticket
// ═══════════════════════════════════════════════════════════════

const discordTranscripts = require('discord-html-transcripts');

/**
 * Genera una trascrizione HTML del canale ticket
 * @param {TextChannel} channel - Il canale del ticket
 * @param {Object} options - Opzioni aggiuntive
 * @returns {Promise<AttachmentBuilder>} File allegato con la trascrizione
 */
async function generateTranscript(channel, options = {}) {
  try {
    const transcript = await discordTranscripts.createTranscript(channel, {
      limit: options.limit || -1,
      returnType: 'attachment',
      filename: `transcript-${channel.name}-${Date.now()}.html`,
      poweredBy: false,
      saveImages: true,
      footerText: `Trascrizione generata da NicoDev Bot • {date}`,
      ...options,
    });

    return transcript;
  } catch (error) {
    console.error('[Transcript] Errore nella generazione:', error);
    return null;
  }
}

module.exports = {
  generateTranscript,
};
