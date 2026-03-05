const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qris')
        .setDescription('Tampilkan QRIS untuk donasi'),
    
    async execute(interaction) {
        const qrisPath = path.join(__dirname, '..', 'assets', 'qris.png');
        
        if (!fs.existsSync(qrisPath)) {
            return interaction.reply({ 
                content: '❌ File QRIS belum diupload! Silakan letakkan file `qris.png` di folder `assets/`', 
                ephemeral: true 
            });
        }
        
        await interaction.reply({
            content: '**💳 Silakan scan QRIS berikut:**\n\nSetelah transfer, screenshot bukti dan kirim ke tiket ini.\n⏰ **Mohon segera konfirmasi ke admin setelah transfer!**',
            files: [qrisPath]
        });
    }
};