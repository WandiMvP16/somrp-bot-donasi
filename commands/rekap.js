const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelper } = require('../database');

const ALLOWED_ROLE_ID = '1478444292631433450';

// Helper: Konversi UTC ke WIB
function toWIB(utcDateString) {
    const utcDate = new Date(utcDateString);
    const wibTime = utcDate.getTime() + (7 * 60 * 60 * 1000);
    const wibDate = new Date(wibTime);
    
    return wibDate.toLocaleString('id-ID', {
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
        .setName('rekap')
        .setDescription('Rekapitulasi donasi harian/mingguan/bulanan/semua waktu')
        .addStringOption(option =>
            option.setName('periode')
                .setDescription('Pilih periode rekap')
                .setRequired(true)
                .addChoices(
                    { name: '📅 Semua Waktu', value: 'all' },
                    { name: '📆 Hari Ini', value: 'daily' },
                    { name: '📅 Minggu Ini', value: 'weekly' },
                    { name: '📅 Bulan Ini', value: 'monthly' }
                )),
    
    async execute(interaction) {

        // 🔒 VALIDASI ROLE
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan command ini.',
                ephemeral: true
            });
        }

        const filter = interaction.options.getString('periode');
        
        const periodLabels = {
            'all': '📅 Rekap Semua Waktu',
            'daily': '📆 Rekap Harian',
            'weekly': '📅 Rekap Mingguan (7 Hari)',
            'monthly': '📅 Rekap Bulanan'
        };
        
        const periodDesc = {
            'all': 'Semua Waktu',
            'daily': 'Hari Ini',
            'weekly': '7 Hari Terakhir',
            'monthly': 'Bulan Ini'
        };
        
        await interaction.deferReply(); 
        
        try {
            const rekap = await dbHelper.getRekap(filter);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`${periodLabels[filter]}`)
                .setDescription(`Periode: **${periodDesc[filter]}**`)
                .setTimestamp();
            
            // Ringkasan utama
            embed.addFields(
                { 
                    name: '💰 Total Pendapatan', 
                    value: `Rp ${rekap.totalPendapatan.toLocaleString('id-ID')}`, 
                    inline: true 
                },
                { 
                    name: '📊 Total Transaksi', 
                    value: `${rekap.totalTransaksi} transaksi`, 
                    inline: true 
                }
            );
            
            // Top 3 Donatur
            let topText = '';
            if (rekap.topUsers.length === 0) {
                topText = 'Belum ada donasi pada periode ini.';
            } else {
                const medals = ['🥇', '🥈', '🥉'];
                rekap.topUsers.forEach((user, index) => {
                    const medal = medals[index] || '🔹';
                    topText += `${medal} **#${index + 1}** <@${user.user_id}>\n`;
                    topText += `   💵 Rp ${user.total.toLocaleString('id-ID')}\n\n`;
                });
            }
            
            embed.addFields({
                name: '🏆 Top 3 Donatur',
                value: topText || '-',
                inline: false
            });
            
            embed.setFooter({ text: 'Data real-time dari database' });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: '❌ Terjadi kesalahan saat mengambil data rekap.' 
            });
        }
    }
};