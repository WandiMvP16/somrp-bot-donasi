const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelper } = require('../database');

const ALLOWED_ROLE_ID = '1478444292631433450';

// Helper: Parse tanggal (sudah WIB, jangan tambah 7 jam)
function parseTanggalIndonesia(tanggalString) {
    if (!tanggalString) return new Date();
    
    const parts = tanggalString.split(' ');
    const datePart = parts[0];
    
    const [day, month, year] = datePart.split('/');
    
    return new Date(year, month - 1, day);
}

// Helper: Format tampilan
function formatTampilan(dateObj) {
    return dateObj.toLocaleString('id-ID', {
        day: 'numeric', 
        month: 'short', 
        year: 'numeric'
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Lihat leaderboard donasi')
        .addStringOption(option =>
            option.setName('periode')
                .setDescription('Filter periode waktu')
                .setRequired(false)
                .addChoices(
                    { name: '📅 Semua Waktu', value: 'all' },
                    { name: '📆 Hari Ini', value: 'daily' },
                    { name: '📅 Minggu Ini', value: 'weekly' },
                    { name: '📅 Bulan Ini', value: 'monthly' }
                )),
    
    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan command ini.',
                ephemeral: true
            });
        }

        const filter = interaction.options.getString('periode') || 'all';
        
        const periodLabels = {
            'all': '🏆 Top 10 Donatur - Semua Waktu',
            'daily': '📆 Top 10 Donatur - Hari Ini',
            'weekly': '📅 Top 10 Donatur - 7 Hari Terakhir',
            'monthly': '📅 Top 10 Donatur - Bulan Ini'
        };
        
        await interaction.deferReply();
        
        try {
            const rows = await dbHelper.getTopDonations(filter, 10);
            
            if (rows.length === 0) {
                return interaction.editReply({ 
                    content: `📭 Belum ada data donasi untuk periode **${periodLabels[filter]}**.` 
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(periodLabels[filter])
                .setTimestamp();
            
            let description = '';
            let totalAll = 0;
            
            rows.forEach((row, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                
                // Parse tanpa tambah 7 jam
                const lastDonationDate = parseTanggalIndonesia(row.last_donation);
                const lastDonation = formatTampilan(lastDonationDate);
                
                const tipeList = row.tipe_donasi_list ? row.tipe_donasi_list.split(',').join(', ') : '-';
                
                description += `${medal} **#${index + 1}** <@${row.user_id}>\n`;
                description += `💰 Rp ${row.total.toLocaleString('id-ID')} (${row.transactions} transaksi)\n`;
                description += `📦 Tipe: ${tipeList}\n`;
                description += `🕐 Terakhir: ${lastDonation}\n\n`;
                
                totalAll += row.total;
            });
            
            embed.setDescription(description);
            embed.setFooter({ 
                text: `Total keseluruhan: Rp ${totalAll.toLocaleString('id-ID')} • ${rows.length} donatur` 
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