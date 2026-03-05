const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelper } = require('../database');

const ALLOWED_ROLE_ID = '1478444292631433450';

// Helper: Parse tanggal manual (sudah WIB, jangan tambah 7 jam lagi)
function parseTanggalIndonesia(tanggalString) {
    if (!tanggalString) return new Date();
    
    const parts = tanggalString.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '00:00';
    
    const [day, month, year] = datePart.split('/');
    const [hour, minute] = timePart.split(':');
    
    // Langsung buat date, anggap sudah WIB
    return new Date(year, month - 1, day, hour || 0, minute || 0);
}

// Helper: Format tampilan (tanpa konversi timezone)
function formatTampilan(dateObj) {
    return dateObj.toLocaleString('id-ID', {
        day: 'numeric', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Cek riwayat donasi user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User yang dicari (kosong = diri sendiri)')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan command ini.',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const [stats, history] = await Promise.all([
                dbHelper.getUserTotal(targetUser.id),
                dbHelper.getUserHistory(targetUser.id)
            ]);
            
            if (stats.count === 0) {
                return interaction.editReply({ 
                    content: `❌ **${targetUser.username}** belum pernah melakukan donasi.` 
                });
            }
            
            // Hitung total per tipe donasi
            const tipeCount = {};
            history.forEach(row => {
                const tipe = row.tipe_donasi || 'Lainnya';
                tipeCount[tipe] = (tipeCount[tipe] || 0) + 1;
            });
            
            let tipeInfo = '';
            for (const [tipe, count] of Object.entries(tipeCount)) {
                tipeInfo += `• ${tipe}: ${count}x\n`;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`💰 Profil Donasi - ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '💵 Total Donasi', value: `Rp ${stats.total.toLocaleString('id-ID')}`, inline: true },
                    { name: '📊 Total Transaksi', value: `${stats.count}x`, inline: true },
                    { name: '📦 Rincian Tipe', value: tipeInfo || '-', inline: true },
                    { name: '👤 User ID', value: targetUser.id, inline: false }
                );
            
            let historyText = '';
            history.slice(0, 10).forEach((row, idx) => {
                // Parse tanpa tambah 7 jam (sudah WIB)
                const dateObj = parseTanggalIndonesia(row.display_date);
                const date = formatTampilan(dateObj);
                const tipe = row.tipe_donasi || 'Lainnya';
                historyText += `${idx + 1}. **[${tipe}]** Rp ${row.amount.toLocaleString('id-ID')}\n`;
                historyText += `   📅 ${date} | 🆔 ${row.citizen_id || '-'} | 🔗 [Steam](${row.steam_link || '#'})\n`;
                historyText += `   👤 oleh: ${row.added_by_username}\n\n`;
            });
            
            embed.addFields({ 
                name: `📝 Riwayat Transaksi (${history.length} total)`, 
                value: historyText || 'Tidak ada data' 
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: '❌ Terjadi kesalahan saat mengambil data.' 
            });
        }
    }
};